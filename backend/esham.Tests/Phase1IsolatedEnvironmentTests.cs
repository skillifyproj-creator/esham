using System.Data;
using System.Text.Json;
using esham.BLL.Interfaces;
using esham.BLL.Services;
using esham.DAL.Data;
using esham.DAL.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Xunit;
using static esham.Tests.AccountFinalizationTests;
using static esham.Tests.AccountFinalizationSqlServerTests;
namespace esham.Tests;

public sealed class Phase1SetupFactAttribute(string action) : FactAttribute
{
    public override string? Skip { get; set; } = Environment.GetEnvironmentVariable("ESHAM_PHASE1_SETUP") == action && EnrollmentSqlServerTests.Configured()
        ? null : "Explicit isolated Phase 1 setup action only; never runs in a normal regression.";
}

// Explicitly authorized disposable setup. No app startup, hosted secrets, new migrations,
// database reset/drop, or shared records. Each action re-verifies the connected identity.
public sealed class Phase1IsolatedEnvironmentTests
{
    internal const string ApprovedCatalog = "Esham_AccountTests_Phase1_20261114";
    private static string Connection()
    {
        if (!EnrollmentSqlServerTests.Configured()) throw new InvalidOperationException("No approved isolated configuration.");
        var value = Environment.GetEnvironmentVariable("ESHAM_ACCOUNT_TEST_SQLSERVER")!;
        var parsed = new SqlConnectionStringBuilder(value);
        if (parsed.InitialCatalog != ApprovedCatalog || Environment.GetEnvironmentVariable("ESHAM_APPROVED_ISOLATED_DATABASE") != ApprovedCatalog
            || !parsed.DataSource.Equals(@"(localdb)\MSSQLLocalDB", StringComparison.OrdinalIgnoreCase) || !parsed.IntegratedSecurity)
            throw new InvalidOperationException("Setup is restricted to the explicitly authorized Phase 1 LocalDB catalog.");
        return value;
    }
    private static async Task Verify(SqlConnection connection, string expected)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = "SELECT DB_NAME(), CONVERT(int, SERVERPROPERTY('IsLocalDB')), CONVERT(nvarchar(128), SERVERPROPERTY('ServerName'))";
        await using var reader = await command.ExecuteReaderAsync(); await reader.ReadAsync();
        Assert.Equal(expected, reader.GetString(0)); Assert.Equal(1, reader.GetInt32(1)); Assert.NotEmpty(reader.GetString(2));
        Assert.NotEqual("db75401", reader.GetString(0));
    }
    private static string Artifact(string name)
    {
        var directory = Environment.GetEnvironmentVariable("ESHAM_PHASE1_ARTIFACTS") ?? throw new InvalidOperationException("Private artifact directory is required.");
        Directory.CreateDirectory(directory); return Path.Combine(directory, name);
    }
    private static string FixtureFile()
    {
        var name = Environment.GetEnvironmentVariable("ESHAM_PHASE1_FIXTURE_NAME") ?? "browser-fixtures.json";
        if (!System.Text.RegularExpressions.Regex.IsMatch(name, @"^browser-fixtures(?:-[A-Za-z0-9_]+)?\.json$")) throw new InvalidOperationException("Invalid private fixture artifact name.");
        return Artifact(name);
    }
    private static async Task<ServiceProvider> VerifiedServices()
    {
        var value = Connection(); await using var connection = new SqlConnection(value); await connection.OpenAsync(); await Verify(connection, ApprovedCatalog);
        return DatabaseServices();
    }

    [Phase1SetupFact("provision")]
    public async Task Provision_new_disposable_catalog_and_apply_existing_migrations_only()
    {
        var target = Connection(); var master = new SqlConnectionStringBuilder(target) { InitialCatalog = "master" };
        await using (var connection = new SqlConnection(master.ConnectionString))
        {
            await connection.OpenAsync(); await Verify(connection, "master");
            await using var existing = connection.CreateCommand(); existing.CommandText = "SELECT DB_ID(@name)"; existing.Parameters.AddWithValue("@name", ApprovedCatalog);
            if (await existing.ExecuteScalarAsync() is not DBNull) throw new InvalidOperationException("Catalog already exists. Refusing to reset or recreate it.");
            await using var create = connection.CreateCommand(); create.CommandText = $"CREATE DATABASE [{ApprovedCatalog}]"; await create.ExecuteNonQueryAsync();
        }
        await using (var connection = new SqlConnection(target)) { await connection.OpenAsync(); await Verify(connection, ApprovedCatalog); }
        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlServer(target).Options);
        var expected = db.Database.GetMigrations().ToArray(); Assert.Equal(3, expected.Length);
        await db.Database.MigrateAsync();
        Assert.Equal(expected, (await db.Database.GetAppliedMigrationsAsync()).ToArray());
        Assert.Empty(await db.Users.ToListAsync()); Assert.Empty(await db.Courses.ToListAsync()); Assert.Empty(await db.PointTransactions.ToListAsync());
        await File.WriteAllTextAsync(Artifact("database-identity.json"), JsonSerializer.Serialize(new { database = ApprovedCatalog, isLocalDB = true, existingMigrationsApplied = expected }));
    }

    private sealed record UserFixture(string Id, string Email, string Password);
    private sealed record BrowserFixture(UserFixture Learner, UserFixture OtherLearner, UserFixture Instructor, Guid CourseId, Guid OtherCourseId, Guid StaleCourseId, Guid SelfCourseId, string CourseTitle);
    [Phase1SetupFact("fixtures")]
    public async Task Create_synthetic_browser_fixtures_only_in_verified_isolated_database()
    {
        using var provider = await VerifiedServices(); using var scope = provider.CreateScope(); var s = scope.ServiceProvider; var db = s.GetRequiredService<AppDbContext>();
        if (File.Exists(FixtureFile())) throw new InvalidOperationException("Browser fixture file already exists; refusing an accidental duplicate setup.");
        var d = await EnrollmentTests.Setup(s);
        var first = await db.Courses.Include(x => x.PublishedVersion).SingleAsync(x => x.Id == d.Course);
        first.PublishedVersion!.TitleEn = "Phase 1 Browser Course"; first.PublishedVersion.TitleAr = "دورة اختبار المرحلة الأولى";
        var category = first.PublishedVersion.CategoryId;
        var other = await Seed(s);
        Assert.Equal(AccountFailure.None, (await s.GetRequiredService<AccountService>().UpdateCurrentProfileAsync(Principal(other), Profile("both", "b_" + other.Replace("-", "")[..12]))).Failure);
        async Task<Guid> Course(string owner, string title)
        {
            var c = new Course { OwnerUserId = owner }; db.Courses.Add(c); await db.SaveChangesAsync();
            var version = new CourseVersion { CourseId = c.Id, CategoryId = category, VersionNumber = 1, TitleAr = title, TitleEn = title, ReviewStatus = "approved", ApprovedAt = DateTimeOffset.UtcNow };
            db.CourseVersions.Add(version); await db.SaveChangesAsync(); c.PublishedVersionId = c.DraftVersionId = version.Id; await db.SaveChangesAsync(); return c.Id;
        }
        var second = await Course(d.Owner, "Phase 1 Insufficient Funds Course"); var stale = await Course(d.Owner, "Phase 1 Stale Publication Course");
        var self = await Course(other, "Phase 1 Own Course");
        // Resolve the first tracked entity again after account finalization cleared tracking.
        var firstVersion = await db.CourseVersions.SingleAsync(x => x.Id == d.Version); firstVersion.TitleEn = "Phase 1 Browser Course"; firstVersion.TitleAr = "دورة اختبار المرحلة الأولى"; await db.SaveChangesAsync();
        async Task<UserFixture> User(string id) => new(id, (await db.Users.SingleAsync(x => x.Id == id)).Email!, Password);
        var fixture = new BrowserFixture(await User(d.Learner), await User(other), await User(d.Owner), d.Course, second, stale, self, "Phase 1 Browser Course");
        await File.WriteAllTextAsync(FixtureFile(), JsonSerializer.Serialize(fixture, new JsonSerializerOptions(JsonSerializerDefaults.Web)));
        Assert.Equal(20, (await db.Wallets.SingleAsync(x => x.UserId == d.Learner)).Balance); Assert.Equal(20, (await db.Wallets.SingleAsync(x => x.UserId == d.Owner)).Balance);
    }

    [Phase1SetupFact("publish")]
    public async Task Advance_only_the_synthetic_browser_publication()
    {
        using var provider = await VerifiedServices(); using var scope = provider.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var fixture = JsonSerializer.Deserialize<BrowserFixture>(await File.ReadAllTextAsync(FixtureFile()), new JsonSerializerOptions(JsonSerializerDefaults.Web))!;
        await db.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
        {
            db.ChangeTracker.Clear(); await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
            var course = await db.Courses.FromSqlInterpolated($"SELECT * FROM [Courses] WITH (UPDLOCK,HOLDLOCK) WHERE [Id]={fixture.StaleCourseId}").SingleAsync();
            Assert.Equal(fixture.Instructor.Id, course.OwnerUserId);
            var previous = await db.CourseVersions.SingleAsync(x => x.Id == course.PublishedVersionId);
            var next = new CourseVersion { CourseId = course.Id, CategoryId = previous.CategoryId, VersionNumber = previous.VersionNumber + 1,
                TitleEn = previous.TitleEn, TitleAr = previous.TitleAr, ReviewStatus = "approved", ApprovedAt = DateTimeOffset.UtcNow };
            db.CourseVersions.Add(next); await db.SaveChangesAsync(); var oldId = course.PublishedVersionId; course.PublishedVersionId = course.DraftVersionId = next.Id;
            await new CourseVersionUpdates(db, new NotificationWriter(db)).StagePublicationAsync(course, next, oldId);
            await db.SaveChangesAsync(); await tx.CommitAsync();
        });
    }

    [Phase1SetupFact("invariants")]
    public async Task Verify_persisted_browser_purchase_and_failed_attempt_invariants()
    {
        using var provider = await VerifiedServices(); using var scope = provider.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var f = JsonSerializer.Deserialize<BrowserFixture>(await File.ReadAllTextAsync(FixtureFile()), new JsonSerializerOptions(JsonSerializerDefaults.Web))!;
        var enrollment = await db.Enrollments.SingleAsync(x => x.LearnerUserId == f.Learner.Id);
        Assert.Equal(f.CourseId, enrollment.CourseId); Assert.False(await db.Enrollments.AnyAsync(x => x.LearnerUserId == f.OtherLearner.Id));
        var entries = await db.PointTransactions.Where(x => x.EnrollmentId == enrollment.Id).ToListAsync(); Assert.Equal(2, entries.Count); Assert.Equal(0, entries.Sum(x => x.Amount));
        Assert.Contains(entries, x => x.UserId == f.Learner.Id && x.Amount == -20 && x.TransactionType == "enrollment");
        Assert.Contains(entries, x => x.UserId == f.Instructor.Id && x.Amount == 20 && x.TransactionType == "teaching");
        Assert.Equal(0, (await db.Wallets.SingleAsync(x => x.UserId == f.Learner.Id)).Balance); Assert.Equal(20, (await db.Wallets.SingleAsync(x => x.UserId == f.OtherLearner.Id)).Balance); Assert.Equal(40, (await db.Wallets.SingleAsync(x => x.UserId == f.Instructor.Id)).Balance);
        Assert.Equal(1, await db.EnrollmentVersionAccess.CountAsync(x => x.EnrollmentId == enrollment.Id && x.CourseVersionId == enrollment.CourseVersionId && x.Reason == "enrolled"));
        foreach (var id in new[] { f.Learner.Id, f.OtherLearner.Id, f.Instructor.Id }) Assert.Equal(1, await db.PointTransactions.CountAsync(x => x.UserId == id && x.TransactionType == "welcome"));
        await using (var connection = new SqlConnection(Connection()))
        {
            await connection.OpenAsync(); await Verify(connection, ApprovedCatalog);
            await using var command = connection.CreateCommand(); command.CommandText = "SELECT CONVERT(nvarchar(128), SERVERPROPERTY('ServerName'))";
            var server = (string)(await command.ExecuteScalarAsync())!;
            await File.WriteAllTextAsync(Artifact("database-identity.json"), JsonSerializer.Serialize(new { database = ApprovedCatalog, isLocalDB = true, server, existingMigrationsApplied = (await db.Database.GetAppliedMigrationsAsync()).ToArray() }));
        }
        await File.WriteAllTextAsync(Artifact("persisted-invariants.json"), JsonSerializer.Serialize(new { database = ApprovedCatalog, enrollmentCount = 1, ledgerEntries = 2, transferSum = 0, learnerBalance = 0, otherLearnerBalance = 20, instructorBalance = 40, initialReceiptCount = 1, welcomeOnce = true }));
    }
}
