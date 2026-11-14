using System.Text.Json;
using esham.BLL.DTOs;
using esham.BLL.Services;
using esham.DAL.Data;
using esham.DAL.Entities;
using esham.PL.Storage;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
using static esham.Tests.AccountFinalizationTests;
using static esham.Tests.LearnerLearningTests;
namespace esham.Tests;
public sealed class Phase2SetupFactAttribute(string action) : FactAttribute
{
    public override string? Skip { get; set; } = Environment.GetEnvironmentVariable("ESHAM_PHASE2_SETUP") == action && EnrollmentSqlServerTests.Configured()
        ? null : "Explicit guarded Phase 2 fixture action only.";
}
public sealed class Phase2IsolatedEnvironmentTests
{
    private static string DirectoryRoot()
    {
        var value = Environment.GetEnvironmentVariable("ESHAM_PHASE2_ARTIFACTS") ?? throw new InvalidOperationException("Isolated artifact root required.");
        var root = Path.GetFullPath(value);
        if (!root.EndsWith(Path.Combine("artifacts", "phase2-isolated"), StringComparison.OrdinalIgnoreCase)
            && !root.EndsWith(Path.Combine("artifacts","phase3-isolated","phase2-regression"),StringComparison.OrdinalIgnoreCase)) throw new InvalidOperationException("Separate Phase2 directory required.");
        Directory.CreateDirectory(root); return root;
    }
    private static string MediaRoot()
    {
        var configured = Environment.GetEnvironmentVariable("ESHAM_PHASE2_MEDIA_ROOT") ?? throw new InvalidOperationException("Separate media root required.");
        var artifacts=DirectoryRoot();
        var root = artifacts.EndsWith(Path.Combine("phase3-isolated","phase2-regression"),StringComparison.OrdinalIgnoreCase)
            ? Path.GetFullPath(Path.Combine(artifacts,"../../phase2-isolated/media")) : Path.Combine(artifacts,"media");
        if (!string.Equals(Path.GetFullPath(configured), root, StringComparison.OrdinalIgnoreCase)) throw new InvalidOperationException("Refusing non-isolated media root.");
        Directory.CreateDirectory(root); return root;
    }
    [Phase2SetupFact("fixtures")] public async Task Prepare_fresh_synthetic_learning_browser_fixtures()
    {
        using var p = await LessonProgressSqlServerTests.Provider(); var root = DirectoryRoot(); var mediaRoot = MediaRoot();
        // File.Copy/Save occurs only after actual database and dedicated storage verification.
        var videoPath = Path.Combine(root, "synthetic.webm"); Assert.True(File.Exists(videoPath));
        var f = await LessonProgressSqlServerTests.Fixture(p); using var scope = p.CreateScope(); var s = scope.ServiceProvider; var db = s.GetRequiredService<AppDbContext>();
        Assert.True(await LessonProgressSqlServerTests.Gate(db).IsEnabledAsync());
        await using var video = File.OpenRead(videoPath); var stored = await new LocalMediaStorage(mediaRoot).SaveAsync(video, "video/webm", default);
        var asset = new MediaAsset { OwnerUserId = f.Purchase.Owner, StorageKey = stored.Key, MimeType = "video/webm", SizeBytes = stored.SizeBytes,
            ContentHash = stored.ContentHash, DurationSeconds = 2, MediaType = "video", OriginalFileName = "synthetic.webm" };
        db.MediaAssets.Add(asset);
        (await db.Lessons.SingleAsync(x => x.Id == f.Lesson)).PrimaryVideoMediaAssetId = asset.Id;
        (await db.LessonAttachments.SingleAsync(x => x.Id == f.Attachment)).MediaAssetId = asset.Id;
        var article = await db.Lessons.SingleAsync(x => x.Id == f.Article); article.TitleAr = "قراءة محمية"; article.TitleEn = "Protected reading";
        article.DescriptionAr = "نص آمن <script>لا ينفّذ</script>"; article.DescriptionEn = "Protected article <script>window.privateScriptExecuted=true</script>";
        db.CourseTasks.Add(new() { CourseVersionId = f.Purchase.Version, TitleEn = "Required assessment", TitleAr = "مهمة مطلوبة" });
        await db.SaveChangesAsync();
        var foreign = await Seed(s); await s.GetRequiredService<AccountService>().UpdateCurrentProfileAsync(Principal(foreign), Profile("learner", "p2_" + foreign.Replace("-", "")[..12]));
        var draft = await LessonProgressSqlServerTests.NextVersion(p, f);
        var learner = await db.Users.SingleAsync(x => x.Id == f.Purchase.Learner); var instructor = await db.Users.SingleAsync(x => x.Id == f.Purchase.Owner); var other = await db.Users.SingleAsync(x => x.Id == foreign);
        var before = await Snapshot(db, f.Enrollment, f.Purchase.Learner, f.Purchase.Owner);
        var fixture = new { learner = new { id = learner.Id, email = learner.Email, password = Password }, instructor = new { id = instructor.Id, email = instructor.Email, password = Password },
            otherLearner = new { id = other.Id, email = other.Email, password = Password }, enrollmentId = f.Enrollment, courseId = f.Purchase.Course, versionId = f.Purchase.Version,
            videoLessonId = f.Lesson, articleLessonId = f.Article, attachmentId = f.Attachment, draftVersionId = draft.Version, draftLessonId = draft.Lesson, before };
        // Test credentials are written only to ignored private artifacts, never console/source.
        var path = Path.Combine(root, "browser-fixtures-" + Guid.NewGuid().ToString("N") + ".json");
        await File.WriteAllTextAsync(path, JsonSerializer.Serialize(fixture));
        await File.WriteAllTextAsync(Path.Combine(root, "current-fixture-path.txt"), path);
        await using var connection = db.Database.GetDbConnection(); await connection.OpenAsync(); await using var command = connection.CreateCommand();
        command.CommandText = "SELECT DB_NAME(), CONVERT(int,SERVERPROPERTY('IsLocalDB')), CONVERT(nvarchar(128),SERVERPROPERTY('ServerName'))";
        await using var reader = await command.ExecuteReaderAsync(); await reader.ReadAsync();
        await File.WriteAllTextAsync(Path.Combine(root, "database-identity.json"), JsonSerializer.Serialize(new { database = reader.GetString(0), isLocalDB = reader.GetInt32(1), instance = reader.GetString(2), mediaIsolated = true }));
    }
    internal static async Task<string> Snapshot(AppDbContext db, Guid enrollment, string learner, string owner)
    {
        var value = new {
            wallets = await db.Wallets.AsNoTracking().Where(x => x.UserId == learner || x.UserId == owner).OrderBy(x => x.UserId).Select(x => new { x.UserId, x.Balance, x.UpdatedAt }).ToListAsync(),
            ledger = await db.PointTransactions.AsNoTracking().Where(x => x.UserId == learner || x.UserId == owner).OrderBy(x => x.Id).Select(x => new { x.Id, x.UserId, x.Amount, x.EnrollmentId, x.TransactionType, x.CreatedAt }).ToListAsync(),
            enrollment = await db.Enrollments.AsNoTracking().Where(x => x.Id == enrollment).Select(x => new { x.Id, x.CourseId, x.CourseVersionId, x.LearnerUserId, x.Status, x.CompletedAt, x.EnrolledAt }).SingleAsync(),
            access = await db.EnrollmentVersionAccess.AsNoTracking().Where(x => x.EnrollmentId == enrollment).OrderBy(x => x.Id).Select(x => new { x.Id, x.CourseVersionId, x.PreviousCourseVersionId, x.GrantedAt, x.Reason }).ToListAsync(),
            certificates = await db.Certificates.AsNoTracking().Where(x => x.EnrollmentId == enrollment).Select(x => x.Id).ToListAsync(),
            attempts = await db.TaskSubmissions.AsNoTracking().Where(x => x.EnrollmentId == enrollment).Select(x => new { x.Id, x.Status }).ToListAsync()
        };
        return JsonSerializer.Serialize(value);
    }
    [Phase2SetupFact("invariants")] public async Task Verify_browser_progress_financial_and_achievement_invariants()
    {
        using var p = await LessonProgressSqlServerTests.Provider(); using var scope = p.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var path = await File.ReadAllTextAsync(Path.Combine(DirectoryRoot(), "current-fixture-path.txt"));
        using var json = JsonDocument.Parse(await File.ReadAllTextAsync(path)); var f = json.RootElement;
        var e = f.GetProperty("enrollmentId").GetGuid();
        Assert.Equal(f.GetProperty("before").GetString(), await Snapshot(db, e, f.GetProperty("learner").GetProperty("id").GetString()!, f.GetProperty("instructor").GetProperty("id").GetString()!));
        var progress = await db.LessonProgressRecords.AsNoTracking().Where(x => x.EnrollmentId == e).ToListAsync();
        Assert.Equal(2, progress.Count); Assert.All(progress, x => Assert.True(x.IsCompleted));
        await File.WriteAllTextAsync(Path.Combine(DirectoryRoot(), "persisted-invariants.json"), JsonSerializer.Serialize(new { passed = true, completedLessons = progress.Count, financialAndAttributionUnchanged = true }));
    }
}
