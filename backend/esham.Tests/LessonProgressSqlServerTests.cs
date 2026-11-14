using System.Data;
using System.Data.Common;
using esham.BLL.DTOs;
using esham.BLL.DTOs.Learning;
using esham.BLL.Services;
using esham.DAL.Data;
using esham.DAL.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Xunit;
using static esham.Tests.AccountFinalizationTests;
using static esham.Tests.AccountFinalizationSqlServerTests;
using static esham.Tests.LearnerLearningTests;
namespace esham.Tests;

public sealed class LessonProgressSqlServerTests
{
    internal static LearningProgressWriteGate Gate(AppDbContext db) => new(db, Options.Create(new LearningProgressOptions { Enabled = true, ApprovedIsolatedDatabase = Phase1IsolatedEnvironmentTests.ApprovedCatalog }));
    internal static async Task<ServiceProvider> Provider(params IInterceptor[] interceptors)
    {
        if (!EnrollmentSqlServerTests.Configured()) throw new InvalidOperationException("Explicit isolated SQL opt-in required.");
        var p = DatabaseServices(interceptors); using var scope = p.CreateScope();
        if (!await Gate(scope.ServiceProvider.GetRequiredService<AppDbContext>()).IsEnabledAsync()) { p.Dispose(); throw new InvalidOperationException("Actual database/instance is not the approved LocalDB target."); }
        return p;
    }
    internal static async Task<LearningFixture> Fixture(ServiceProvider p)
    {
        using var scope = p.CreateScope(); var s = scope.ServiceProvider; var db = s.GetRequiredService<AppDbContext>();
        Assert.True(await Gate(db).IsEnabledAsync()); // BEFORE identities, wallets or curriculum are written.
        var f = await EnrollmentTests.Setup(s, "both");
        var purchaseGate = new EnrollmentPurchaseGate(db, Options.Create(new EnrollmentPurchaseOptions { Enabled = true, ApprovedIsolatedDatabase = Phase1IsolatedEnvironmentTests.ApprovedCatalog }));
        var purchase = await EnrollmentTests.Service(s, purchaseGate).PurchaseAsync(Principal(f.Learner), f.Request()); Assert.Equal(ServiceFailure.None, purchase.Failure);
        return await Curriculum(s, f, purchase.Value!.Enrollment.Id);
    }
    private static async Task<ServiceResult<ProgressState>> Complete(ServiceProvider p, LearningFixture f)
    {
        using var scope = p.CreateScope(); var s = scope.ServiceProvider;
        return await Writes(s, Gate(s.GetRequiredService<AppDbContext>())).CompleteAsync(Principal(f.Purchase.Learner), f.Enrollment, f.Lesson, new(f.Purchase.Version));
    }
    private static async Task<ProgressState> Read(ServiceProvider p, LearningFixture f)
    {
        using var scope = p.CreateScope(); var s = scope.ServiceProvider;
        return (await Reads(s, Gate(s.GetRequiredService<AppDbContext>())).LessonAsync(Principal(f.Purchase.Learner), f.Enrollment, f.Lesson)).Value!.Progress;
    }
    private static async Task<ServiceResult<ProgressState>> Position(ServiceProvider p, LearningFixture f, string token, double position, bool open = false)
    {
        using var scope = p.CreateScope(); var s = scope.ServiceProvider;
        return await Writes(s, Gate(s.GetRequiredService<AppDbContext>())).WriteAsync(Principal(f.Purchase.Learner), f.Enrollment, f.Lesson, new(f.Purchase.Version, token, position), open);
    }
    [Phase1SqlFact] public async Task Concurrent_first_completion_inserts_once_and_preserves_first_timestamp()
    {
        using var p = await Provider(); var f = await Fixture(p);
        var results = await Task.WhenAll(Enumerable.Range(0, 6).Select(_ => Complete(p, f)));
        Assert.All(results, x => Assert.Equal(ServiceFailure.None, x.Failure)); Assert.Single(results.Select(x => x.Value!.CompletedAt).Distinct());
        using var scope = p.CreateScope(); Assert.Single(await scope.ServiceProvider.GetRequiredService<AppDbContext>().LessonProgressRecords.Where(x => x.EnrollmentId == f.Enrollment).ToListAsync());
    }
    [Phase1SqlFact] public async Task Concurrent_first_position_and_exact_replays_conflict_without_overwrite()
    {
        using var p = await Provider(); var f = await Fixture(p); var initial = await Read(p, f);
        var results = await Task.WhenAll(Position(p, f, initial.ProgressToken, 30), Position(p, f, initial.ProgressToken, 30));
        Assert.Single(results, x => x.Failure == ServiceFailure.None); Assert.Single(results, x => x.Code == "progress_conflict");
        var canonical = await Read(p, f); Assert.Equal(30, canonical.LastPositionSeconds);
        Assert.Equal("progress_conflict", (await Position(p, f, initial.ProgressToken, 30)).Code);
        var same = await Position(p, f, canonical.ProgressToken, 30); Assert.NotEqual(canonical.ProgressToken, same.Value!.ProgressToken);
        var back = await Position(p, f, same.Value.ProgressToken, 5); Assert.Equal(5, back.Value!.LastPositionSeconds);
    }
    [Phase1SqlFact] public async Task Completion_position_and_open_races_never_clear_completion()
    {
        using var p = await Provider(); var f = await Fixture(p); var initial = await Read(p, f);
        await Task.WhenAll(Complete(p, f), Position(p, f, initial.ProgressToken, 50));
        var saved = await Read(p, f); Assert.True(saved.IsCompleted); var first = saved.CompletedAt;
        await Position(p, f, saved.ProgressToken, 0, true); var opened = await Read(p, f); Assert.True(opened.IsCompleted); Assert.Equal(first, opened.CompletedAt);
    }
    [Phase1SqlFact] public async Task Timestamp_precision_and_repeated_positions_produce_distinct_tokens()
    {
        using var p = await Provider(); var f = await Fixture(p); var state = await Read(p, f);
        await Position(p, f, state.ProgressToken, 1);
        using (var scope = p.CreateScope()) {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var record = await db.LessonProgressRecords.SingleAsync(x => x.EnrollmentId == f.Enrollment);
            record.UpdatedAt = DateTimeOffset.UtcNow.AddDays(1); await db.SaveChangesAsync();
        }
        state = await Read(p, f); var tokens = new HashSet<string> { state.ProgressToken };
        for (var i = 0; i < 12; i++) { state = (await Position(p, f, state.ProgressToken, 1)).Value!; Assert.True(tokens.Add(state.ProgressToken)); }
        Assert.Equal(state.ProgressToken, (await Read(p, f)).ProgressToken);
    }
    [Phase1SqlFact] public async Task Failure_after_persistence_rolls_back_progress_and_activity()
    {
        var fail = new FailAfterSave(); using var p = await Provider(fail); var f = await Fixture(p); fail.Armed = true;
        await Assert.ThrowsAsync<InvalidOperationException>(() => Complete(p, f));
        using var scope = p.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.False(await db.LessonProgressRecords.AnyAsync(x => x.EnrollmentId == f.Enrollment)); Assert.Null((await db.Enrollments.SingleAsync(x => x.Id == f.Enrollment)).LastOpenedAt);
    }
    [Phase1SqlFact] public async Task Transient_save_retries_with_fresh_tracking()
    {
        var fail = new TransientSave(); using var p = await Provider(fail); var f = await Fixture(p); fail.Armed = true;
        Assert.Equal(ServiceFailure.None, (await Complete(p, f)).Failure); Assert.True(fail.Injected); Assert.True((await Read(p, f)).IsCompleted);
    }
    [Phase1SqlFact] public async Task Lost_commit_completion_reconciles_and_position_returns_canonical_conflict()
    {
        var fail = new LostCommit(); using var p = await Provider(fail); var f = await Fixture(p); fail.Armed = true;
        Assert.Equal(ServiceFailure.None, (await Complete(p, f)).Failure); Assert.True(fail.Injected);
        var initial = await Read(p, f); fail.Armed = true;
        var result = await Position(p, f, initial.ProgressToken, 25); Assert.Equal("progress_conflict", result.Code); Assert.Equal(25, result.Value!.LastPositionSeconds); Assert.True(result.Value.IsCompleted);
    }
    internal static async Task<(Guid Version, Guid Lesson)> NextVersion(ServiceProvider p, LearningFixture f, bool sameVideo = true)
    {
        using var scope = p.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDbContext>(); Assert.True(await Gate(db).IsEnabledAsync());
        var old = await db.CourseVersions.SingleAsync(x => x.Id == f.Purchase.Version); var lesson = await db.Lessons.SingleAsync(x => x.Id == f.Lesson);
        var next = new CourseVersion { CourseId = old.CourseId, CategoryId = old.CategoryId, VersionNumber = 2, TitleEn = "Phase2 updated", ReviewStatus = "approved", ApprovedAt = DateTimeOffset.UtcNow };
        var section = new CourseSection { CourseVersionId = next.Id, TitleEn = "Updated section" };
        var copy = new Lesson { CourseSectionId = section.Id, LogicalLessonId = lesson.LogicalLessonId, TitleEn = "Updated video", PrimaryVideoMediaAssetId = sameVideo ? lesson.PrimaryVideoMediaAssetId : null };
        db.AddRange(next, section, copy); await db.SaveChangesAsync(); return (next.Id, copy.Id);
    }
    internal static async Task Publish(ServiceProvider p, LearningFixture f, Guid next)
    {
        using var scope = p.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDbContext>(); Assert.True(await Gate(db).IsEnabledAsync());
        await db.Database.CreateExecutionStrategy().ExecuteAsync(async () => {
            db.ChangeTracker.Clear(); await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
            var course = await db.Courses.FromSqlInterpolated($"SELECT * FROM [Courses] WITH (UPDLOCK,HOLDLOCK) WHERE [Id]={f.Purchase.Course}").SingleAsync();
            var version = await db.CourseVersions.SingleAsync(x => x.Id == next); course.PublishedVersionId = next;
            await new CourseVersionUpdates(db, new NotificationWriter(db)).StagePublicationAsync(course, version, f.Purchase.Version);
            await db.SaveChangesAsync(); await tx.CommitAsync();
        });
    }
    [Phase1SqlFact] public async Task Publication_race_preserves_evidence_or_rejects_stale_write_without_retargeting()
    {
        using var p = await Provider(); var f = await Fixture(p); var next = await NextVersion(p, f);
        var barrier = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        async Task<ServiceResult<ProgressState>> Write() { await barrier.Task; return await Complete(p, f); }
        async Task Update() { await barrier.Task; await Publish(p, f, next.Version); }
        var write = Write(); var update = Update(); barrier.SetResult(); await Task.WhenAll(write, update);
        using var scope = p.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var evidence = await db.LessonProgressRecords.Where(x => x.EnrollmentId == f.Enrollment).ToListAsync();
        if (write.Result.Failure == ServiceFailure.None) Assert.Equal(f.Lesson, Assert.Single(evidence).LessonId);
        else { Assert.Contains(write.Result.Failure, new[] { ServiceFailure.NotFound, ServiceFailure.Conflict }); Assert.Empty(evidence); }
        Assert.Equal(f.Purchase.Version, (await db.Enrollments.SingleAsync(x => x.Id == f.Enrollment)).CourseVersionId);
    }
    [Phase1SqlTheory] [InlineData(true)] [InlineData(false)]
    public async Task Same_video_resume_inherits_but_changed_video_does_not_and_history_survives(bool sameVideo)
    {
        using var p = await Provider(); var f = await Fixture(p); var initial = await Read(p, f); await Position(p, f, initial.ProgressToken, 45); await Complete(p, f);
        var next = await NextVersion(p, f, sameVideo); await Publish(p, f, next.Version);
        using var scope = p.CreateScope(); var s = scope.ServiceProvider; var db = s.GetRequiredService<AppDbContext>(); var actor = Principal(f.Purchase.Learner);
        var inherited = (await Reads(s, Gate(db)).LessonAsync(actor, f.Enrollment, next.Lesson)).Value!;
        Assert.True(inherited.Progress.IsCompleted); Assert.Equal(sameVideo ? 45d : null, inherited.Progress.ResumePositionSeconds);
        var open = await Writes(s, Gate(db)).WriteAsync(actor, f.Enrollment, next.Lesson, new(next.Version, inherited.Progress.ProgressToken), true);
        Assert.Equal(sameVideo ? 45 : 0, open.Value!.LastPositionSeconds); Assert.True(open.Value.IsCompleted);
        Assert.Equal(ServiceFailure.NotFound, (await Reads(s, Gate(db)).LessonAsync(actor, f.Enrollment, f.Lesson)).Failure);
        var old = await db.LessonProgressRecords.AsNoTracking().SingleAsync(x => x.EnrollmentId == f.Enrollment && x.LessonId == f.Lesson); Assert.True(old.IsCompleted); Assert.Equal(45, old.LastPositionSeconds);
    }
    [Phase1SqlFact] public async Task Invalid_duration_and_changed_actual_database_fail_closed()
    {
        using var p = await Provider(); var f = await Fixture(p);
        using var scope = p.CreateScope(); var s = scope.ServiceProvider; var db = s.GetRequiredService<AppDbContext>();
        var asset = await db.MediaAssets.SingleAsync(x => x.PrimaryVideoForLessons.Any(l => l.Id == f.Lesson)); asset.DurationSeconds = null; await db.SaveChangesAsync();
        var initial = await Read(p, f); Assert.Null(initial.ResumePositionSeconds);
        Assert.Equal(ServiceFailure.Validation, (await Position(p, f, initial.ProgressToken, 1)).Failure);
        Assert.False(await db.LessonProgressRecords.AnyAsync(x => x.EnrollmentId == f.Enrollment));
        await db.Database.OpenConnectionAsync();
        try {
            await db.Database.GetDbConnection().ChangeDatabaseAsync("master"); Assert.False(await Gate(db).IsEnabledAsync());
            await db.Database.GetDbConnection().ChangeDatabaseAsync(Phase1IsolatedEnvironmentTests.ApprovedCatalog); Assert.True(await Gate(db).IsEnabledAsync());
        } finally { await db.Database.CloseConnectionAsync(); }
    }
    [Phase1SqlFact] public async Task All_lessons_complete_with_required_task_is_not_course_completion_and_invariants_hold()
    {
        using var p = await Provider(); var f = await Fixture(p);
        using (var setup = p.CreateScope()) { var db = setup.ServiceProvider.GetRequiredService<AppDbContext>(); db.CourseTasks.Add(new() { CourseVersionId = f.Purchase.Version, TitleEn = "Required task" }); await db.SaveChangesAsync(); }
        using var scope = p.CreateScope(); var s = scope.ServiceProvider; var check = s.GetRequiredService<AppDbContext>();
        var balances = await check.Wallets.Where(x => x.UserId == f.Purchase.Learner || x.UserId == f.Purchase.Owner).OrderBy(x => x.UserId).Select(x => x.Balance).ToListAsync();
        var ledger = await check.PointTransactions.CountAsync(x => x.EnrollmentId == f.Enrollment); var receipts = await check.EnrollmentVersionAccess.CountAsync(x => x.EnrollmentId == f.Enrollment);
        await Complete(p, f); await Writes(s, Gate(check)).CompleteAsync(Principal(f.Purchase.Learner), f.Enrollment, f.Article, new(f.Purchase.Version));
        var course = (await Reads(s, Gate(check)).GetAsync(Principal(f.Purchase.Learner), f.Enrollment)).Value!;
        Assert.Equal(100, course.LessonCoveragePercentage); Assert.False(course.VersionState.IsCourseCompleted); Assert.False(course.VersionState.MeetsCurrentRequirements); Assert.True(course.VersionState.ProgressPercentage < 100);
        Assert.Equal(balances, await check.Wallets.AsNoTracking().Where(x => x.UserId == f.Purchase.Learner || x.UserId == f.Purchase.Owner).OrderBy(x => x.UserId).Select(x => x.Balance).ToListAsync());
        Assert.Equal(ledger, await check.PointTransactions.CountAsync(x => x.EnrollmentId == f.Enrollment)); Assert.Equal(receipts, await check.EnrollmentVersionAccess.CountAsync(x => x.EnrollmentId == f.Enrollment));
        var enrollment = await check.Enrollments.AsNoTracking().SingleAsync(x => x.Id == f.Enrollment); Assert.Equal("active", enrollment.Status); Assert.Null(enrollment.CompletedAt); Assert.Equal(f.Purchase.Version, enrollment.CourseVersionId);
        Assert.False(await check.Certificates.AnyAsync(x => x.EnrollmentId == f.Enrollment)); Assert.False(await check.TaskSubmissions.AnyAsync(x => x.EnrollmentId == f.Enrollment));
    }
    private sealed class FailAfterSave : SaveChangesInterceptor
    {
        public bool Armed;
        public override ValueTask<int> SavedChangesAsync(SaveChangesCompletedEventData data, int result, CancellationToken ct = default)
        { if (Armed && data.Context!.ChangeTracker.Entries<LessonProgress>().Any()) { Armed = false; throw new InvalidOperationException("Injected progress failure."); } return ValueTask.FromResult(result); }
    }
    private sealed class TransientSave : SaveChangesInterceptor
    {
        public bool Armed, Injected;
        public override ValueTask<InterceptionResult<int>> SavingChangesAsync(DbContextEventData data, InterceptionResult<int> result, CancellationToken ct = default)
        { if (Armed && data.Context!.ChangeTracker.Entries<LessonProgress>().Any()) { Armed = false; Injected = true; throw new TimeoutException("Injected progress retry."); } return ValueTask.FromResult(result); }
    }
    private sealed class LostCommit : DbTransactionInterceptor
    {
        public bool Armed, Injected;
        public override Task TransactionCommittedAsync(DbTransaction transaction, TransactionEndEventData data, CancellationToken ct = default)
        { if (Armed) { Armed = false; Injected = true; throw new TimeoutException("Injected acknowledgement loss."); } return Task.CompletedTask; }
    }
}
