using System.Data;
using System.Data.Common;
using System.Collections.Concurrent;
using System.Text.Json;
using esham.BLL.DTOs;
using esham.BLL.Services;
using esham.DAL.Data;
using esham.DAL.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
using static esham.Tests.AccountFinalizationTests;
namespace esham.Tests;

public sealed class Phase6AExpandedAuthorizationSqlTests
{
    [Phase1SqlFact]
    public async Task Metadata_curriculum_revision_publication_and_progress_share_actors_without_SQL_errors()
    {
        var probe=new Probe();using var p=await CompletionSqlServerTests.Provider(probe);
        var f=await LessonProgressSqlServerTests.Fixture(p);Guid metadata,publication,publicationVersion,revision,revisionVersion;
        using(var scope=p.CreateScope()) {
            var s=scope.ServiceProvider;var db=s.GetRequiredService<AppDbContext>();var manager=s.GetRequiredService<UserManager<ApplicationUser>>();
            Assert.True((await manager.AddToRoleAsync((await manager.FindByIdAsync(f.Purchase.Learner))!,"CategoryAdmin")).Succeeded);
            var a=await CourseReviewWorkflowTests.Seed(db,f.Purchase.Owner,f.Purchase.Learner);metadata=a.CourseId;
            var b=await CourseReviewWorkflowTests.Seed(db,f.Purchase.Owner,f.Purchase.Learner);publication=b.CourseId;publicationVersion=b.VersionId;
            var c=await CourseReviewWorkflowTests.Seed(db,f.Purchase.Owner,f.Purchase.Learner);revision=c.CourseId;revisionVersion=c.VersionId;
            var service=new CourseReviewService(db,new CourseReviewWorkflowTests.Store());var owner=new CourseActor(f.Purchase.Owner,true,false);var reviewer=new CourseActor(f.Purchase.Learner,false,false,true);
            Assert.Equal(ServiceFailure.None,(await service.SubmitAsync(publication,owner,new(publicationVersion))).Failure);
            Assert.Equal(ServiceFailure.None,(await service.SubmitAsync(revision,owner,new(revisionVersion))).Failure);
            Assert.Equal(ServiceFailure.None,(await service.DecideAsync(revision,revisionVersion,reviewer,new("rejected","Synthetic concurrency feedback"))).Failure);
        }
        var start=new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        async Task Run(int operation){using var scope=p.CreateScope();var s=scope.ServiceProvider;var db=s.GetRequiredService<AppDbContext>();await start.Task;var owner=new CourseActor(f.Purchase.Owner,true,false);ServiceFailure result;
            if(operation==0)result=(await new CourseService(db).UpdateDraftAsync(metadata,owner,new(){TitleEn="Concurrent metadata"})).Failure;
            else if(operation==1)result=(await new CurriculumService(db).SaveSectionAsync(metadata,null,owner,new(null,"Concurrent section",2))).Failure;
            else if(operation==2)result=(await new CourseReviewService(db,new CourseReviewWorkflowTests.Store()).ReviseAsync(revision,owner,new(revisionVersion))).Failure;
            else if(operation==3)result=(await new CourseReviewService(db,new CourseReviewWorkflowTests.Store()).DecideAsync(publication,publicationVersion,new(f.Purchase.Learner,false,false,true),new("approved",null))).Failure;
            else result=(await new LessonProgressService(db,LearnerLearningTests.Access(s),LessonProgressSqlServerTests.Gate(db),new CourseVersionUpdates(db,new NotificationWriter(db)),CompletionSqlServerTests.Service(s)).CompleteAsync(Principal(f.Purchase.Learner),f.Enrollment,f.Article,new(f.Purchase.Version))).Failure;
            Assert.Equal(ServiceFailure.None,result);
        }
        var work=Enumerable.Range(0,5).Select(i=>Task.Run(()=>Run(i))).ToArray();start.SetResult();await Task.WhenAll(work).WaitAsync(TimeSpan.FromSeconds(40));Assert.Empty(probe.Errors);
        using var verify=p.CreateScope();var check=verify.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(publicationVersion,(await check.Courses.SingleAsync(x=>x.Id==publication)).PublishedVersionId);
        Assert.Equal(f.Purchase.Version,(await check.Enrollments.SingleAsync(x=>x.Id==f.Enrollment)).CourseVersionId);
        Assert.Equal(0,(await check.Wallets.SingleAsync(x=>x.UserId==f.Purchase.Learner)).Balance);Assert.Equal(40,(await check.Wallets.SingleAsync(x=>x.UserId==f.Purchase.Owner)).Balance);
        Assert.Equal(2,await check.PointTransactions.CountAsync(x=>x.EnrollmentId==f.Enrollment));
    }
    private sealed class Probe : DbCommandInterceptor
    {
        public string? Context; public TaskCompletionSource Reached=new(TaskCreationOptions.RunContinuationsAsynchronously);
        public ConcurrentQueue<int> Errors=new();
        public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(DbCommand c,CommandEventData e,InterceptionResult<DbDataReader> r,CancellationToken ct=default)
        { if(e.Context?.ContextId.ToString()==Context&&c.CommandText.Contains("Courses"))Reached.TrySetResult();return ValueTask.FromResult(r); }
        public override Task CommandFailedAsync(DbCommand c,CommandErrorEventData e,CancellationToken ct=default)
        {if(e.Exception is Microsoft.Data.SqlClient.SqlException sql)foreach(Microsoft.Data.SqlClient.SqlError error in sql.Errors)Errors.Enqueue(error.Number);return Task.CompletedTask;}
    }
    public static IEnumerable<object[]> Cases()=>from path in new[]{"metadata","revise","decide"}
        from scenario in new[]{"authorized","revoked","locked","unauthorized","foreign","stale","concurrent"}
            .Concat(path=="decide"?new[]{"assignment","authorized-reject","authorized-changes","revoked-reject","locked-reject","revoked-changes","locked-changes","state"}:path=="revise"?new[]{"state"}:[])
        select new object[]{path,scenario};

    private static async Task<string> Snapshot(AppDbContext db,Guid id,string owner)=>JsonSerializer.Serialize(new {
        course=await db.Courses.AsNoTracking().Where(x=>x.Id==id).Select(x=>new{x.DraftVersionId,x.PublishedVersionId,x.UpdatedAt}).SingleAsync(),
        versions=await db.CourseVersions.AsNoTracking().Where(x=>x.CourseId==id).OrderBy(x=>x.Id).Select(x=>new{x.Id,x.TitleEn,x.ReviewStatus,x.UpdatedAt,x.SubmittedAt,x.ApprovedAt}).ToListAsync(),
        logs=await db.AdminActivityLogs.CountAsync(x=>x.CourseId==id),decisions=await db.CourseReviewDecisions.CountAsync(x=>x.CourseVersion.CourseId==id),
        notifications=await db.Notifications.CountAsync(x=>x.RecipientUserId==owner),
        sections=await db.CourseSections.CountAsync(x=>x.CourseVersion.CourseId==id),lessons=await db.Lessons.CountAsync(x=>x.CourseSection.CourseVersion.CourseId==id)
    });

    [Phase1SqlTheory][MemberData(nameof(Cases))]
    public async Task Current_authorization_is_rechecked_after_the_course_wait(string path,string scenario)
    {
        var probe=new Probe();using var provider=await CompletionSqlServerTests.Provider(probe);
        string owner,actorId;Guid course,version,category;CourseActor actor;string before;
        using(var scope=provider.CreateScope()){
            var s=scope.ServiceProvider;var db=s.GetRequiredService<AppDbContext>();Assert.True(await CompletionSqlServerTests.Gate(db).IsEnabledAsync());
            owner=await Seed(s);var reviewer=await Seed(s);var manager=s.GetRequiredService<UserManager<ApplicationUser>>();
            Assert.Equal(esham.BLL.Interfaces.AccountFailure.None,(await s.GetRequiredService<AccountService>().UpdateCurrentProfileAsync(Principal(owner),Profile("instructor","p6ax_"+Guid.NewGuid().ToString("N")[..12]))).Failure);
            Assert.True((await manager.AddToRoleAsync((await manager.FindByIdAsync(reviewer))!,"CategoryAdmin")).Succeeded);
            var fixture=await CourseReviewWorkflowTests.Seed(db,owner,reviewer);course=fixture.CourseId;version=fixture.VersionId;category=fixture.CategoryId;
            var reviews=new CourseReviewService(db,new CourseReviewWorkflowTests.Store());
            if(path!="metadata")Assert.Equal(ServiceFailure.None,(await reviews.SubmitAsync(course,new(owner,true,false),new(version))).Failure);
            if(path=="revise")Assert.Equal(ServiceFailure.None,(await reviews.DecideAsync(course,version,new(reviewer,false,false,true),new("rejected","Synthetic revision feedback"))).Failure);
            actorId=path=="decide"?reviewer:owner;
            if(scenario=="foreign") {
                if(path=="decide") {actorId=owner;Assert.True((await manager.AddToRoleAsync((await manager.FindByIdAsync(owner))!,"CategoryAdmin")).Succeeded);db.CategoryAdminAssignments.Add(new(){UserId=owner,CategoryId=category});await db.SaveChangesAsync();}
                else {actorId=reviewer;Assert.True((await manager.AddToRoleAsync((await manager.FindByIdAsync(reviewer))!,"Instructor")).Succeeded);}
            }
            if(scenario=="unauthorized")Assert.True((await manager.RemoveFromRoleAsync((await manager.FindByIdAsync(actorId))!,path=="decide"?"CategoryAdmin":"Instructor")).Succeeded);
            actor=new(actorId,path!="decide",false,path=="decide");before=await Snapshot(db,course,owner);
        }
        var expected=scenario=="stale"?Guid.NewGuid():version;
        async Task<ServiceFailure> Write(AppDbContext db) => path=="metadata"
            ? (await new CourseService(db).UpdateDraftAsync(course,actor,new(){TitleEn="Synthetic authorized metadata"})).Failure
            : path=="revise"?(await new CourseReviewService(db,new CourseReviewWorkflowTests.Store()).ReviseAsync(course,actor,new(expected))).Failure
            :(await new CourseReviewService(db,new CourseReviewWorkflowTests.Store()).DecideAsync(course,expected,actor,
                new(scenario.EndsWith("reject")?"rejected":scenario.EndsWith("changes")?"changes_requested":"approved",scenario.Contains('-')?"Synthetic decision feedback":null))).Failure;
        // Metadata has no expected-version input. Use an ineligible draft state for its stale-state case.
        if(path=="metadata"&&scenario=="stale"||scenario=="state"){
            using var scope=provider.CreateScope();var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();
            (await db.CourseVersions.SingleAsync(x=>x.Id==version)).ReviewStatus=path=="metadata"?"pending":path=="revise"?"draft":"rejected";await db.SaveChangesAsync();before=await Snapshot(db,course,owner);
        }
        using var writer=provider.CreateScope();var writerDb=writer.ServiceProvider.GetRequiredService<AppDbContext>();probe.Context=writerDb.ContextId.ToString();
        using var blocker=provider.CreateScope();var blockerDb=blocker.ServiceProvider.GetRequiredService<AppDbContext>();Task<ServiceFailure>? pending=null;Task<ServiceFailure>? second=null;
        await blockerDb.Database.CreateExecutionStrategy().ExecuteAsync(async()=>{
            await using var tx=await blockerDb.Database.BeginTransactionAsync(IsolationLevel.Serializable);
            // X lock also blocks the old metadata S read, making the pre-fix race deterministic.
            await blockerDb.Courses.FromSqlInterpolated($"SELECT * FROM [Courses] WITH (XLOCK,HOLDLOCK) WHERE [Id]={course}").SingleAsync();
            using(ExecutionContext.SuppressFlow())pending=Task.Run(()=>Write(writerDb));
            await probe.Reached.Task.WaitAsync(TimeSpan.FromSeconds(10));Assert.False(pending.IsCompleted);
            if(scenario.StartsWith("revoked")||scenario.StartsWith("locked")||scenario=="assignment") {
                Task revoke;using(ExecutionContext.SuppressFlow())revoke=Task.Run(async()=>{
                    using var sc=provider.CreateScope();var s=sc.ServiceProvider;var db=s.GetRequiredService<AppDbContext>();var manager=s.GetRequiredService<UserManager<ApplicationUser>>();
                    await db.Database.CreateExecutionStrategy().ExecuteAsync(async()=>{
                        await using var change=await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
                        var user=await db.Users.FromSqlInterpolated($"SELECT * FROM [AspNetUsers] WITH (UPDLOCK,HOLDLOCK) WHERE [Id]={actorId}").SingleAsync();
                        if(scenario.StartsWith("revoked"))Assert.True((await manager.RemoveFromRoleAsync(user,path=="decide"?"CategoryAdmin":"Instructor")).Succeeded);
                        else if(scenario.StartsWith("locked")){user.LockoutEnabled=true;user.LockoutEnd=DateTimeOffset.UtcNow.AddHours(1);Assert.True((await manager.UpdateAsync(user)).Succeeded);}
                        else (await db.CategoryAdminAssignments.SingleAsync(x=>x.UserId==actorId&&x.CategoryId==category)).IsActive=false;
                        Assert.True((await manager.UpdateSecurityStampAsync(user)).Succeeded);await db.SaveChangesAsync();await change.CommitAsync();
                    });
                });await revoke.WaitAsync(TimeSpan.FromSeconds(20));
            }
            if(scenario=="concurrent")using(ExecutionContext.SuppressFlow())second=Task.Run(async()=>{using var sc=provider.CreateScope();return await Write(sc.ServiceProvider.GetRequiredService<AppDbContext>());});
            await tx.CommitAsync();
        });
        var result=await pending!.WaitAsync(TimeSpan.FromSeconds(30));
        using var verify=provider.CreateScope();var check=verify.ServiceProvider.GetRequiredService<AppDbContext>();var after=await Snapshot(check,course,owner);
        var success=scenario.StartsWith("authorized")||scenario=="concurrent";
        var artifact=Path.GetFullPath(Path.Combine(Phase5SqlTests.Artifacts(),"../phase6a-results"));Directory.CreateDirectory(artifact);
        await File.WriteAllTextAsync(Path.Combine(artifact,$"expanded-{path}-{scenario}.json"),JsonSerializer.Serialize(new{path,scenario,result=result.ToString(),unchanged=before==after,sqlErrors=probe.Errors.ToArray()}));
        Assert.Equal(success?ServiceFailure.None:scenario=="state"?ServiceFailure.Conflict:scenario=="stale"?(path=="decide"?ServiceFailure.NotFound:ServiceFailure.Conflict):ServiceFailure.Forbidden,result);
        if(!success)Assert.Equal(before,after);
        if(second!=null){var other=await second.WaitAsync(TimeSpan.FromSeconds(30));Assert.Equal(path=="metadata"?ServiceFailure.None:ServiceFailure.Conflict,other);}
        Assert.Empty(probe.Errors);Assert.Equal(20,(await check.Wallets.SingleAsync(x=>x.UserId==owner)).Balance);Assert.Equal(1,await check.PointTransactions.CountAsync(x=>x.UserId==owner));
    }
}
