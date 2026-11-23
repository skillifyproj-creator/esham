using System.Data.Common;
using System.Text.Json;
using esham.BLL.DTOs;
using esham.BLL.DTOs.Reviews;
using esham.BLL.Services;
using esham.DAL.Data;
using esham.DAL.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Xunit;
using static esham.Tests.AccountFinalizationTests;
using static esham.Tests.Phase5Tests;
namespace esham.Tests;
public sealed class Phase5SqlTests
{
    [Phase1SqlFact]public async Task Actual_republication_generations_remain_distinct_when_clock_is_behind_previous_publication(){
        using var p=await CompletionSqlServerTests.Provider();using var s=p.CreateScope();var db=s.ServiceProvider.GetRequiredService<AppDbContext>();var admin=await Seed(s.ServiceProvider,true);var future=DateTimeOffset.UtcNow.AddDays(1);var a=new Announcement{AuthorUserId=admin,Audience="all",Status="published",PublishedAt=future,TitleEn="Synthetic generation test",ContentEn="Clock regression fixture"};db.Add(a);await db.SaveChangesAsync();
        Assert.Equal(1,await Delivery(s.ServiceProvider,a.Id,[admin]).RecoverAsync());
        var service=new AnnouncementService(db);var version=(await service.ListAsync(Principal(admin),true)).Value!.Single(x=>x.Id==a.Id).Version;
        var draft=await service.SetStatusAsync(Principal(admin),a.Id,new("draft",version));Assert.Equal(ServiceFailure.None,draft.Failure);var published=await service.SetStatusAsync(Principal(admin),a.Id,new("published",draft.Value!.Version));Assert.Equal(ServiceFailure.None,published.Failure);Assert.Equal(future.AddTicks(1),published.Value!.PublishedAt);
        Assert.Equal(1,await Delivery(s.ServiceProvider,a.Id,[admin]).RecoverAsync());Assert.Equal(0,await Delivery(s.ServiceProvider,a.Id,[admin]).RecoverAsync());
    }
    private sealed class AnnouncementRaceProbe:DbCommandInterceptor{
        public string? ActorContext;public string? SecurityContext;public bool Armed;public TaskCompletionSource ActorReached=new(TaskCreationOptions.RunContinuationsAsynchronously),DeliveryLocked=new(TaskCreationOptions.RunContinuationsAsynchronously),SecurityLocked=new(TaskCreationOptions.RunContinuationsAsynchronously),Release=new(TaskCreationOptions.RunContinuationsAsynchronously);public System.Collections.Concurrent.ConcurrentBag<int> Errors=new();
        public override async ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(DbCommand c,CommandEventData e,InterceptionResult<DbDataReader> r,CancellationToken ct=default){if(Armed&&e.Context!.ContextId.ToString()==ActorContext&&c.CommandText.Contains("[Announcements] WITH (UPDLOCK")){Armed=false;ActorReached.TrySetResult();await Release.Task.WaitAsync(ct);}return r;}
        public override ValueTask<DbDataReader> ReaderExecutedAsync(DbCommand c,CommandExecutedEventData e,DbDataReader r,CancellationToken ct=default){if(e.Context!.ContextId.ToString()!=ActorContext&&c.CommandText.Contains("[Announcements] WITH (UPDLOCK"))DeliveryLocked.TrySetResult();if(e.Context!.ContextId.ToString()==SecurityContext&&c.CommandText.Contains("[AspNetUsers] WITH (UPDLOCK"))SecurityLocked.TrySetResult();return ValueTask.FromResult(r);}
        public override Task CommandFailedAsync(DbCommand c,CommandErrorEventData e,CancellationToken ct=default){if(e.Exception is Microsoft.Data.SqlClient.SqlException sql)Errors.Add(sql.Number);return Task.CompletedTask;}
    }
    [Phase1SqlFact]public async Task Announcement_authoring_delivery_and_revocation_race_has_no_partial_writes(){
        var probe=new AnnouncementRaceProbe();using var p=await CompletionSqlServerTests.Provider(probe);string admin;Guid id;
        using(var s=p.CreateScope()){admin=await Seed(s.ServiceProvider,true);var db=s.ServiceProvider.GetRequiredService<AppDbContext>();var a=new Announcement{AuthorUserId=admin,Audience="all",Status="published",PublishedAt=DateTimeOffset.UtcNow,TitleEn="Synthetic publication race",ContentEn="Isolated only"};db.Add(a);await db.SaveChangesAsync();id=a.Id;}
        using var actorScope=p.CreateScope();var actorDb=actorScope.ServiceProvider.GetRequiredService<AppDbContext>();var service=new AnnouncementService(actorDb);var version=(await service.ListAsync(Principal(admin),true)).Value!.Single(x=>x.Id==id).Version;probe.ActorContext=actorDb.ContextId.ToString();probe.Armed=true;
        using var securityScope=p.CreateScope();var ticket=await Ticket(securityScope.ServiceProvider,admin);probe.SecurityContext=securityScope.ServiceProvider.GetRequiredService<AppDbContext>().ContextId.ToString();
        var change=Task.Run(()=>service.SetStatusAsync(Principal(admin),id,new("archived",version)));await probe.ActorReached.Task.WaitAsync(TimeSpan.FromSeconds(10));
        var security=Task.Run(()=>Security(securityScope.ServiceProvider,new()).RevokeAsync(ticket,new(Password)));await probe.SecurityLocked.Task.WaitAsync(TimeSpan.FromSeconds(10));
        var delivery=Task.Run(async()=>{using var s=p.CreateScope();return await Delivery(s.ServiceProvider,id,[admin]).RecoverAsync();});try{await probe.DeliveryLocked.Task.WaitAsync(TimeSpan.FromSeconds(10));}finally{probe.Release.TrySetResult();}
        await Task.WhenAll(change,delivery,security);Assert.Equal(ServiceFailure.None,change.Result.Failure);Assert.Equal(ServiceFailure.None,security.Result.Failure);await File.WriteAllTextAsync(Path.Combine(Artifacts(),"announcement-publish-race-diagnostics.json"),JsonSerializer.Serialize(new{sqlErrors=probe.Errors.ToArray()}));Assert.Empty(probe.Errors);
    }
    [Phase1SqlFact]public async Task Capability_flags_fail_closed_independently_on_the_actual_isolated_target(){
        using var p=await CompletionSqlServerTests.Provider();using var s=p.CreateScope();var db=s.ServiceProvider.GetRequiredService<AppDbContext>();var options=new Phase5Options{ReviewsEnabled=true,ApprovedIsolatedDatabase=CompletionMutationGate.Catalog};var gate=new Phase5MutationGate(db,Options.Create(options));
        Assert.True(await gate.IsEnabledAsync(Phase5Capability.Reviews));Assert.False(await gate.IsEnabledAsync(Phase5Capability.AccountSecurity));Assert.False(await gate.IsEnabledAsync(Phase5Capability.AnnouncementDelivery));options.ApprovedIsolatedDatabase="db75401";Assert.False(await gate.IsEnabledAsync(Phase5Capability.Reviews));
    }
    [Phase1SqlTheory][InlineData(4)][InlineData(5)][InlineData(6)]public Task Mixed_Phases1_through5_share_participants_without_partial_writes(int wave)=>new Phase4HardeningSqlTests().RunMixed(wave,true);
    internal static string Artifacts(){for(DirectoryInfo? d=new(AppContext.BaseDirectory);d!=null;d=d.Parent)if(File.Exists(Path.Combine(d.FullName,"backend/esham.Tests/esham.Tests.csproj"))){var p=Path.GetFullPath(Path.Combine(d.FullName,"artifacts","phase5-results"));Directory.CreateDirectory(p);return p;}throw new InvalidOperationException("Repository root required.");}
    [Phase1SqlFact]public async Task Concurrent_review_replay_edit_reply_and_withdraw_are_atomic(){
        using var p=await CompletionSqlServerTests.Provider();var f=await LessonProgressSqlServerTests.Fixture(p);var input=Write(f.Purchase.Version);
        async Task<ServiceResult<ReviewMutation>> Create(){using var s=p.CreateScope();return await Reviews(s.ServiceProvider).WriteAsync(Principal(f.Purchase.Learner),f.Enrollment,input);}
        var results=await Task.WhenAll(Enumerable.Range(0,6).Select(_=>Create()));Assert.All(results,r=>Assert.Equal(ServiceFailure.None,r.Failure));Assert.Single(results.Select(x=>x.Value!.Review!.Id).Distinct());
        var r=results[0].Value!.Review!;
        async Task<ServiceResult<ReviewMutation>> Edit(bool reply){using var s=p.CreateScope();var svc=Reviews(s.ServiceProvider);return reply?await svc.ReplyAsync(Principal(f.Purchase.Owner),f.Enrollment,new(Guid.NewGuid(),r.Version,"A concurrent instructor reply")):await svc.WriteAsync(Principal(f.Purchase.Learner),f.Enrollment,Write(f.Purchase.Version,r.Version)with{Rating=4});}
        var race=await Task.WhenAll(Edit(true),Edit(false));Assert.Single(race,x=>x.Failure==ServiceFailure.None);Assert.Single(race,x=>x.Failure==ServiceFailure.Conflict);
        using var verify=p.CreateScope();var db=verify.ServiceProvider.GetRequiredService<AppDbContext>();Assert.Single(await db.CourseReviews.Where(x=>x.EnrollmentId==f.Enrollment).ToListAsync());
        Assert.Equal(2,await db.PointTransactions.CountAsync(x=>x.EnrollmentId==f.Enrollment));Assert.Equal(0,(await db.Wallets.SingleAsync(x=>x.UserId==f.Purchase.Learner)).Balance);Assert.Equal(40,(await db.Wallets.SingleAsync(x=>x.UserId==f.Purchase.Owner)).Balance);
        var live=(await Reviews(verify.ServiceProvider).GetAsync(Principal(f.Purchase.Learner),f.Enrollment)).Value!.Review!;var delete=new ReviewRemove(Guid.NewGuid(),live.Version);
        async Task<ServiceFailure> Remove(){using var s=p.CreateScope();return (await Reviews(s.ServiceProvider).RemoveAsync(Principal(f.Purchase.Learner),f.Enrollment,delete)).Failure;}
        Assert.All(await Task.WhenAll(Remove(),Remove()),x=>Assert.Equal(ServiceFailure.None,x));Assert.Null((await Create()).Value!.Review);
    }
    private sealed class FailAfterSave:SaveChangesInterceptor{
        public bool Armed;public bool User;
        public override ValueTask<int> SavedChangesAsync(SaveChangesCompletedEventData e,int result,CancellationToken ct=default){
            if(Armed&&(User?e.Context!.ChangeTracker.Entries<ApplicationUser>().Any():e.Context!.ChangeTracker.Entries<CourseReview>().Any())){Armed=false;throw new InvalidOperationException("Synthetic Phase5 intermediate failure.");}return ValueTask.FromResult(result);
        }
    }
    private sealed class LostAcknowledgement:DbTransactionInterceptor{
        public bool Armed;
        public override Task TransactionCommittedAsync(DbTransaction tx,TransactionEndEventData e,CancellationToken ct=default){if(Armed&&e.Context!.ChangeTracker.Entries<AdminActivityLog>().Any(x=>x.Entity.TargetType=="LearnerReview")){Armed=false;throw new TimeoutException("Synthetic lost commit acknowledgement.");}return Task.CompletedTask;}
    }
    [Phase1SqlFact]public async Task Review_commit_acknowledgement_loss_reconciles_one_persisted_operation(){
        var fault=new LostAcknowledgement();using var p=await CompletionSqlServerTests.Provider(fault);var f=await LessonProgressSqlServerTests.Fixture(p);fault.Armed=true;using var s=p.CreateScope();var svc=Reviews(s.ServiceProvider);var input=Write(f.Purchase.Version);var result=await svc.WriteAsync(Principal(f.Purchase.Learner),f.Enrollment,input);Assert.Equal(ServiceFailure.None,result.Failure);Assert.True(result.Value!.Replayed);Assert.True((await svc.WriteAsync(Principal(f.Purchase.Learner),f.Enrollment,input)).Value!.Replayed);
        Assert.Equal(1,await s.ServiceProvider.GetRequiredService<AppDbContext>().CourseReviews.CountAsync(x=>x.EnrollmentId==f.Enrollment));
    }
    [Phase1SqlFact]public async Task Review_audit_and_notice_rollback_after_intermediate_persistence(){
        var fail=new FailAfterSave();using var p=await CompletionSqlServerTests.Provider(fail);var f=await LessonProgressSqlServerTests.Fixture(p);var input=Write(f.Purchase.Version);fail.Armed=true;
        using(var s=p.CreateScope())await Assert.ThrowsAsync<InvalidOperationException>(()=>Reviews(s.ServiceProvider).WriteAsync(Principal(f.Purchase.Learner),f.Enrollment,input));
        using var v=p.CreateScope();var db=v.ServiceProvider.GetRequiredService<AppDbContext>();Assert.False(await db.CourseReviews.AnyAsync(x=>x.EnrollmentId==f.Enrollment));Assert.False(await db.AdminActivityLogs.AnyAsync(x=>x.CourseId==f.Purchase.Course));Assert.False(await db.Notifications.AnyAsync(x=>x.NotificationType=="review.created"&&x.RecipientUserId==f.Purchase.Owner));
        Assert.Equal(ServiceFailure.None,(await Reviews(v.ServiceProvider).WriteAsync(Principal(f.Purchase.Learner),f.Enrollment,input)).Failure);
    }
    [Phase1SqlFact]public async Task Review_publication_race_never_retargets_the_original_purchase(){
        using var p=await CompletionSqlServerTests.Provider();var f=await LessonProgressSqlServerTests.Fixture(p);var next=await LessonProgressSqlServerTests.NextVersion(p,f);var start=new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var publish=Task.Run(async()=>{await start.Task;await LessonProgressSqlServerTests.Publish(p,f,next.Version);});
        var review=Task.Run(async()=>{await start.Task;using var s=p.CreateScope();return await Reviews(s.ServiceProvider).WriteAsync(Principal(f.Purchase.Learner),f.Enrollment,Write(f.Purchase.Version));});start.TrySetResult();await Task.WhenAll(publish,review);Assert.Equal(ServiceFailure.None,review.Result.Failure);Assert.Equal(f.Purchase.Version,review.Result.Value!.Review!.CourseVersionId);
        using var v=p.CreateScope();var db=v.ServiceProvider.GetRequiredService<AppDbContext>();Assert.Equal(f.Purchase.Version,(await db.Enrollments.SingleAsync(x=>x.Id==f.Enrollment)).CourseVersionId);Assert.Equal(2,await db.EnrollmentVersionAccess.CountAsync(x=>x.EnrollmentId==f.Enrollment));Assert.Equal(2,await db.PointTransactions.CountAsync(x=>x.EnrollmentId==f.Enrollment));
    }
    [Phase1SqlFact]public async Task Independent_duplicate_review_requests_and_cross_course_reuse_never_change_another_review(){
        using var p=await CompletionSqlServerTests.Provider();var f=await LessonProgressSqlServerTests.Fixture(p);var other=await LessonProgressSqlServerTests.Fixture(p);
        var input=Write(f.Purchase.Version);using(var s=p.CreateScope())Assert.Equal(ServiceFailure.None,(await Reviews(s.ServiceProvider).WriteAsync(Principal(f.Purchase.Learner),f.Enrollment,input)).Failure);
        async Task<ServiceFailure> Duplicate(){using var s=p.CreateScope();return(await Reviews(s.ServiceProvider).WriteAsync(Principal(f.Purchase.Learner),f.Enrollment,Write(f.Purchase.Version))).Failure;}
        Assert.All(await Task.WhenAll(Duplicate(),Duplicate()),x=>Assert.Equal(ServiceFailure.Conflict,x));
        using var v=p.CreateScope();var db=v.ServiceProvider.GetRequiredService<AppDbContext>();
        // Entitlement-only synthetic graph for cross-course review identity; no fabricated financial transfers.
        var e=new Enrollment{LearnerUserId=f.Purchase.Learner,CourseId=other.Purchase.Course,CourseVersionId=other.Purchase.Version};db.AddRange(e,new EnrollmentVersionAccess{EnrollmentId=e.Id,CourseId=e.CourseId,CourseVersionId=e.CourseVersionId,Reason="enrolled"});await db.SaveChangesAsync();
        var r=await Reviews(v.ServiceProvider).WriteAsync(Principal(f.Purchase.Learner),e.Id,input with{ExpectedCourseVersionId=e.CourseVersionId});Assert.Equal("request_conflict",r.Code);Assert.False(await db.CourseReviews.AnyAsync(x=>x.EnrollmentId==e.Id));
    }
    [Phase1SqlFact]public async Task Password_race_and_failure_preserve_stamp_and_lockout_invariants(){
        var fault=new FailAfterSave{User=true};using var p=await CompletionSqlServerTests.Provider(fault);var f=await LessonProgressSqlServerTests.Fixture(p);System.Security.Claims.ClaimsPrincipal actor;
        using(var s=p.CreateScope())actor=await Ticket(s.ServiceProvider,f.Purchase.Learner);
        async Task<ServiceFailure> Change(){using var s=p.CreateScope();Http(s.ServiceProvider,f.Purchase.Learner);return(await Security(s.ServiceProvider,new()).PasswordAsync(actor,new(Password,"NewSqlPassword456!"))).Failure;}
        var race=await Task.WhenAll(Change(),Change());Assert.Single(race,x=>x==ServiceFailure.None);Assert.Single(race,x=>x==ServiceFailure.Unauthenticated);
        using(var s=p.CreateScope()){var db=s.ServiceProvider.GetRequiredService<AppDbContext>();var manager=s.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();var u=await manager.FindByIdAsync(f.Purchase.Learner);var stamp=u!.SecurityStamp;var ticket=await Ticket(s.ServiceProvider,u.Id);fault.Armed=true;
            await Assert.ThrowsAsync<InvalidOperationException>(()=>Security(s.ServiceProvider,new()).PasswordAsync(ticket,new("NewSqlPassword456!","FailedSqlPassword789!")));
            db.ChangeTracker.Clear();u=await manager.FindByIdAsync(u.Id);Assert.Equal(stamp,u!.SecurityStamp);Assert.True(await manager.CheckPasswordAsync(u,"NewSqlPassword456!"));}
    }
    [Phase1SqlFact]public async Task Queued_profile_request_cannot_refresh_a_cookie_after_session_revocation(){
        using var p=await CompletionSqlServerTests.Provider();var f=await LessonProgressSqlServerTests.Fixture(p);System.Security.Claims.ClaimsPrincipal actor;
        using(var s=p.CreateScope())actor=await Ticket(s.ServiceProvider,f.Purchase.Learner);
        using var blocker=p.CreateScope();var db=blocker.ServiceProvider.GetRequiredService<AppDbContext>();Task<esham.BLL.Interfaces.AccountResult>? profile=null;
        await db.Database.CreateExecutionStrategy().ExecuteAsync(async()=>{
            await using var tx=await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
            var u=await db.Users.FromSqlInterpolated($"SELECT * FROM [AspNetUsers] WITH (UPDLOCK,HOLDLOCK) WHERE [Id]={f.Purchase.Learner}").SingleAsync();
            using(ExecutionContext.SuppressFlow())profile=Task.Run(async()=>{using var s=p.CreateScope();Http(s.ServiceProvider,f.Purchase.Learner);return await s.ServiceProvider.GetRequiredService<AccountService>().UpdateCurrentRoleAsync(actor,"instructor");});
            await Task.Delay(100);Assert.False(profile.IsCompleted);Assert.True((await blocker.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>().UpdateSecurityStampAsync(u)).Succeeded);await tx.CommitAsync();
        });
        Assert.Equal(esham.BLL.Interfaces.AccountFailure.Unauthenticated,(await profile!).Failure);
        using var verify=p.CreateScope();var user=await verify.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>().FindByIdAsync(f.Purchase.Learner);Assert.Equal("both",user!.Role);
    }
    private static async Task<(Guid Id,string Learner,string[] Recipients)> AnnouncementGraph(ServiceProvider p,int total){
        var f=await LessonProgressSqlServerTests.Fixture(p);using var s=p.CreateScope();var db=s.ServiceProvider.GetRequiredService<AppDbContext>();var role=await db.Roles.SingleAsync(x=>x.NormalizedName=="LEARNER");
        var a=new Announcement{AuthorUserId=f.Purchase.Owner,Audience="learners",Status="published",PublishedAt=DateTimeOffset.UtcNow,TitleEn="Phase5 synthetic fan-out",ContentEn="Isolated private synthetic delivery only."};db.Add(a);
        var recipients=new List<string>{f.Purchase.Learner};for(var i=1;i<total;i++){var id=Guid.NewGuid().ToString();recipients.Add(id);db.AddRange(new ApplicationUser{Id=id,UserName="delivery_"+id,NormalizedUserName="DELIVERY_"+id,SecurityStamp=Guid.NewGuid().ToString()},new IdentityUserRole<string>{UserId=id,RoleId=role.Id});}
        await db.SaveChangesAsync();return(a.Id,f.Purchase.Learner,recipients.ToArray());
    }
    internal static AnnouncementDeliveryService Delivery(IServiceProvider s,Guid id,string[]? recipients=null){var db=s.GetRequiredService<AppDbContext>();return new(db,Gate(db),Options.Create(new Phase5Options{AnnouncementIds=[id],AnnouncementRecipientIds=recipients??[]}));}
    private sealed class DeliveryFailure:SaveChangesInterceptor{
        public string? Poison;public bool Enabled;
        public override ValueTask<InterceptionResult<int>> SavingChangesAsync(DbContextEventData e,InterceptionResult<int> r,CancellationToken ct=default){if(Enabled&&e.Context!.ChangeTracker.Entries<Notification>().Any(x=>x.Entity.NotificationType=="announcement.published"&&x.Entity.RecipientUserId==Poison))throw new InvalidOperationException("Synthetic poison recipient.");return ValueTask.FromResult(r);}
    }
    [Phase1SqlFact]public async Task Poison_delivery_batch_rolls_back_continues_and_is_recovered(){
        var fault=new DeliveryFailure();using var p=await CompletionSqlServerTests.Provider(fault);var graph=await AnnouncementGraph(p,57);fault.Poison=graph.Recipients.OrderBy(x=>x,StringComparer.Ordinal).First();fault.Enabled=true;var failures=new List<Guid>();
        using(var s=p.CreateScope()){Assert.Equal(7,await Delivery(s.ServiceProvider,graph.Id,graph.Recipients).RecoverAsync(default,failures.Add));Assert.Single(failures);}
        fault.Enabled=false;using(var s=p.CreateScope())Assert.Equal(50,await Delivery(s.ServiceProvider,graph.Id,graph.Recipients).RecoverAsync());
    }
    private sealed class InterruptDelivery:DbTransactionInterceptor{
        public CancellationTokenSource? Stop;
        public override Task TransactionCommittedAsync(DbTransaction t,TransactionEndEventData e,CancellationToken ct=default){if(Stop!=null&&e.Context!.ChangeTracker.Entries<Notification>().Any(x=>x.Entity.NotificationType=="announcement.published")){Stop.Cancel();Stop=null;}return Task.CompletedTask;}
    }
    [Phase1SqlFact]public async Task Delivery_interruption_resumes_in_a_separate_process_without_duplicate_read_state(){
        var interrupt=new InterruptDelivery();using var p=await CompletionSqlServerTests.Provider(interrupt);var graph=await AnnouncementGraph(p,57);using var stop=new CancellationTokenSource();interrupt.Stop=stop;
        using(var s=p.CreateScope())await Assert.ThrowsAnyAsync<OperationCanceledException>(()=>Delivery(s.ServiceProvider,graph.Id,graph.Recipients).RecoverAsync(stop.Token));
        var file=Path.Combine(Artifacts(),"delivery-restart-"+Guid.NewGuid().ToString("N")+".json");await File.WriteAllTextAsync(file,JsonSerializer.Serialize(new{graph.Id,graph.Recipients}));
        var start=new System.Diagnostics.ProcessStartInfo("dotnet"){UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true,RedirectStandardError=true};
        foreach(var arg in new[]{"test",Path.GetFullPath(Path.Combine(Artifacts(),"../../backend/esham.Tests/esham.Tests.csproj")),"--no-build","-p:OutputPath="+AppContext.BaseDirectory,"--filter","FullyQualifiedName~Phase5RecoveryChildTests.Resume","--logger","trx;LogFileName=delivery-child-"+Guid.NewGuid().ToString("N")+".trx","--results-directory",Artifacts()})start.ArgumentList.Add(arg);
        start.Environment["ESHAM_PHASE5_RECOVERY_ACTION"]="resume";start.Environment["ESHAM_PHASE5_RECOVERY_FILE"]=file;
        using var child=System.Diagnostics.Process.Start(start)!;var output=child.StandardOutput.ReadToEndAsync();var error=child.StandardError.ReadToEndAsync();await child.WaitForExitAsync().WaitAsync(TimeSpan.FromSeconds(60));await File.WriteAllTextAsync(file+".log",await output+await error);Assert.Equal(0,child.ExitCode);
        using var v=p.CreateScope();Assert.Equal(0,await Delivery(v.ServiceProvider,graph.Id,graph.Recipients).RecoverAsync());
    }
    [Phase1SqlFact]public async Task Fanout_pagination_interruption_concurrent_workers_and_republish_preserve_read_state(){
        using var p=await CompletionSqlServerTests.Provider();var graph=await AnnouncementGraph(p,57);
        // All other fixture users are eligible too: validate this graph's audience by deterministic generation IDs.
        using(var s=p.CreateScope())Assert.Equal(57,await Delivery(s.ServiceProvider,graph.Id,graph.Recipients).RecoverAsync());
        using(var s=p.CreateScope()){var db=s.ServiceProvider.GetRequiredService<AppDbContext>();var a=await db.Announcements.SingleAsync(x=>x.Id==graph.Id);var notice=await db.Notifications.SingleAsync(x=>x.Id==AnnouncementDeliveryService.Notice(graph.Id,a.PublishedAt!.Value,graph.Learner));notice.IsRead=true;notice.ReadAt=DateTimeOffset.UtcNow;await db.SaveChangesAsync();}
        async Task<int> Scan(){using var s=p.CreateScope();return await Delivery(s.ServiceProvider,graph.Id,graph.Recipients).RecoverAsync();}
        Assert.All(await Task.WhenAll(Scan(),Scan()),x=>Assert.Equal(0,x));
        using(var s=p.CreateScope()){var db=s.ServiceProvider.GetRequiredService<AppDbContext>();var a=await db.Announcements.SingleAsync(x=>x.Id==graph.Id);var old=AnnouncementDeliveryService.Notice(a.Id,a.PublishedAt!.Value,graph.Learner);Assert.True((await db.Notifications.SingleAsync(x=>x.Id==old)).IsRead);a.PublishedAt=a.PublishedAt.Value.AddTicks(1);await db.SaveChangesAsync();}
        Assert.True(await Scan()>50);
    }
    [Phase1SqlFact]public async Task Metrics_translate_to_owner_scoped_sql_and_match_the_ledger(){
        using var p=await CompletionSqlServerTests.Provider();var f=await LessonProgressSqlServerTests.Fixture(p);using var s=p.CreateScope();var db=s.ServiceProvider.GetRequiredService<AppDbContext>();var service=new InstructorInsightsService(db);
        var r=await service.Analytics(Principal(f.Purchase.Owner),f.Purchase.Course);Assert.Equal(ServiceFailure.None,r.Failure);var data=JsonSerializer.SerializeToElement(r.Value);Assert.Equal(20,data.GetProperty("EarnedPoints").GetInt64());Assert.Equal(1,data.GetProperty("Learners").GetProperty("Enrolled").GetInt32());Assert.Equal(0,data.GetProperty("Learners").GetProperty("Completed").GetInt32());
        Assert.Equal(ServiceFailure.NotFound,(await service.Analytics(Principal(f.Purchase.Learner),f.Purchase.Course)).Failure);
    }
    private sealed class QueryCount:DbCommandInterceptor{public bool Armed;public int Count;public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(DbCommand c,CommandEventData e,InterceptionResult<DbDataReader> r,CancellationToken ct=default){if(Armed)Interlocked.Increment(ref Count);return ValueTask.FromResult(r);}}
    [Phase1SqlFact]public async Task Metrics_query_count_remains_constant_as_the_synthetic_enrollment_cohort_grows(){
        var count=new QueryCount();using var p=await CompletionSqlServerTests.Provider(count);var f=await LessonProgressSqlServerTests.Fixture(p);
        async Task<(int Queries,int Enrolled)> Read(){count.Count=0;count.Armed=true;try{using var s=p.CreateScope();var result=await new InstructorInsightsService(s.ServiceProvider.GetRequiredService<AppDbContext>()).Analytics(Principal(f.Purchase.Owner),f.Purchase.Course);Assert.Equal(ServiceFailure.None,result.Failure);return(count.Count,JsonSerializer.SerializeToElement(result.Value).GetProperty("Learners").GetProperty("Enrolled").GetInt32());}finally{count.Armed=false;}}
        var before=await Read();using(var s=p.CreateScope()){var db=s.ServiceProvider.GetRequiredService<AppDbContext>();for(var i=0;i<120;i++){var id=Guid.NewGuid().ToString();db.AddRange(new ApplicationUser{Id=id,UserName="metric_"+id,NormalizedUserName="METRIC_"+id,SecurityStamp=Guid.NewGuid().ToString()},new Enrollment{LearnerUserId=id,CourseId=f.Purchase.Course,CourseVersionId=f.Purchase.Version});}await db.SaveChangesAsync();}
        var after=await Read();Assert.Equal(1,before.Enrolled);Assert.Equal(121,after.Enrolled);Assert.Equal(before.Queries,after.Queries);Assert.InRange(after.Queries,1,25);
    }
}
