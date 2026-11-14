using System.Data;
using System.Data.Common;
using esham.BLL.DTOs;
using esham.BLL.Interfaces;
using esham.BLL.Services;
using esham.DAL.Data;
using esham.DAL.Entities;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Xunit;
using static esham.Tests.AccountFinalizationTests;
using static esham.Tests.AccountFinalizationSqlServerTests;
using static esham.Tests.EnrollmentTests;
namespace esham.Tests;

public sealed class Phase1SqlFactAttribute : FactAttribute
{
    public Phase1SqlFactAttribute()
    {
        if (!EnrollmentSqlServerTests.Configured()) Skip = "Requires explicit approved isolated LocalDB identity; never uses User Secrets or db75401.";
    }
}
public sealed class Phase1SqlTheoryAttribute : TheoryAttribute
{
    public Phase1SqlTheoryAttribute()
    {
        if (!EnrollmentSqlServerTests.Configured()) Skip = "Requires explicit approved isolated LocalDB identity; never uses User Secrets or db75401.";
    }
}

public sealed class EnrollmentSqlServerTests
{
    internal static bool Configured()
    {
        if (Environment.GetEnvironmentVariable("ESHAM_RUN_ISOLATED_SQL_TESTS") != "1") return false;
        try
        {
            var value = Environment.GetEnvironmentVariable("ESHAM_ACCOUNT_TEST_SQLSERVER");
            var approved = Environment.GetEnvironmentVariable("ESHAM_APPROVED_ISOLATED_DATABASE");
            if (string.IsNullOrWhiteSpace(value) || approved is null || !approved.StartsWith("Esham_AccountTests_", StringComparison.Ordinal)) return false;
            var target = new SqlConnectionStringBuilder(value);
            return target.DataSource.StartsWith(@"(localdb)\", StringComparison.OrdinalIgnoreCase) && target.InitialCatalog == approved;
        }
        catch { return false; }
    }
    private static EnrollmentPurchaseGate Gate(AppDbContext db) => new(db, Options.Create(new EnrollmentPurchaseOptions
    { Enabled = true, ApprovedIsolatedDatabase = Environment.GetEnvironmentVariable("ESHAM_APPROVED_ISOLATED_DATABASE") }));
    private static async Task<ServiceProvider> VerifiedProvider(params IInterceptor[] interceptors)
    {
        if (!Configured()) throw new InvalidOperationException("No approved isolated test target.");
        var provider = DatabaseServices(interceptors);
        // Mandatory actual connected identity check BEFORE any fixture mutates anything.
        using var scope = provider.CreateScope();
        if (!await Gate(scope.ServiceProvider.GetRequiredService<AppDbContext>()).IsEnabledAsync())
        { provider.Dispose(); throw new InvalidOperationException("Connected database is not the approved isolated target."); }
        return provider;
    }
    private static async Task<ServiceResult<esham.BLL.DTOs.Enrollments.EnrollmentPurchase>> Purchase(ServiceProvider p, Fixture d, esham.BLL.DTOs.Enrollments.PurchaseEnrollmentRequest request)
    {
        using var scope = p.CreateScope(); var s = scope.ServiceProvider;
        return await Service(s, Gate(s.GetRequiredService<AppDbContext>())).PurchaseAsync(Principal(d.Learner), request);
    }

    [Phase1SqlFact] public async Task Gate_checks_connected_database_not_just_connection_configuration()
    {
        using var p = await VerifiedProvider(); using var scope = p.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.Database.OpenConnectionAsync();
        try
        {
            await db.Database.GetDbConnection().ChangeDatabaseAsync("master");
            Assert.False(await Gate(db).IsEnabledAsync());
            await db.Database.GetDbConnection().ChangeDatabaseAsync(Environment.GetEnvironmentVariable("ESHAM_APPROVED_ISOLATED_DATABASE")!);
            Assert.True(await Gate(db).IsEnabledAsync());
        }
        finally { await db.Database.CloseConnectionAsync(); }
    }

    [Phase1SqlTheory] [InlineData(true)] [InlineData(false)]
    public async Task Both_publication_purchase_lock_orders_preserve_fees_and_original_attribution(bool publicationFirst)
    {
        using var p = await VerifiedProvider(); Fixture d; Guid nextId;
        using (var setup = p.CreateScope())
        {
            d = await Setup(setup.ServiceProvider); var db = setup.ServiceProvider.GetRequiredService<AppDbContext>();
            var original = await db.CourseVersions.SingleAsync(x => x.Id == d.Version);
            var next = new CourseVersion { CourseId = d.Course, CategoryId = original.CategoryId, VersionNumber = 2, TitleEn = "New publication", ReviewStatus = "approved", ApprovedAt = DateTimeOffset.UtcNow };
            db.Add(next); await db.SaveChangesAsync(); nextId = next.Id;
        }
        async Task Publish()
        {
            using var scope = p.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
            {
                db.ChangeTracker.Clear(); await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
                var course = await db.Courses.FromSqlInterpolated($"SELECT * FROM [Courses] WITH (UPDLOCK,HOLDLOCK) WHERE [Id]={d.Course}").SingleAsync();
                var next = await db.CourseVersions.SingleAsync(x => x.Id == nextId); course.PublishedVersionId = nextId;
                await new CourseVersionUpdates(db, new NotificationWriter(db)).StagePublicationAsync(course, next, d.Version);
                await db.SaveChangesAsync(); await tx.CommitAsync();
            });
        }
        if (publicationFirst) await Publish();
        var result = await Purchase(p, d, d.Request());
        if (!publicationFirst) await Publish();
        using var verify = p.CreateScope(); var check = verify.ServiceProvider.GetRequiredService<AppDbContext>();
        if (publicationFirst)
        {
            Assert.Equal("publication_changed", result.Code); Assert.False(await check.Enrollments.AnyAsync(x => x.CourseId == d.Course));
            Assert.Equal(20, (await check.Wallets.SingleAsync(x => x.UserId == d.Learner)).Balance); Assert.Equal(20, (await check.Wallets.SingleAsync(x => x.UserId == d.Owner)).Balance);
        }
        else
        {
            Assert.Equal(ServiceFailure.None, result.Failure); var enrollment = await check.Enrollments.SingleAsync(x => x.CourseId == d.Course);
            Assert.Equal(d.Version, enrollment.CourseVersionId); Assert.Equal(2, await check.EnrollmentVersionAccess.CountAsync(x => x.EnrollmentId == enrollment.Id));
            Assert.Equal(2, await check.PointTransactions.CountAsync(x => x.EnrollmentId == enrollment.Id));
            Assert.Equal(0, (await check.Wallets.SingleAsync(x => x.UserId == d.Learner)).Balance); Assert.Equal(40, (await check.Wallets.SingleAsync(x => x.UserId == d.Owner)).Balance);
        }
    }

    [Phase1SqlTheory] [InlineData("learner")] [InlineData("both")]
    public async Task Atomic_success_and_actual_membership_owned_reads_are_verified_relationally(string persona)
    {
        using var p = await VerifiedProvider(); Fixture d, other;
        using (var setup = p.CreateScope()) { d = await Setup(setup.ServiceProvider, persona); other = await Setup(setup.ServiceProvider); }
        var result = await Purchase(p, d, d.Request()); Assert.Equal(ServiceFailure.None, result.Failure);
        using var scope = p.CreateScope(); var s = scope.ServiceProvider; var db = s.GetRequiredService<AppDbContext>(); var service = Service(s, Gate(db));
        Assert.Equal(ServiceFailure.None, (await service.GetAsync(Principal(d.Learner), result.Value!.Enrollment.Id)).Failure);
        Assert.Equal(ServiceFailure.NotFound, (await service.GetAsync(Principal(other.Learner), result.Value.Enrollment.Id)).Failure);
        Assert.Empty((await service.ListAsync(Principal(other.Learner))).Value!.Items);
        var forged = new System.Security.Claims.ClaimsPrincipal(new System.Security.Claims.ClaimsIdentity([
            new System.Security.Claims.Claim(System.Security.Claims.ClaimTypes.NameIdentifier, d.Owner),
            new System.Security.Claims.Claim(System.Security.Claims.ClaimTypes.Role, "Learner")], "forged"));
        Assert.Equal(ServiceFailure.Forbidden, (await service.PurchaseAsync(forged, d.Request())).Failure);
        var wallets = new WalletService(db, s.GetRequiredService<Microsoft.AspNetCore.Identity.UserManager<ApplicationUser>>());
        Assert.Equal(20, (await wallets.HistoryAsync(Principal(other.Learner))).Value!.Items.Single().Amount);
        Assert.Equal(0, (await wallets.SummaryAsync(Principal(d.Learner))).Value!.Balance);
        Assert.Equal(40, (await wallets.SummaryAsync(Principal(d.Owner))).Value!.Balance);
        Assert.Equal(20, (await wallets.TeachingAsync(Principal(d.Owner))).Value!.TotalEarned);
        Assert.Equal(2, await db.PointTransactions.CountAsync(x => x.EnrollmentId == result.Value.Enrollment.Id));
        Assert.Equal(1, await db.EnrollmentVersionAccess.CountAsync(x => x.EnrollmentId == result.Value.Enrollment.Id));
        Assert.Equal(1, await db.PointTransactions.CountAsync(x => x.UserId == d.Learner && x.TransactionType == "welcome"));
    }

    [Phase1SqlFact] public async Task Version_access_staging_failure_after_intermediate_persistence_rolls_back_every_component()
    {
        using var p = await VerifiedProvider(); Fixture d; using (var setup = p.CreateScope()) d = await Setup(setup.ServiceProvider);
        using (var scope = p.CreateScope())
        {
            var s = scope.ServiceProvider; var db = s.GetRequiredService<AppDbContext>();
            var service = new EnrollmentService(db, s.GetRequiredService<Microsoft.AspNetCore.Identity.UserManager<ApplicationUser>>(), s.GetRequiredService<AccountService>(), new FailDuringAccess(db), Gate(db));
            await Assert.ThrowsAsync<InvalidOperationException>(() => service.PurchaseAsync(Principal(d.Learner), d.Request()));
        }
        using var verify = p.CreateScope(); var check = verify.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.False(await check.Enrollments.AnyAsync(x => x.CourseId == d.Course)); Assert.False(await check.EnrollmentVersionAccess.AnyAsync(x => x.CourseId == d.Course));
        Assert.False(await check.PointTransactions.AnyAsync(x => (x.UserId == d.Learner || x.UserId == d.Owner) && x.EnrollmentId != null));
        Assert.Equal(20, (await check.Wallets.SingleAsync(x => x.UserId == d.Learner)).Balance); Assert.Equal(20, (await check.Wallets.SingleAsync(x => x.UserId == d.Owner)).Balance);
    }

    [Phase1SqlTheory]
    [InlineData("same-request")] [InlineData("duplicate")] [InlineData("cross-course-key")]
    [InlineData("cross-spend")] [InlineData("shared-recipient")]
    public async Task Concurrent_requests_never_duplicate_or_partially_transfer(string mode)
    {
        using var p = await VerifiedProvider(); Fixture first, second;
        using (var scope = p.CreateScope())
        {
            first = await Setup(scope.ServiceProvider); second = await Setup(scope.ServiceProvider);
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            (await db.Courses.SingleAsync(x => x.Id == second.Course)).OwnerUserId = first.Owner; await db.SaveChangesAsync();
            second = second with { Owner = first.Owner, Learner = mode == "shared-recipient" ? second.Learner : first.Learner };
        }
        var request = first.Request();
        var next = mode switch { "same-request" => request, "duplicate" => first.Request(), "cross-course-key" => second.Request(request.RequestId), _ => second.Request() };
        var gate = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        async Task<ServiceResult<esham.BLL.DTOs.Enrollments.EnrollmentPurchase>> Run(Fixture d, esham.BLL.DTOs.Enrollments.PurchaseEnrollmentRequest r) { await gate.Task; return await Purchase(p, d, r); }
        var tasks = new[] { Run(first, request), Run(mode is "same-request" or "duplicate" ? first : second, next) }; gate.SetResult();
        var results = await Task.WhenAll(tasks);
        var successCount = mode == "shared-recipient" ? 2 : 1;
        Assert.Equal(mode == "same-request" ? 2 : successCount, results.Count(x => x.Failure == ServiceFailure.None));
        using var verify = p.CreateScope(); var check = verify.ServiceProvider.GetRequiredService<AppDbContext>();
        var enrollments = await check.Enrollments.Where(x => x.CourseId == first.Course || x.CourseId == second.Course).ToListAsync(); Assert.Equal(successCount, enrollments.Count);
        var ids = enrollments.Select(x => x.Id).ToArray(); var entries = await check.PointTransactions.Where(x => x.EnrollmentId != null && ids.Contains(x.EnrollmentId.Value)).ToListAsync();
        Assert.Equal(2 * successCount, entries.Count); Assert.Equal(0, entries.Sum(x => x.Amount));
        Assert.Equal(20 + 20 * successCount, (await check.Wallets.SingleAsync(x => x.UserId == first.Owner)).Balance);
        Assert.Equal(0, (await check.Wallets.SingleAsync(x => x.UserId == first.Learner)).Balance);
        Assert.Equal(successCount, await check.EnrollmentVersionAccess.CountAsync(x => ids.Contains(x.EnrollmentId)));
        if (mode == "same-request") Assert.Single(results, x => x.Value!.Replayed);
    }

    [Phase1SqlFact] public async Task Failure_after_save_rolls_back_enrollment_wallets_ledger_and_access()
    {
        var failure = new FailAfterSave(); using var p = await VerifiedProvider(failure); Fixture d;
        using (var scope = p.CreateScope()) d = await Setup(scope.ServiceProvider);
        failure.Armed = true;
        await Assert.ThrowsAsync<InvalidOperationException>(() => Purchase(p, d, d.Request()));
        using var verify = p.CreateScope(); var db = verify.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.False(await db.Enrollments.AnyAsync(x => x.LearnerUserId == d.Learner && x.CourseId == d.Course));
        Assert.Equal(20, (await db.Wallets.SingleAsync(x => x.UserId == d.Learner)).Balance); Assert.Equal(20, (await db.Wallets.SingleAsync(x => x.UserId == d.Owner)).Balance);
        Assert.False(await db.PointTransactions.AnyAsync(x => (x.UserId == d.Learner || x.UserId == d.Owner) && x.EnrollmentId != null));
        Assert.False(await db.EnrollmentVersionAccess.AnyAsync(x => x.CourseId == d.Course));
    }

    [Phase1SqlFact] public async Task Lost_response_is_recovered_in_a_new_scope_after_wallet_balance_changed()
    {
        using var p = await VerifiedProvider(); Fixture d; using (var scope = p.CreateScope()) d = await Setup(scope.ServiceProvider);
        var request = d.Request(); var ignoredResponse = await Purchase(p, d, request); Assert.Equal(ServiceFailure.None, ignoredResponse.Failure);
        var replay = await Purchase(p, d, request); Assert.True(replay.Value!.Replayed); Assert.Equal(ignoredResponse.Value!.Enrollment.Id, replay.Value.Enrollment.Id);
    }

    [Phase1SqlFact] public async Task Lost_commit_acknowledgement_retries_to_the_existing_purchase()
    {
        var failure = new LostCommit(); using var p = await VerifiedProvider(failure); Fixture d;
        using (var scope = p.CreateScope()) d = await Setup(scope.ServiceProvider);
        var request = d.Request(); failure.Armed = true;
        var result = await Purchase(p, d, request); Assert.Equal(ServiceFailure.None, result.Failure); Assert.True(result.Value!.Replayed); Assert.True(failure.Injected);
        using var verify = p.CreateScope(); var db = verify.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(1, await db.Enrollments.CountAsync(x => x.CourseId == d.Course));
        Assert.Equal(2, await db.PointTransactions.CountAsync(x => x.EnrollmentId == result.Value.Enrollment.Id));
        Assert.Equal(0, (await db.Wallets.SingleAsync(x => x.UserId == d.Learner)).Balance);
    }

    [Phase1SqlFact] public async Task Transient_save_failure_retries_with_fresh_wallet_and_enrollment_state()
    {
        var failure = new TransientSave(); using var p = await VerifiedProvider(failure); Fixture d;
        using (var scope = p.CreateScope()) d = await Setup(scope.ServiceProvider);
        failure.Armed = true;
        var result = await Purchase(p, d, d.Request()); Assert.Equal(ServiceFailure.None, result.Failure); Assert.True(failure.Injected);
        using var verify = p.CreateScope(); var db = verify.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(1, await db.Enrollments.CountAsync(x => x.CourseId == d.Course)); Assert.Equal(2, await db.PointTransactions.CountAsync(x => x.EnrollmentId == result.Value!.Enrollment.Id));
        Assert.Equal(40, (await db.Wallets.SingleAsync(x => x.UserId == d.Owner)).Balance);
    }

    [Phase1SqlFact] public async Task Publication_race_preserves_original_purchase_or_rejects_stale_confirmation_without_fee()
    {
        using var p = await VerifiedProvider(); Fixture d; Guid newVersion;
        using (var setup = p.CreateScope())
        {
            d = await Setup(setup.ServiceProvider); var db = setup.ServiceProvider.GetRequiredService<AppDbContext>();
            var old = await db.CourseVersions.SingleAsync(x => x.Id == d.Version);
            var next = new CourseVersion { CourseId = d.Course, CategoryId = old.CategoryId, VersionNumber = 2, TitleEn = "Next publication", ReviewStatus = "approved", ApprovedAt = DateTimeOffset.UtcNow };
            db.Add(next); await db.SaveChangesAsync(); newVersion = next.Id;
        }
        var gate = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        async Task Publish()
        {
            await gate.Task; using var scope = p.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
            {
                db.ChangeTracker.Clear(); await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
                var course = await db.Courses.FromSqlInterpolated($"SELECT * FROM [Courses] WITH (UPDLOCK,HOLDLOCK) WHERE [Id]={d.Course}").SingleAsync();
                var version = await db.CourseVersions.SingleAsync(x => x.Id == newVersion); course.PublishedVersionId = newVersion;
                await new CourseVersionUpdates(db, new NotificationWriter(db)).StagePublicationAsync(course, version, d.Version);
                await db.SaveChangesAsync(); await tx.CommitAsync();
            });
        }
        async Task<ServiceResult<esham.BLL.DTOs.Enrollments.EnrollmentPurchase>> Buy() { await gate.Task; return await Purchase(p, d, d.Request()); }
        var publish = Publish(); var buy = Buy(); gate.SetResult(); await Task.WhenAll(publish, buy);
        using var verify = p.CreateScope(); var check = verify.ServiceProvider.GetRequiredService<AppDbContext>();
        if (buy.Result.Failure == ServiceFailure.None)
        {
            var e = await check.Enrollments.SingleAsync(x => x.CourseId == d.Course); Assert.Equal(d.Version, e.CourseVersionId);
            Assert.Equal(2, await check.EnrollmentVersionAccess.CountAsync(x => x.EnrollmentId == e.Id));
            Assert.Equal(2, await check.PointTransactions.CountAsync(x => x.EnrollmentId == e.Id));
        }
        else { Assert.Equal("publication_changed", buy.Result.Code); Assert.False(await check.Enrollments.AnyAsync(x => x.CourseId == d.Course)); Assert.Equal(20, (await check.Wallets.SingleAsync(x => x.UserId == d.Learner)).Balance); }
    }
    private sealed class FailAfterSave : SaveChangesInterceptor
    {
        public bool Armed;
        public override ValueTask<int> SavedChangesAsync(SaveChangesCompletedEventData data, int result, CancellationToken ct = default)
        { if (Armed && data.Context!.ChangeTracker.Entries<Enrollment>().Any()) { Armed = false; throw new InvalidOperationException("Injected purchase save failure."); } return ValueTask.FromResult(result); }
    }
    private sealed class FailDuringAccess(AppDbContext db) : ICourseVersionUpdates
    {
        private readonly CourseVersionUpdates inner = new(db, new NotificationWriter(db));
        public async Task StageEnrollmentAsync(Enrollment enrollment, CancellationToken ct = default)
        { await inner.StageEnrollmentAsync(enrollment, ct); await db.SaveChangesAsync(ct); throw new InvalidOperationException("Injected access-staging failure after save."); }
        public Task StagePublicationAsync(Course course, CourseVersion version, Guid? previous, CancellationToken ct = default) => inner.StagePublicationAsync(course, version, previous, ct);
        public Task<ServiceResult<esham.BLL.DTOs.Courses.EnrollmentVersionState>> GetStateAsync(Guid id, string learner, CancellationToken ct = default) => inner.GetStateAsync(id, learner, ct);
    }
    private sealed class LostCommit : DbTransactionInterceptor
    {
        public bool Armed, Injected;
        public override Task TransactionCommittedAsync(DbTransaction transaction, TransactionEndEventData data, CancellationToken ct = default)
        { if (Armed) { Armed = false; Injected = true; throw new TimeoutException("Injected commit acknowledgement loss."); } return Task.CompletedTask; }
    }
    private sealed class TransientSave : SaveChangesInterceptor
    {
        public bool Armed, Injected;
        public override ValueTask<InterceptionResult<int>> SavingChangesAsync(DbContextEventData data, InterceptionResult<int> result, CancellationToken ct = default)
        { if (Armed && data.Context!.ChangeTracker.Entries<Enrollment>().Any(x => x.State == EntityState.Added)) { Armed = false; Injected = true; throw new TimeoutException("Injected purchase save timeout."); } return ValueTask.FromResult(result); }
    }
}
