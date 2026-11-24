using System.Data;
using System.Data.Common;
using System.Text.Json;
using esham.BLL.DTOs;
using esham.BLL.DTOs.Courses;
using esham.BLL.Services;
using esham.DAL.Data;
using esham.DAL.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using esham.BLL.Interfaces;
using Microsoft.Data.SqlClient;
using System.Collections.Concurrent;
using Xunit;
using static esham.Tests.AccountFinalizationTests;

namespace esham.Tests;

// Regression expectation: an actor captured before a lock wait cannot retain revoked authority.
// Never turn the negative assertion into a successful-write characterization to hide the defect.
public sealed class Phase6AAuthorizationRaceSqlTests
{
    private sealed class CourseWaitProbe : DbCommandInterceptor
    {
        public string? WriterContext;
        public TaskCompletionSource Reached = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public ConcurrentQueue<int> SqlErrors = new();
        public override Task CommandFailedAsync(DbCommand command, CommandErrorEventData data, CancellationToken ct = default)
        {
            if (data.Exception is SqlException sql) foreach (SqlError error in sql.Errors) SqlErrors.Enqueue(error.Number);
            return Task.CompletedTask;
        }
        public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(
            DbCommand command, CommandEventData data, InterceptionResult<DbDataReader> result,
            CancellationToken cancellationToken = default)
        {
            if (data.Context!.ContextId.ToString() == WriterContext
                && command.CommandText.Contains("[Courses] WITH (UPDLOCK")) Reached.TrySetResult();
            return ValueTask.FromResult(result);
        }
    }

    [Phase1SqlTheory]
    [InlineData("authorized", false)]
    [InlineData("revoked", false)]
    [InlineData("locked", false)]
    [InlineData("foreign", false)]
    [InlineData("authorized", true)]
    [InlineData("revoked", true)]
    [InlineData("locked", true)]
    [InlineData("foreign", true)]
    public async Task Queued_curriculum_write_rechecks_membership_before_persisting(string scenario, bool media)
    {
        var revokeInstructor = scenario == "revoked";
        var probe = new CourseWaitProbe();
        using var provider = await CompletionSqlServerTests.Provider(probe);
        string owner;
        Guid courseId;
        CourseActor capturedActor;
        using (var setup = provider.CreateScope())
        {
            var services = setup.ServiceProvider;
            var db = services.GetRequiredService<AppDbContext>();
            // Provider and per-DML interceptor verify actual DB_NAME/IsLocalDB before writes.
            Assert.True(await CompletionSqlServerTests.Gate(db).IsEnabledAsync());
            owner = await Seed(services);
            var finalization = await services.GetRequiredService<AccountService>().UpdateCurrentProfileAsync(
                Principal(owner), Profile("instructor", "p6a_" + Guid.NewGuid().ToString("N")[..12]));
            Assert.Equal(esham.BLL.Interfaces.AccountFailure.None, finalization.Failure);
            var manager = services.GetRequiredService<UserManager<ApplicationUser>>();
            var user = (await manager.FindByIdAsync(owner))!;
            // Mirrors the actual IdentityRoleFilter's request-time database membership check.
            capturedActor = new(owner, await manager.IsInRoleAsync(user, "Instructor"), false);
            Assert.True(capturedActor.IsInstructor);
            var category = new Category { NameAr = "Synthetic Phase6A " + Guid.NewGuid().ToString("N"), NameEn = "Synthetic Phase6A" };
            var course = new Course { OwnerUserId = owner };
            db.AddRange(category, course);
            await db.SaveChangesAsync();
            var version = new CourseVersion { CourseId = course.Id, CategoryId = category.Id, VersionNumber = 1, TitleEn = "Synthetic authorization draft" };
            db.CourseVersions.Add(version);
            await db.SaveChangesAsync();
            course.DraftVersionId = version.Id;
            await db.SaveChangesAsync();
            courseId = course.Id;
            if (scenario == "foreign")
            {
                course.OwnerUserId = await Seed(services);
                await db.SaveChangesAsync();
            }
        }

        var title = "Phase6A queued section " + Guid.NewGuid().ToString("N");
        using var writer = provider.CreateScope();
        var writerDb = writer.ServiceProvider.GetRequiredService<AppDbContext>();
        probe.WriterContext = writerDb.ContextId.ToString();
        using var blocker = provider.CreateScope();
        var blockerDb = blocker.ServiceProvider.GetRequiredService<AppDbContext>();
        Task<ServiceFailure>? write = null;
        var competing = new List<Task<ServiceFailure>>();
        var store = new Store();
        await blockerDb.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
        {
            await using var transaction = await blockerDb.Database.BeginTransactionAsync(IsolationLevel.Serializable);
            await blockerDb.Courses.FromSqlInterpolated($"SELECT * FROM [Courses] WITH (UPDLOCK,HOLDLOCK) WHERE [Id]={courseId}").SingleAsync();
            // Keep this request's EF execution strategy independent of the blocking transaction.
            using (ExecutionContext.SuppressFlow())
                write = Task.Run(async () => media
                    ? (await new CourseCoverService(writerDb, store).UploadAsync(courseId, capturedActor,
                        new(Guid.NewGuid(), "synthetic.png", "image/png"), new MemoryStream([1, 2, 3]))).Failure
                    : (await new CurriculumService(writerDb).SaveSectionAsync(courseId, null, capturedActor, new(null, title, 0))).Failure);
            // A foreign media request is rejected at its preliminary ownership check, before a write lock.
            if (scenario == "foreign" && media) { Assert.Equal(ServiceFailure.Forbidden, await write); await transaction.CommitAsync(); return; }
            await probe.Reached.Task.WaitAsync(TimeSpan.FromSeconds(10));
            Assert.False(write.IsCompleted);
            if (scenario == "authorized" && media)
            {
                // Same owner/course, separate contexts: curriculum and cover writes contend on the course first.
                for (var index = 0; index < 4; index++)
                {
                    var cover = index % 2 == 0;
                    using (ExecutionContext.SuppressFlow()) competing.Add(Task.Run(async () =>
                    {
                        using var scope = provider.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                        return cover ? (await new CourseCoverService(db, store).UploadAsync(courseId, capturedActor,
                            new(Guid.NewGuid(), "concurrent.png", "image/png"), new MemoryStream([4, 5, 6]))).Failure
                            : (await new CurriculumService(db).SaveSectionAsync(courseId, null, capturedActor, new(null, Guid.NewGuid().ToString(), 0))).Failure;
                    }));
                }
            }
            if (revokeInstructor || scenario == "locked")
            {
                Task revoke;
                using (ExecutionContext.SuppressFlow()) revoke = Task.Run(async () =>
                {
                    using var scope = provider.CreateScope();
                    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                    var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
                    await db.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
                    {
                        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
                        var user = await db.Users.FromSqlInterpolated($"SELECT * FROM [AspNetUsers] WITH (UPDLOCK,HOLDLOCK) WHERE [Id]={owner}").SingleAsync();
                        if (revokeInstructor) Assert.True((await users.RemoveFromRoleAsync(user, "Instructor")).Succeeded);
                        else { user.LockoutEnabled = true; user.LockoutEnd = DateTimeOffset.UtcNow.AddHours(1); Assert.True((await users.UpdateAsync(user)).Succeeded); }
                        Assert.True((await users.UpdateSecurityStampAsync(user)).Succeeded);
                        await tx.CommitAsync();
                    });
                });
                await revoke.WaitAsync(TimeSpan.FromSeconds(20));
            }
            await transaction.CommitAsync();
        });
        var outcome = await write!.WaitAsync(TimeSpan.FromSeconds(20));
        foreach (var result in await Task.WhenAll(competing).WaitAsync(TimeSpan.FromSeconds(40))) Assert.Equal(ServiceFailure.None, result);
        using var verification = provider.CreateScope();
        var verifyDb = verification.ServiceProvider.GetRequiredService<AppDbContext>();
        var usersAfter = verification.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var instructorAfter = await usersAfter.IsInRoleAsync((await usersAfter.FindByIdAsync(owner))!, "Instructor");
        var persisted = media ? await verifyDb.CourseVersions.AnyAsync(x => x.CourseId == courseId && x.CoverMediaAssetId != null)
            : await verifyDb.CourseSections.AnyAsync(x => x.CourseVersion.CourseId == courseId && x.TitleEn == title);
        Assert.Equal(!revokeInstructor, instructorAfter);
        Assert.Equal(20, (await verifyDb.Wallets.SingleAsync(x => x.UserId == owner)).Balance);
        Assert.Equal(1, await verifyDb.PointTransactions.CountAsync(x => x.UserId == owner));
        var artifacts = Path.GetFullPath(Path.Combine(Phase5SqlTests.Artifacts(), "../phase6a-results"));
        Directory.CreateDirectory(artifacts);
        await File.WriteAllTextAsync(Path.Combine(artifacts, $"authoring-race-{scenario}-{media}.json"),
            JsonSerializer.Serialize(new { scenario, media, instructorAfter, result = outcome.ToString(), persisted, financialInvariant = true, sqlErrors = probe.SqlErrors.ToArray() }));
        Assert.Equal(scenario == "authorized" ? ServiceFailure.None : ServiceFailure.Forbidden, outcome);
        Assert.Equal(scenario == "authorized", persisted);
        Assert.Empty(probe.SqlErrors);
        if (media && scenario != "authorized") Assert.Empty(store.Files);
    }

    private sealed class Store : IMediaStorage
    {
        public ConcurrentDictionary<string, byte[]> Files = new();
        public async Task<StoredMediaFile> SaveAsync(Stream input, string type, CancellationToken ct)
        {
            using var bytes = new MemoryStream(); await input.CopyToAsync(bytes, ct);
            var key = Guid.NewGuid().ToString("N"); var data = bytes.ToArray(); Files[key] = data;
            return new(key, Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(data)), data.Length, type);
        }
        public Task DeleteAsync(string key, CancellationToken ct) { Files.TryRemove(key, out _); return Task.CompletedTask; }
        public Task<Stream?> OpenAsync(string key, CancellationToken ct) => Task.FromResult<Stream?>(Files.TryGetValue(key, out var data) ? new MemoryStream(data) : null);
    }

    [Phase1SqlTheory]
    [InlineData("revoked")]
    [InlineData("locked")]
    [InlineData("authorized")]
    [InlineData("foreign")]
    [InlineData("unauthorized")]
    [InlineData("pending")]
    public async Task Queued_review_submission_rechecks_current_instructor_membership(string scenario)
    {
        var probe = new CourseWaitProbe(); using var provider = await CompletionSqlServerTests.Provider(probe);
        string owner; Guid course, version;
        using (var scope = provider.CreateScope())
        {
            var s = scope.ServiceProvider; var db = s.GetRequiredService<AppDbContext>();
            Assert.True(await CompletionSqlServerTests.Gate(db).IsEnabledAsync());
            owner = await Seed(s); var reviewer = await Seed(s);
            Assert.Equal(AccountFailure.None, (await s.GetRequiredService<AccountService>().UpdateCurrentProfileAsync(
                Principal(owner), Profile(scenario == "unauthorized" ? "learner" : "instructor", "p6ar_" + Guid.NewGuid().ToString("N")[..12]))).Failure);
            var fixture = await CourseReviewWorkflowTests.Seed(db, owner, reviewer); course=fixture.CourseId; version=fixture.VersionId;
            if (scenario == "foreign") (await db.Courses.SingleAsync(x=>x.Id==course)).OwnerUserId=reviewer;
            if (scenario == "pending") (await db.CourseVersions.SingleAsync(x=>x.Id==version)).ReviewStatus="pending";
            await db.SaveChangesAsync();
        }
        using var writer = provider.CreateScope(); var writerDb=writer.ServiceProvider.GetRequiredService<AppDbContext>();
        probe.WriterContext=writerDb.ContextId.ToString();
        using var blocker=provider.CreateScope(); var blockerDb=blocker.ServiceProvider.GetRequiredService<AppDbContext>();
        Task<ServiceResult<Guid>>? pending=null;
        await blockerDb.Database.CreateExecutionStrategy().ExecuteAsync(async()=>
        {
            await using var tx=await blockerDb.Database.BeginTransactionAsync(IsolationLevel.Serializable);
            await blockerDb.Courses.FromSqlInterpolated($"SELECT * FROM [Courses] WITH (UPDLOCK,HOLDLOCK) WHERE [Id]={course}").SingleAsync();
            using(ExecutionContext.SuppressFlow()) pending=Task.Run(()=>new CourseReviewService(writerDb,new CourseReviewWorkflowTests.Store()).SubmitAsync(course,new(owner,true,false),new(version)));
            await probe.Reached.Task.WaitAsync(TimeSpan.FromSeconds(10)); Assert.False(pending.IsCompleted);
            if (scenario is "revoked" or "locked")
            {
            Task revoke;
            using(ExecutionContext.SuppressFlow()) revoke=Task.Run(async()=> {
                using var scope=provider.CreateScope();var s=scope.ServiceProvider;var db=s.GetRequiredService<AppDbContext>();
                await db.Database.CreateExecutionStrategy().ExecuteAsync(async()=>{
                    await using var transaction=await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
                    var user=await db.Users.FromSqlInterpolated($"SELECT * FROM [AspNetUsers] WITH (UPDLOCK,HOLDLOCK) WHERE [Id]={owner}").SingleAsync();
                    var manager=s.GetRequiredService<UserManager<ApplicationUser>>();
                    if(scenario=="revoked") Assert.True((await manager.RemoveFromRoleAsync(user,"Instructor")).Succeeded);
                    else { user.LockoutEnabled=true;user.LockoutEnd=DateTimeOffset.UtcNow.AddHours(1);Assert.True((await manager.UpdateAsync(user)).Succeeded); }
                    Assert.True((await manager.UpdateSecurityStampAsync(user)).Succeeded);await transaction.CommitAsync();
                });
            });
            await revoke.WaitAsync(TimeSpan.FromSeconds(20));
            }
            await tx.CommitAsync();
        });
        var outcome=await pending!.WaitAsync(TimeSpan.FromSeconds(20));
        using var verify=provider.CreateScope();var verifyDb=verify.ServiceProvider.GetRequiredService<AppDbContext>();
        var status=await verifyDb.CourseVersions.Where(x=>x.Id==version).Select(x=>x.ReviewStatus).SingleAsync();
        var artifacts=Path.GetFullPath(Path.Combine(Phase5SqlTests.Artifacts(),"../phase6a-results"));Directory.CreateDirectory(artifacts);
        await File.WriteAllTextAsync(Path.Combine(artifacts,$"review-submit-race-{scenario}.json"),JsonSerializer.Serialize(new{scenario,result=outcome.Failure.ToString(),status,sqlErrors=probe.SqlErrors.ToArray()}));
        Assert.Empty(probe.SqlErrors);
        Assert.Equal(scenario=="authorized"?ServiceFailure.None:scenario=="pending"?ServiceFailure.Conflict:ServiceFailure.Forbidden,outcome.Failure);
        Assert.Equal(scenario is "authorized" or "pending"?"pending":"draft",status);
        Assert.Equal(scenario=="authorized"?1:0,await verifyDb.AdminActivityLogs.CountAsync(x=>x.CourseId==course));
        Assert.Null((await verifyDb.Courses.SingleAsync(x=>x.Id==course)).PublishedVersionId);
        Assert.Equal(20,(await verifyDb.Wallets.SingleAsync(x=>x.UserId==owner)).Balance);
        Assert.Equal(1,await verifyDb.PointTransactions.CountAsync(x=>x.UserId==owner));
    }
}
