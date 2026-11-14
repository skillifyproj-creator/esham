using esham.BLL.DTOs;
using esham.BLL.DTOs.Courses;
using esham.BLL.DTOs.Learning;
using esham.BLL.Interfaces;
using esham.BLL.Services;
using esham.DAL.Data;
using esham.DAL.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
using static esham.Tests.AccountFinalizationTests;
namespace esham.Tests;

public sealed class LearnerLearningTests
{
    internal sealed class MemoryGate(AppDbContext db, bool enabled = true) : ILearningProgressWriteGate
    {
        public Task<bool> IsEnabledAsync(CancellationToken ct = default) => db.Database.IsInMemory()
            ? Task.FromResult(enabled) : throw new InvalidOperationException("Memory-only test gate.");
    }
    internal sealed class MemoryStorage : IMediaStorage
    {
        public Task<StoredMediaFile> SaveAsync(Stream input, string contentType, CancellationToken ct) => throw new NotSupportedException();
        public Task DeleteAsync(string key, CancellationToken ct) => throw new NotSupportedException();
        public Task<Stream?> OpenAsync(string key, CancellationToken ct) => Task.FromResult<Stream?>(Guid.TryParseExact(key, "N", out _) ? new MemoryStream(new byte[512]) : null);
    }
    internal static LearnerLearningAccess Access(IServiceProvider s) => new(s.GetRequiredService<AppDbContext>(), s.GetRequiredService<Microsoft.AspNetCore.Identity.UserManager<ApplicationUser>>(), s.GetRequiredService<AccountService>());
    internal static LearnerLearningService Reads(IServiceProvider s, ILearningProgressWriteGate? gate = null) => new(s.GetRequiredService<AppDbContext>(), Access(s),
        new CourseVersionUpdates(s.GetRequiredService<AppDbContext>(), new NotificationWriter(s.GetRequiredService<AppDbContext>())), new MemoryStorage(), gate ?? new MemoryGate(s.GetRequiredService<AppDbContext>()));
    internal static LessonProgressService Writes(IServiceProvider s, ILearningProgressWriteGate? gate = null) => new(s.GetRequiredService<AppDbContext>(), Access(s), gate ?? new MemoryGate(s.GetRequiredService<AppDbContext>()),
        new CourseVersionUpdates(s.GetRequiredService<AppDbContext>(), new NotificationWriter(s.GetRequiredService<AppDbContext>())));
    internal sealed record LearningFixture(EnrollmentTests.Fixture Purchase, Guid Enrollment, Guid Lesson, Guid Article, Guid Attachment);
    internal static async Task<LearningFixture> Setup(IServiceProvider s, string persona = "learner")
    {
        var f = await EnrollmentTests.Setup(s, persona); var db = s.GetRequiredService<AppDbContext>();
        var purchase = await EnrollmentTests.Service(s).PurchaseAsync(Principal(f.Learner), f.Request());
        Assert.Equal(ServiceFailure.None, purchase.Failure);
        return await Curriculum(s, f, purchase.Value!.Enrollment.Id);
    }
    internal static async Task<LearningFixture> Curriculum(IServiceProvider s, EnrollmentTests.Fixture f, Guid enrollment)
    {
        var db = s.GetRequiredService<AppDbContext>();
        var section = new CourseSection { CourseVersionId = f.Version, TitleEn = "Persisted section", SortOrder = 1 };
        var asset = new MediaAsset { OwnerUserId = f.Owner, StorageKey = Guid.NewGuid().ToString("N"), MimeType = "video/mp4", MediaType = "video", DurationSeconds = 120, OriginalFileName = "test.mp4", ContentHash = "test", SizeBytes = 512 };
        var video = new Lesson { CourseSectionId = section.Id, TitleEn = "Video", PrimaryVideoMediaAssetId = asset.Id, SortOrder = 2 };
        var article = new Lesson { CourseSectionId = section.Id, TitleEn = "Reading", ContentType = "article", DescriptionEn = "<script>safe plain text</script>", SortOrder = 1 };
        var link = new LessonAttachment { LessonId = video.Id, MediaAssetId = asset.Id, DisplayName = "test.mp4" };
        db.AddRange(section, asset, video, article, link); await db.SaveChangesAsync();
        return new(f, enrollment, video.Id, article.Id, link.Id);
    }
    [Theory] [InlineData("learner")] [InlineData("both")]
    public async Task Owned_curriculum_is_ordered_private_and_reads_do_not_write(string persona)
    {
        using var p = Services(); using var scope = p.CreateScope(); var s = scope.ServiceProvider; var f = await Setup(s, persona);
        var db = s.GetRequiredService<AppDbContext>(); var read = Reads(s); var actor = Principal(f.Purchase.Learner);
        var course = (await read.GetAsync(actor, f.Enrollment)).Value!;
        Assert.Equal(f.Article, course.Sections.Single().Lessons[0].Id); Assert.True(course.VersionState.LearnerContentApiAvailable);
        var lesson = (await read.LessonAsync(actor, f.Enrollment, f.Lesson)).Value!;
        Assert.Contains(f.Enrollment.ToString(), lesson.VideoUrl); Assert.Single(lesson.Attachments);
        Assert.Empty(await db.LessonProgressRecords.ToListAsync()); Assert.Null((await db.Enrollments.SingleAsync()).LastOpenedAt);
        Assert.Equal(ServiceFailure.Unauthenticated, (await read.GetAsync(new(), f.Enrollment)).Failure);
        Assert.Equal(ServiceFailure.Forbidden, (await read.GetAsync(Principal(f.Purchase.Owner), f.Enrollment)).Failure);
        Assert.Equal(ServiceFailure.NotFound, (await read.LessonAsync(actor, f.Enrollment, Guid.NewGuid())).Failure);
        var foreign = await Seed(s); await s.GetRequiredService<AccountService>().UpdateCurrentProfileAsync(Principal(foreign), Profile("learner", "foreign"));
        Assert.Equal(ServiceFailure.NotFound, (await read.GetAsync(Principal(foreign), f.Enrollment)).Failure);
    }
    [Fact] public async Task Receipt_safety_category_and_media_relationships_fail_closed()
    {
        using var p = Services(); using var scope = p.CreateScope(); var s = scope.ServiceProvider; var f = await Setup(s);
        var db = s.GetRequiredService<AppDbContext>(); var actor = Principal(f.Purchase.Learner); var read = Reads(s);
        Assert.Equal(ServiceFailure.None, (await read.MediaAsync(actor, f.Enrollment, f.Lesson, null)).Failure);
        Assert.Equal(ServiceFailure.None, (await read.MediaAsync(actor, f.Enrollment, f.Lesson, f.Attachment)).Failure);
        Assert.Equal(ServiceFailure.NotFound, (await read.MediaAsync(actor, f.Enrollment, f.Article, f.Attachment)).Failure);
        var asset = await db.MediaAssets.SingleAsync(); asset.StorageKey = "missing"; await db.SaveChangesAsync();
        Assert.Equal("media_missing", (await read.MediaAsync(actor, f.Enrollment, f.Lesson, null)).Code);
        var course = await db.Courses.SingleAsync(); course.EnrollmentPaused = true; await db.SaveChangesAsync();
        Assert.Equal(ServiceFailure.None, (await read.GetAsync(actor, f.Enrollment)).Failure);
        db.EnrollmentVersionAccess.RemoveRange(db.EnrollmentVersionAccess); await db.SaveChangesAsync();
        Assert.Equal("version_access_missing", (await read.GetAsync(actor, f.Enrollment)).Code);
    }
    [Fact] public async Task Completion_is_monotonic_first_date_is_preserved_and_financial_state_does_not_change()
    {
        using var p = Services(); using var scope = p.CreateScope(); var s = scope.ServiceProvider; var f = await Setup(s);
        var db = s.GetRequiredService<AppDbContext>(); var actor = Principal(f.Purchase.Learner); var write = Writes(s);
        var balances = await db.Wallets.OrderBy(x => x.UserId).Select(x => x.Balance).ToListAsync(); var ledger = await db.PointTransactions.CountAsync(); var receipts = await db.EnrollmentVersionAccess.CountAsync();
        var first = await write.CompleteAsync(actor, f.Enrollment, f.Lesson, new(f.Purchase.Version));
        Assert.True(first.Value!.IsCompleted); var second = await write.CompleteAsync(actor, f.Enrollment, f.Lesson, new(f.Purchase.Version));
        Assert.Equal(first.Value.CompletedAt, second.Value!.CompletedAt); Assert.Equal(first.Value.ProgressToken, second.Value.ProgressToken);
        var position = await write.WriteAsync(actor, f.Enrollment, f.Lesson, new(f.Purchase.Version, second.Value.ProgressToken, 80));
        var backward = await write.WriteAsync(actor, f.Enrollment, f.Lesson, new(f.Purchase.Version, position.Value!.ProgressToken, 15));
        Assert.Equal(15, backward.Value!.LastPositionSeconds); Assert.True(backward.Value.IsCompleted);
        Assert.Equal(balances, await db.Wallets.OrderBy(x => x.UserId).Select(x => x.Balance).ToListAsync()); Assert.Equal(ledger, await db.PointTransactions.CountAsync()); Assert.Equal(receipts, await db.EnrollmentVersionAccess.CountAsync());
        Assert.Equal("active", (await db.Enrollments.SingleAsync()).Status); Assert.Null((await db.Enrollments.SingleAsync()).CompletedAt); Assert.Empty(db.Certificates); Assert.Empty(db.TaskSubmissions);
    }
    [Fact] public async Task Same_position_new_token_stale_retry_and_open_cannot_overwrite_or_clear_completion()
    {
        using var p = Services(); using var scope = p.CreateScope(); var s = scope.ServiceProvider; var f = await Setup(s);
        var actor = Principal(f.Purchase.Learner); var write = Writes(s); var initial = (await Reads(s).LessonAsync(actor, f.Enrollment, f.Lesson)).Value!.Progress;
        var payload = new ProgressWrite(f.Purchase.Version, initial.ProgressToken, 10);
        var one = await write.WriteAsync(actor, f.Enrollment, f.Lesson, payload);
        var two = await write.WriteAsync(actor, f.Enrollment, f.Lesson, payload with { ExpectedProgressToken = one.Value!.ProgressToken });
        Assert.NotEqual(one.Value.ProgressToken, two.Value!.ProgressToken);
        var stale = await write.WriteAsync(actor, f.Enrollment, f.Lesson, payload); Assert.Equal("progress_conflict", stale.Code); Assert.Equal(two.Value, stale.Value);
        await write.CompleteAsync(actor, f.Enrollment, f.Lesson, new(f.Purchase.Version));
        var latest = (await Reads(s).LessonAsync(actor, f.Enrollment, f.Lesson)).Value!.Progress;
        var opened = await write.WriteAsync(actor, f.Enrollment, f.Lesson, new(f.Purchase.Version, latest.ProgressToken), true);
        Assert.True(opened.Value!.IsCompleted); Assert.Equal(10, opened.Value.LastPositionSeconds);
    }
    [Theory] [InlineData(-1)] [InlineData(121)] [InlineData(double.NaN)] [InlineData(double.PositiveInfinity)]
    public async Task Invalid_positions_never_persist(double position)
    {
        using var p = Services(); using var scope = p.CreateScope(); var s = scope.ServiceProvider; var f = await Setup(s); var actor = Principal(f.Purchase.Learner);
        var state = (await Reads(s).LessonAsync(actor, f.Enrollment, f.Lesson)).Value!.Progress;
        Assert.Equal(ServiceFailure.Validation, (await Writes(s).WriteAsync(actor, f.Enrollment, f.Lesson, new(f.Purchase.Version, state.ProgressToken, position))).Failure);
        Assert.Empty(s.GetRequiredService<AppDbContext>().LessonProgressRecords);
    }
    [Fact] public async Task Disabled_gate_and_stale_publication_do_not_write()
    {
        using var p = Services(); using var scope = p.CreateScope(); var s = scope.ServiceProvider; var f = await Setup(s); var actor = Principal(f.Purchase.Learner); var db = s.GetRequiredService<AppDbContext>();
        Assert.Equal("progress_disabled", (await Writes(s, new MemoryGate(db, false)).CompleteAsync(actor, f.Enrollment, f.Lesson, new(f.Purchase.Version))).Code);
        Assert.Equal("publication_changed", (await Writes(s).CompleteAsync(actor, f.Enrollment, f.Lesson, new(Guid.NewGuid()))).Code); Assert.Empty(db.LessonProgressRecords);
    }
    [Fact] public async Task Inactive_category_unavailable_course_and_ineligible_enrollment_block_content()
    {
        using var p = Services(); using var scope = p.CreateScope(); var s = scope.ServiceProvider; var f = await Setup(s); var actor = Principal(f.Purchase.Learner); var db = s.GetRequiredService<AppDbContext>();
        var category = await db.Categories.SingleAsync(x => x.CourseVersions.Any(v => v.Id == f.Purchase.Version));
        category.IsActive = false; await db.SaveChangesAsync(); Assert.Equal(ServiceFailure.Forbidden, (await Reads(s).GetAsync(actor, f.Enrollment)).Failure);
        category.IsActive = true; var course = await db.Courses.SingleAsync(); course.SafetyStatus = "suspended"; await db.SaveChangesAsync();
        Assert.Equal(ServiceFailure.Forbidden, (await Reads(s).MediaAsync(actor, f.Enrollment, f.Lesson, null)).Failure);
        course.SafetyStatus = "active"; var enrollment = await db.Enrollments.SingleAsync(); enrollment.Status = "refunded"; await db.SaveChangesAsync();
        Assert.Equal(ServiceFailure.Forbidden, (await Reads(s).GetAsync(actor, f.Enrollment)).Failure);
    }
}
