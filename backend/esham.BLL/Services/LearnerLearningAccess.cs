using System.Security.Claims;
using esham.BLL.DTOs;
using esham.BLL.Interfaces;
using esham.DAL.Data;
using esham.DAL.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
namespace esham.BLL.Services;

public sealed record LearningAccess(Enrollment Enrollment, CourseVersion Version, Lesson? Lesson);
public sealed class LearnerLearningAccess(AppDbContext db, UserManager<ApplicationUser> users, IAccountService accounts)
{
    public async Task<ServiceResult<LearningAccess>> ResolveAsync(ClaimsPrincipal actor, Guid enrollmentId, Guid? lessonId = null, CancellationToken ct = default)
    {
        var (user, failure) = await FinancialAccess.Check(users, actor, "Learner");
        if (user is null) return ServiceResult<LearningAccess>.Fail(failure, "Learner membership and a valid session are required.");
        var session = await accounts.GetCurrentSessionAsync(actor);
        if (session.Failure != AccountFailure.None || session.OnboardingRequired)
            return ServiceResult<LearningAccess>.Fail(ServiceFailure.Conflict, "Complete account setup first.", "onboarding_required");
        var e = await db.Enrollments.AsNoTracking().Include(x => x.Course).SingleOrDefaultAsync(x => x.Id == enrollmentId && x.LearnerUserId == user.Id, ct);
        if (e is null) return ServiceResult<LearningAccess>.Fail(ServiceFailure.NotFound, "Enrollment not found.");
        if (e.Status is not ("active" or "completed") || e.Course.SafetyStatus != "active")
            return ServiceResult<LearningAccess>.Fail(ServiceFailure.Forbidden, "Learning is unavailable.", "course_unavailable");
        // Deliberately preserves the documented learning policy, not catalog visibility.
        // EnrollmentPaused applies only to new purchases.
        var v = await db.CourseVersions.AsNoTracking().SingleOrDefaultAsync(x => x.Id == e.Course.PublishedVersionId
            && x.CourseId == e.CourseId && x.ReviewStatus == "approved" && x.Category.IsActive, ct);
        if (v is null) return ServiceResult<LearningAccess>.Fail(ServiceFailure.Forbidden, "Published learning content is unavailable.", "course_unavailable");
        if (!await db.EnrollmentVersionAccess.AnyAsync(x => x.EnrollmentId == e.Id && x.CourseId == e.CourseId && x.CourseVersionId == v.Id, ct))
            return ServiceResult<LearningAccess>.Fail(ServiceFailure.Conflict, "Version access needs coordinated initialization.", "version_access_missing");
        Lesson? lesson = null;
        if (lessonId.HasValue)
        {
            lesson = await db.Lessons.AsNoTracking().Include(x => x.PrimaryVideoMediaAsset).Include(x => x.Attachments).ThenInclude(x => x.MediaAsset)
                .SingleOrDefaultAsync(x => x.Id == lessonId && x.CourseSection.CourseVersionId == v.Id, ct);
            if (lesson is null) return ServiceResult<LearningAccess>.Fail(ServiceFailure.NotFound, "Lesson not found.");
        }
        return ServiceResult<LearningAccess>.Ok(new(e, v, lesson));
    }
}
