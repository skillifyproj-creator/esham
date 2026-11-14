using System.Data;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using esham.BLL.DTOs;
using esham.BLL.DTOs.Enrollments;
using esham.BLL.Interfaces;
using esham.DAL.Data;
using esham.DAL.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
namespace esham.BLL.Services;

public sealed class EnrollmentService(AppDbContext db, UserManager<ApplicationUser> users,
    IAccountService accounts, ICourseVersionUpdates versions, IEnrollmentPurchaseGate gate) : IEnrollmentService
{
    private static ServiceResult<T> Fail<T>(ServiceFailure failure, string message, string? code = null) => ServiceResult<T>.Fail(failure, message, code);
    private static string UserKey(string id) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(id)));
    private static string WelcomeKey(string id) => "welcome:" + UserKey(id);
    // Request identity is account-wide, not course-scoped: reuse across courses conflicts.
    internal static string DebitKey(string id, Guid requestId) => $"enroll:v1:{UserKey(id)}:{requestId:N}:debit";
    internal static string CreditKey(string id, Guid requestId) => $"enroll:v1:{UserKey(id)}:{requestId:N}:credit";

    private IQueryable<EnrollmentDto> Project(IQueryable<Enrollment> source) => source.Select(e => new
    {
        Enrollment = e,
        Available = (e.Status == "active" || e.Status == "completed") && e.Course.SafetyStatus == "active"
            && e.Course.PublishedVersion != null && e.Course.PublishedVersion.ReviewStatus == "approved"
            && EducationalCategories.Visible(db).Any(c => c.Id == e.Course.PublishedVersion.CategoryId)
            && db.EnrollmentVersionAccess.Any(a => a.EnrollmentId == e.Id && a.CourseId == e.CourseId && a.CourseVersionId == e.Course.PublishedVersionId)
    }).Select(x => new EnrollmentDto(x.Enrollment.Id, x.Enrollment.CourseId, x.Enrollment.CourseVersionId,
        x.Available ? x.Enrollment.Course.PublishedVersionId : null, x.Enrollment.Status, x.Enrollment.EnrolledAt,
        x.Enrollment.CompletedAt, x.Enrollment.LastOpenedAt, x.Enrollment.CourseVersion.TitleAr, x.Enrollment.CourseVersion.TitleEn,
        x.Enrollment.Course.OwnerUser.Name ?? "", x.Enrollment.Course.OwnerUser.NameEn, x.Available));

    public async Task<ServiceResult<EnrollmentPage>> ListAsync(ClaimsPrincipal actor, int page = 1, int pageSize = 20, CancellationToken ct = default)
    {
        var (user, failure) = await FinancialAccess.Check(users, actor, "Learner");
        if (user is null) return Fail<EnrollmentPage>(failure, "Learner membership is required.");
        if (!FinancialAccess.ValidPage(page, pageSize)) return Fail<EnrollmentPage>(ServiceFailure.Validation, "Invalid pagination.");
        var q = db.Enrollments.AsNoTracking().Where(x => x.LearnerUserId == user.Id);
        return ServiceResult<EnrollmentPage>.Ok(new(user.Id, await Project(q.OrderByDescending(x => x.EnrolledAt).ThenByDescending(x => x.Id)
            .Skip((page - 1) * pageSize).Take(pageSize)).ToListAsync(ct), page, pageSize, await q.CountAsync(ct)));
    }
    public async Task<ServiceResult<EnrollmentDetail>> GetAsync(ClaimsPrincipal actor, Guid id, CancellationToken ct = default)
    {
        var (user, failure) = await FinancialAccess.Check(users, actor, "Learner");
        if (user is null) return Fail<EnrollmentDetail>(failure, "Learner membership is required.");
        if (id == Guid.Empty) return Fail<EnrollmentDetail>(ServiceFailure.Validation, "A nonempty enrollment ID is required.");
        var item = await Project(db.Enrollments.AsNoTracking().Where(x => x.Id == id && x.LearnerUserId == user.Id)).SingleOrDefaultAsync(ct);
        return item is null ? Fail<EnrollmentDetail>(ServiceFailure.NotFound, "Enrollment not found.") : ServiceResult<EnrollmentDetail>.Ok(new(user.Id, item));
    }
    public async Task<ServiceResult<PurchaseAvailability>> AvailabilityAsync(ClaimsPrincipal actor, CancellationToken ct = default)
    {
        var (user, failure) = await FinancialAccess.Check(users, actor, "Learner");
        return user is null ? Fail<PurchaseAvailability>(failure, "Learner membership is required.")
            : ServiceResult<PurchaseAvailability>.Ok(new(user.Id, await gate.IsEnabledAsync(ct)));
    }

    public async Task<ServiceResult<EnrollmentPurchase>> PurchaseAsync(ClaimsPrincipal actor, PurchaseEnrollmentRequest request, CancellationToken ct = default)
    {
        var (initial, access) = await FinancialAccess.Check(users, actor, "Learner");
        if (initial is null) return Fail<EnrollmentPurchase>(access, "Learner membership is required.");
        if (request.CourseId == Guid.Empty || request.RequestId == Guid.Empty || request.ExpectedPublishedVersionId == Guid.Empty)
            return Fail<EnrollmentPurchase>(ServiceFailure.Validation, "Nonempty course, expected publication and request GUIDs are required.");
        if (!await gate.IsEnabledAsync(ct)) return Fail<EnrollmentPurchase>(ServiceFailure.Forbidden, "Enrollment purchases are disabled in this environment.", "purchase_disabled");
        var learnerId = initial.Id;
        var enrollmentId = Guid.NewGuid(); var debitId = Guid.NewGuid(); var creditId = Guid.NewGuid();
        var debitKey = DebitKey(learnerId, request.RequestId); var creditKey = CreditKey(learnerId, request.RequestId);
        try
        {
            return await db.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
            {
                db.ChangeTracker.Clear();
                await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
                // Publication uses this same course-first lock. Never lock wallets first.
                var course = await (db.Database.IsSqlServer()
                    ? db.Courses.FromSqlInterpolated($"SELECT * FROM [Courses] WITH (UPDLOCK, HOLDLOCK) WHERE [Id] = {request.CourseId}")
                    : db.Courses.AsQueryable()).SingleOrDefaultAsync(x => x.Id == request.CourseId, ct);
                if (course is null) return Fail<EnrollmentPurchase>(ServiceFailure.NotFound, "Course not found.");
                foreach (var id in new[] { learnerId, course.OwnerUserId }.Distinct().Order(StringComparer.Ordinal))
                    await (db.Database.IsSqlServer()
                        ? db.Users.FromSqlInterpolated($"SELECT * FROM [AspNetUsers] WITH (UPDLOCK, HOLDLOCK) WHERE [Id] = {id}")
                        : db.Users.AsQueryable()).SingleOrDefaultAsync(x => x.Id == id, ct);
                var (learner, failure) = await FinancialAccess.Check(users, actor, "Learner");
                if (learner is null) return Fail<EnrollmentPurchase>(failure, "Account access changed. Refresh your session.");

                // Check replay before present-day eligibility/balance: a committed purchase
                // remains recoverable after publication changes or spending elsewhere.
                var prior = await db.PointTransactions.AsNoTracking().Where(x => x.OperationKey == debitKey || x.OperationKey == creditKey).ToListAsync(ct);
                if (prior.Count > 0)
                {
                    var debit = prior.SingleOrDefault(x => x.OperationKey == debitKey);
                    var credit = prior.SingleOrDefault(x => x.OperationKey == creditKey);
                    var owned = debit?.EnrollmentId is Guid eid ? await db.Enrollments.AsNoTracking().SingleOrDefaultAsync(x => x.Id == eid && x.LearnerUserId == learnerId, ct) : null;
                    if (prior.Count != 2 || debit is null || credit is null || owned is null || owned.CourseId != request.CourseId
                        || owned.CourseVersionId != request.ExpectedPublishedVersionId || debit.UserId != learnerId || debit.Amount != -20 || debit.TransactionType != "enrollment"
                        || credit.EnrollmentId != owned.Id || credit.UserId != course.OwnerUserId || credit.Amount != 20 || credit.TransactionType != "teaching"
                        || !await db.EnrollmentVersionAccess.AnyAsync(x => x.EnrollmentId == owned.Id && x.CourseVersionId == owned.CourseVersionId && x.Reason == "enrolled", ct))
                        return Fail<EnrollmentPurchase>(ServiceFailure.Conflict, "Request identity conflicts with its persisted purchase. No transfer was made.", "request_conflict");
                    var recovered = await Project(db.Enrollments.AsNoTracking().Where(x => x.Id == owned.Id)).SingleAsync(ct);
                    await transaction.CommitAsync(ct);
                    return ServiceResult<EnrollmentPurchase>.Ok(new(learnerId, request.RequestId, true, 20, recovered));
                }
                if (await db.Enrollments.AnyAsync(x => x.LearnerUserId == learnerId && x.CourseId == course.Id, ct))
                    return Fail<EnrollmentPurchase>(ServiceFailure.Conflict, "You are already enrolled in this course.", "already_enrolled");
                if (course.OwnerUserId == learnerId) return Fail<EnrollmentPurchase>(ServiceFailure.Conflict, "You cannot purchase your own course.", "self_enrollment");
                var version = await db.CourseVersions.SingleOrDefaultAsync(x => x.Id == course.PublishedVersionId && x.CourseId == course.Id, ct);
                if (course.SafetyStatus != "active" || course.EnrollmentPaused || version is null || version.ReviewStatus != "approved" || version.ApprovedAt is null
                    || !await EducationalCategories.Visible(db).AnyAsync(x => x.Id == version.CategoryId, ct))
                    return Fail<EnrollmentPurchase>(ServiceFailure.Conflict, "This course is not available for enrollment.", "course_unavailable");
                if (version.Id != request.ExpectedPublishedVersionId) return Fail<EnrollmentPurchase>(ServiceFailure.Conflict, "The publication changed. Review the course before confirming again.", "publication_changed");
                var session = await accounts.GetCurrentSessionAsync(actor);
                if (session.Failure != AccountFailure.None || session.OnboardingRequired)
                    return Fail<EnrollmentPurchase>(ServiceFailure.Conflict, "Complete account setup before enrolling.", "onboarding_required");
                var wallets = new Dictionary<string, Wallet>();
                foreach (var id in new[] { learnerId, course.OwnerUserId }.Order(StringComparer.Ordinal))
                {
                    var wallet = await (db.Database.IsSqlServer()
                        ? db.Wallets.FromSqlInterpolated($"SELECT * FROM [Wallets] WITH (UPDLOCK, HOLDLOCK) WHERE [UserId] = {id}")
                        : db.Wallets.AsQueryable()).SingleOrDefaultAsync(x => x.UserId == id, ct);
                    var welcomeKey = WelcomeKey(id);
                    var welcome = await db.PointTransactions.AsNoTracking().SingleOrDefaultAsync(x => x.OperationKey == welcomeKey, ct);
                    if (wallet is null || wallet.Balance < 0 || welcome is null || welcome.UserId != id || welcome.Amount != 20 || welcome.TransactionType != "welcome" || welcome.EnrollmentId != null)
                        return Fail<EnrollmentPurchase>(ServiceFailure.Conflict, "A required wallet needs coordinated initialization. No points were transferred.", "wallet_unavailable");
                    wallets.Add(id, wallet);
                }
                var payer = wallets[learnerId]; var recipient = wallets[course.OwnerUserId];
                if (payer.Balance < 20) return Fail<EnrollmentPurchase>(ServiceFailure.Conflict, "You need 20 points to enroll.", "insufficient_balance");
                if (recipient.Balance > int.MaxValue - 20) return Fail<EnrollmentPurchase>(ServiceFailure.Conflict, "The recipient wallet cannot accept this transfer.", "wallet_unavailable");
                var now = DateTimeOffset.UtcNow;
                var enrollment = new Enrollment { Id = enrollmentId, LearnerUserId = learnerId, CourseId = course.Id, CourseVersionId = version.Id, EnrolledAt = now };
                db.Enrollments.Add(enrollment);
                payer.Balance -= 20; recipient.Balance += 20; payer.UpdatedAt = recipient.UpdatedAt = now;
                db.PointTransactions.AddRange(
                    new PointTransaction { Id = debitId, UserId = learnerId, EnrollmentId = enrollmentId, Amount = -20, TransactionType = "enrollment", OperationKey = debitKey, CreatedAt = now },
                    new PointTransaction { Id = creditId, UserId = course.OwnerUserId, EnrollmentId = enrollmentId, Amount = 20, TransactionType = "teaching", OperationKey = creditKey, CreatedAt = now });
                await versions.StageEnrollmentAsync(enrollment, ct);
                await db.SaveChangesAsync(ct);
                var saved = await Project(db.Enrollments.AsNoTracking().Where(x => x.Id == enrollmentId)).SingleAsync(ct);
                await transaction.CommitAsync(ct);
                return ServiceResult<EnrollmentPurchase>.Ok(new(learnerId, request.RequestId, false, 20, saved));
            });
        }
        finally { db.ChangeTracker.Clear(); }
    }
}
