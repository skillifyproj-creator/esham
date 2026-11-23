using System.Data;
using System.Data.Common;
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
using static esham.Tests.Phase5Tests;
namespace esham.Tests;

public sealed class Phase5HardeningSqlTests
{
    private sealed class Probe:DbCommandInterceptor {
        public string? Delivery,Author,Security;public bool HoldAnnouncement,HoldUser,PauseBeforeUser;
        public TaskCompletionSource AnnouncementHeld=new(TaskCreationOptions.RunContinuationsAsynchronously),AuthorAttempt=new(TaskCreationOptions.RunContinuationsAsynchronously),UserHeld=new(TaskCreationOptions.RunContinuationsAsynchronously),BeforeUser=new(TaskCreationOptions.RunContinuationsAsynchronously),ReleaseAnnouncement=new(TaskCreationOptions.RunContinuationsAsynchronously),ReleaseUser=new(TaskCreationOptions.RunContinuationsAsynchronously);
        public System.Collections.Concurrent.ConcurrentBag<int> Errors=new();
        public override async ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(DbCommand c,CommandEventData e,InterceptionResult<DbDataReader> r,CancellationToken ct=default){
            var context=e.Context!.ContextId.ToString();
            if(context==Author&&c.CommandText.Contains("[Announcements] WITH (UPDLOCK"))AuthorAttempt.TrySetResult();
            if(context==Delivery&&PauseBeforeUser&&c.CommandText.Contains("[AspNetUsers] WITH (UPDLOCK")){PauseBeforeUser=false;BeforeUser.TrySetResult();await ReleaseUser.Task.WaitAsync(ct);}
            return r;
        }
        public override async ValueTask<DbDataReader> ReaderExecutedAsync(DbCommand c,CommandExecutedEventData e,DbDataReader r,CancellationToken ct=default){
            var context=e.Context!.ContextId.ToString();
            if(context==Delivery&&HoldAnnouncement&&c.CommandText.Contains("[Announcements] WITH (UPDLOCK")){HoldAnnouncement=false;AnnouncementHeld.TrySetResult();await ReleaseAnnouncement.Task.WaitAsync(ct);}
            if(context==Security&&HoldUser&&c.CommandText.Contains("[AspNetUsers] WITH (UPDLOCK")){HoldUser=false;UserHeld.TrySetResult();await ReleaseUser.Task.WaitAsync(ct);}
            return r;
        }
        public override Task CommandFailedAsync(DbCommand c,CommandErrorEventData e,CancellationToken ct=default){if(e.Exception is Microsoft.Data.SqlClient.SqlException sql)Errors.Add(sql.Number);return Task.CompletedTask;}
    }
    private static async Task<List<object>> Blocking(ServiceProvider p){
        using var s=p.CreateScope();var db=s.ServiceProvider.GetRequiredService<AppDbContext>();await db.Database.OpenConnectionAsync();IsolatedSqlMutationGuard.Verify(db.Database.GetDbConnection());
        using var cmd=db.Database.GetDbConnection().CreateCommand();cmd.CommandText="SELECT session_id,blocking_session_id,wait_type FROM sys.dm_exec_requests WHERE database_id=DB_ID() AND blocking_session_id>0";cmd.CommandTimeout=3;using var reader=await cmd.ExecuteReaderAsync();var rows=new List<object>();while(await reader.ReadAsync())rows.Add(new{Session=reader.GetInt16(0),BlockedBy=reader.GetInt16(1),Wait=reader.IsDBNull(2)?null:reader.GetString(2)});return rows;
    }
    [Phase1SqlFact]public async Task Announcement_authoring_delivery_and_revoke_follow_forced_three_party_lock_chain(){
        var probe=new Probe();using var p=await CompletionSqlServerTests.Provider(probe);string admin;Guid id;
        using(var s=p.CreateScope()){admin=await Seed(s.ServiceProvider,true);var db=s.ServiceProvider.GetRequiredService<AppDbContext>();var a=new Announcement{AuthorUserId=admin,Audience="all",Status="published",PublishedAt=DateTimeOffset.UtcNow,TitleEn="Guarded three-party fixture",ContentEn="Synthetic only"};db.Add(a);await db.SaveChangesAsync();id=a.Id;}
        using var authorScope=p.CreateScope();using var deliveryScope=p.CreateScope();using var securityScope=p.CreateScope();
        var authorDb=authorScope.ServiceProvider.GetRequiredService<AppDbContext>();var service=new AnnouncementService(authorDb);var version=(await service.ListAsync(Principal(admin),true)).Value!.Single(x=>x.Id==id).Version;
        var ticket=await Ticket(securityScope.ServiceProvider,admin);probe.Author=authorDb.ContextId.ToString();probe.Delivery=deliveryScope.ServiceProvider.GetRequiredService<AppDbContext>().ContextId.ToString();probe.Security=securityScope.ServiceProvider.GetRequiredService<AppDbContext>().ContextId.ToString();probe.HoldAnnouncement=true;probe.HoldUser=true;
        var delivery=Task.Run(()=>Phase5SqlTests.Delivery(deliveryScope.ServiceProvider,id,[admin]).RecoverAsync());Task<ServiceResult<esham.BLL.DTOs.Moderation.AnnouncementDto>>? author=null;Task<ServiceResult<bool>>? security=null;var waits=new List<object>();
        try{
            await probe.AnnouncementHeld.Task.WaitAsync(TimeSpan.FromSeconds(10));
            author=Task.Run(()=>service.SetStatusAsync(Principal(admin),id,new("archived",version)));await probe.AuthorAttempt.Task.WaitAsync(TimeSpan.FromSeconds(10));
            security=Task.Run(()=>Security(securityScope.ServiceProvider,new()).RevokeAsync(ticket,new(Password)));await probe.UserHeld.Task.WaitAsync(TimeSpan.FromSeconds(10));
            probe.ReleaseAnnouncement.TrySetResult();
            for(var n=0;n<40;n++){waits=await Blocking(p);if(waits.Count>=2)break;await Task.Delay(50);}
            Assert.True(waits.Count>=2,"Expected announcement -> user blocking chain was not observed.");
        }finally{probe.ReleaseAnnouncement.TrySetResult();probe.ReleaseUser.TrySetResult();await Task.WhenAll(new Task?[]{delivery,author,security}.OfType<Task>());}
        Assert.Equal(1,delivery.Result);Assert.Equal(ServiceFailure.None,author!.Result.Failure);Assert.Equal(ServiceFailure.None,security!.Result.Failure);Assert.Empty(probe.Errors);
        await File.WriteAllTextAsync(Path.Combine(Phase5SqlTests.Artifacts(),"hardening-three-party.json"),JsonSerializer.Serialize(new{waits,sqlErrors=probe.Errors.ToArray()}));
    }
    [Phase1SqlTheory][InlineData(true)][InlineData(false)]public async Task Delivery_rechecks_actual_membership_after_waiting_for_the_recipient(bool removeLearner){
        var probe=new Probe();using var p=await CompletionSqlServerTests.Provider(probe);var f=await LessonProgressSqlServerTests.Fixture(p);Guid id;
        using(var s=p.CreateScope()){var sp=s.ServiceProvider;Http(sp,f.Purchase.Learner);if(!removeLearner)Assert.Equal(esham.BLL.Interfaces.AccountFailure.None,(await sp.GetRequiredService<AccountService>().UpdateCurrentRoleAsync(Principal(f.Purchase.Learner),"instructor")).Failure);var db=sp.GetRequiredService<AppDbContext>();var a=new Announcement{AuthorUserId=f.Purchase.Owner,Audience="learners",Status="published",PublishedAt=DateTimeOffset.UtcNow,TitleEn="Membership race",ContentEn="Synthetic"};db.Add(a);await db.SaveChangesAsync();id=a.Id;}
        using var deliveryScope=p.CreateScope();probe.Delivery=deliveryScope.ServiceProvider.GetRequiredService<AppDbContext>().ContextId.ToString();probe.PauseBeforeUser=true;
        var delivery=Task.Run(()=>Phase5SqlTests.Delivery(deliveryScope.ServiceProvider,id,[f.Purchase.Learner]).RecoverAsync());
        try{await probe.BeforeUser.Task.WaitAsync(TimeSpan.FromSeconds(10));using var change=p.CreateScope();Http(change.ServiceProvider,f.Purchase.Learner);Assert.Equal(esham.BLL.Interfaces.AccountFailure.None,(await change.ServiceProvider.GetRequiredService<AccountService>().UpdateCurrentRoleAsync(Principal(f.Purchase.Learner),removeLearner?"instructor":"both")).Failure);}
        finally{probe.ReleaseUser.TrySetResult();}
        Assert.Equal(removeLearner?0:1,await delivery);Assert.Empty(probe.Errors);
    }
    private sealed class SecurityBarrier:DbCommandInterceptor{
        public bool Armed;private int entered;public TaskCompletionSource Both=new(TaskCreationOptions.RunContinuationsAsynchronously),Release=new(TaskCreationOptions.RunContinuationsAsynchronously);public System.Collections.Concurrent.ConcurrentBag<int> Errors=new();
        public override async ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(DbCommand c,CommandEventData e,InterceptionResult<DbDataReader> r,CancellationToken ct=default){if(Armed&&c.CommandText.Contains("[AspNetUsers] WITH (UPDLOCK")){if(Interlocked.Increment(ref entered)==2)Both.TrySetResult();await Release.Task.WaitAsync(ct);}return r;}
        public override Task CommandFailedAsync(DbCommand c,CommandErrorEventData e,CancellationToken ct=default){if(e.Exception is Microsoft.Data.SqlClient.SqlException sql)Errors.Add(sql.Number);return Task.CompletedTask;}
    }
    [Phase1SqlTheory][InlineData("reset")][InlineData("password")][InlineData("revoke")]
    public async Task Concurrent_recovery_and_security_operations_commit_one_credential_generation(string other){
        var barrier=new SecurityBarrier();using var p=await CompletionSqlServerTests.Provider(barrier);var f=await LessonProgressSqlServerTests.Fixture(p);string token;System.Security.Claims.ClaimsPrincipal ticket;string? stamp;
        using(var s=p.CreateScope()){var sp=s.ServiceProvider;ticket=await Ticket(sp,f.Purchase.Learner);var u=(await sp.GetRequiredService<UserManager<ApplicationUser>>().FindByIdAsync(f.Purchase.Learner))!;stamp=u.SecurityStamp;var capture=new PrivateRecoveryCapture();await Security(sp,capture).ForgotAsync(new(u.Email));token=capture.TakeForIsolatedTest(u.Email!)!;}
        async Task<ServiceFailure> Run(bool reset){using var s=p.CreateScope();var security=Security(s.ServiceProvider,new());return(reset||other=="reset"?await security.ResetAsync(new(token,"RaceResetPassword789!")):other=="password"?await security.PasswordAsync(ticket,new(Password,"RaceChangePassword789!")):await security.RevokeAsync(ticket,new(Password))).Failure;}
        barrier.Armed=true;var first=Task.Run(()=>Run(true));var second=Task.Run(()=>Run(false));try{await barrier.Both.Task.WaitAsync(TimeSpan.FromSeconds(10));}finally{barrier.Release.TrySetResult();}
        var results=await Task.WhenAll(first,second);Assert.Single(results,x=>x==ServiceFailure.None);Assert.Empty(barrier.Errors);
        using var v=p.CreateScope();var db=v.ServiceProvider.GetRequiredService<AppDbContext>();Assert.NotEqual(stamp,(await db.Users.SingleAsync(x=>x.Id==f.Purchase.Learner)).SecurityStamp);Assert.Equal(2,await db.PointTransactions.CountAsync(x=>x.EnrollmentId==f.Enrollment));Assert.Equal(0,(await db.Wallets.SingleAsync(x=>x.UserId==f.Purchase.Learner)).Balance);Assert.Equal(40,(await db.Wallets.SingleAsync(x=>x.UserId==f.Purchase.Owner)).Balance);
    }
    [Phase1SqlFact]public async Task Metrics_preserve_historical_completion_carried_lessons_and_event_time_queues(){
        using var p=await CompletionSqlServerTests.Provider();var f=await LessonProgressSqlServerTests.Fixture(p);var next=await LessonProgressSqlServerTests.NextVersion(p,f);
        using var s=p.CreateScope();var db=s.ServiceProvider.GetRequiredService<AppDbContext>();var e=await db.Enrollments.SingleAsync(x=>x.Id==f.Enrollment);e.EnrolledAt=DateTimeOffset.UtcNow.AddDays(-10);e.Status="completed";e.CompletedAt=null;
        var learner=await Seed(s.ServiceProvider);var second=new Enrollment{LearnerUserId=learner,CourseId=f.Purchase.Course,CourseVersionId=f.Purchase.Version,EnrolledAt=DateTimeOffset.UtcNow.AddDays(-10)};
        var task=new CourseTask{CourseVersionId=f.Purchase.Version,TitleEn="Historical queue task"};db.AddRange(second,task,new LessonProgress{EnrollmentId=second.Id,LessonId=f.Lesson,IsCompleted=true,CompletedAt=DateTimeOffset.UtcNow.AddDays(-9)});
        db.TaskSubmissions.AddRange(new TaskSubmission{EnrollmentId=e.Id,CourseTaskId=task.Id,Status="awaitingReview",SubmittedAt=DateTimeOffset.UtcNow.AddDays(-8)},new TaskSubmission{EnrollmentId=second.Id,CourseTaskId=task.Id,Status="awaitingReview",SubmittedAt=DateTimeOffset.UtcNow.AddDays(-1)});await db.SaveChangesAsync();
        var c=await db.Courses.SingleAsync(x=>x.Id==f.Purchase.Course);c.PublishedVersionId=next.Version;await db.SaveChangesAsync();
        var svc=new InstructorInsightsService(db);var all=JsonSerializer.SerializeToElement((await svc.Analytics(Principal(f.Purchase.Owner),f.Purchase.Course)).Value);
        Assert.Equal(1,all.GetProperty("Learners").GetProperty("Completed").GetInt32());Assert.Equal(1,all.GetProperty("Learners").GetProperty("AmbiguousHistorical").GetInt32());Assert.All(all.GetProperty("Sections").EnumerateArray(),x=>Assert.Equal(100,x.GetProperty("CompletionRate").GetDouble()));
        var week=JsonSerializer.SerializeToElement((await svc.Analytics(Principal(f.Purchase.Owner),f.Purchase.Course,"7d")).Value);Assert.Equal(0,week.GetProperty("Learners").GetProperty("Enrolled").GetInt32());Assert.Equal(1,week.GetProperty("TaskStats").GetProperty("AwaitingReview").GetInt32());Assert.Equal(2,all.GetProperty("TaskStats").GetProperty("AwaitingReview").GetInt32());
        Assert.Equal(f.Purchase.Version,(await db.Enrollments.SingleAsync(x=>x.Id==e.Id)).CourseVersionId);Assert.Equal(2,await db.PointTransactions.CountAsync(x=>x.EnrollmentId==e.Id));
    }
}
