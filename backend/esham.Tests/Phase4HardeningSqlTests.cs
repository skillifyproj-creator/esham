using System.Data.Common;
using System.Collections.Concurrent;
using System.Text.Json;
using esham.BLL.DTOs;
using esham.BLL.Interfaces;
using esham.BLL.Services;
using esham.DAL.Data;
using esham.DAL.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Xunit;
using static esham.Tests.AccountFinalizationTests;
using static esham.Tests.LearnerLearningTests;
namespace esham.Tests;

public sealed class Phase4HardeningSqlTests
{
    private static string RepositoryRoot(){
        foreach(var start in new[]{AppContext.BaseDirectory,Environment.CurrentDirectory})
            for(DirectoryInfo? directory=new(start);directory!=null;directory=directory.Parent)
                if(File.Exists(Path.Combine(directory.FullName,"backend/esham.Tests/esham.Tests.csproj"))&&Directory.Exists(Path.Combine(directory.FullName,"frontend")))return directory.FullName;
        throw new InvalidOperationException("Repository root required for isolated recovery artifacts.");
    }
    internal static string Artifacts(){var repo=RepositoryRoot();var selected=Environment.GetEnvironmentVariable("ESHAM_PHASE4_HARDENING_ARTIFACTS");var p=selected==null?Path.Combine(repo,"artifacts","phase4-hardening"):Path.GetFullPath(selected);if(selected!=null&&!p.Equals(Path.Combine(repo,"artifacts","phase5-results","phase4-hardening"),StringComparison.OrdinalIgnoreCase))throw new InvalidOperationException("Dedicated Phase5 regression directory required.");Directory.CreateDirectory(p);return p;}
    [Phase1SqlFact]public async Task Concurrent_GET_and_completion_return_consistent_before_or_after_projection(){
        var barrier=new HoldEnrollmentRead();using var p=await CompletionSqlServerTests.Provider(barrier);var f=await LessonProgressSqlServerTests.Fixture(p);
        using(var scope=p.CreateScope())await CompletionTests.Earn(scope.ServiceProvider.GetRequiredService<AppDbContext>(),f);
        barrier.Armed=true;
        var read=Task.Run(async()=>{using var scope=p.CreateScope();return await CompletionSqlServerTests.Service(scope.ServiceProvider).GetAsync(Principal(f.Purchase.Learner),f.Enrollment);});
        await barrier.Reached.Task.WaitAsync(TimeSpan.FromSeconds(15));
        var write=Task.Run(async()=>{using var scope=p.CreateScope();return await CompletionSqlServerTests.Service(scope.ServiceProvider).ReconcileAsync(Principal(f.Purchase.Learner),f.Enrollment,f.Purchase.Version);});
        try {await Task.Delay(150);Assert.False(write.IsCompleted);}finally{barrier.Release.TrySetResult();}
        var before=(await read).Value!;Assert.Equal("active",before.Status);Assert.Null(before.Certificate);Assert.NotEqual("historical_completion_ambiguous",before.ReasonCode);
        Assert.Equal("completed",(await write).Value!.Status);
        using var verify=p.CreateScope();var after=(await CompletionSqlServerTests.Service(verify.ServiceProvider).GetAsync(Principal(f.Purchase.Learner),f.Enrollment)).Value!;
        Assert.Equal("completed",after.Status);Assert.NotNull(after.Certificate);Assert.NotNull(after.CompletedAt);Assert.Null(after.ReasonCode);
    }
    private sealed class HoldEnrollmentRead:DbCommandInterceptor{
        public bool Armed;public TaskCompletionSource Reached=new(TaskCreationOptions.RunContinuationsAsynchronously),Release=new(TaskCreationOptions.RunContinuationsAsynchronously);
        public override async ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(DbCommand c,CommandEventData e,InterceptionResult<DbDataReader> r,CancellationToken ct=default){
            if(Armed&&e.Context!.Database.CurrentTransaction!=null&&c.CommandText.Contains("FROM [Enrollments]")){Armed=false;Reached.TrySetResult();await Release.Task.WaitAsync(ct);}return r;
        }
    }
    private sealed class RecoveryFault:SaveChangesInterceptor{
        public Guid? Poison;public bool Enabled;
        public override ValueTask<InterceptionResult<int>> SavingChangesAsync(DbContextEventData e,InterceptionResult<int> r,CancellationToken ct=default){
            if(Enabled&&e.Context!.ChangeTracker.Entries<Certificate>().Any(x=>x.Entity.EnrollmentId==Poison))throw new InvalidOperationException("Synthetic poison row.");return ValueTask.FromResult(r);
        }
    }
    private sealed class InterruptAfterCommit:DbTransactionInterceptor{
        public CancellationTokenSource? Stop;public int Remaining;
        public override Task TransactionCommittedAsync(DbTransaction t,TransactionEndEventData e,CancellationToken ct=default){if(Stop!=null&&e.Context!.ChangeTracker.Entries<Certificate>().Any()&&Interlocked.Decrement(ref Remaining)==0)Stop.Cancel();return Task.CompletedTask;}
    }
    private static async Task<(LearningFixture Fixture,List<Guid> Enrollments)> RecoveryGraph(ServiceProvider p,int total){
        var f=await LessonProgressSqlServerTests.Fixture(p);using var scope=p.CreateScope();var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();Assert.True(await CompletionSqlServerTests.Gate(db).IsEnabledAsync());
        await CompletionTests.Earn(db,f);var ids=new List<Guid>{f.Enrollment};var role=await db.Roles.SingleAsync(x=>x.NormalizedName=="LEARNER");
        // Fresh unloggable fixture identities, not copies of shared accounts. No wallet repair/transfer.
        for(int i=1;i<total;i++){
            var id=Guid.NewGuid().ToString();var name="rec_"+id.Replace("-","")[..16];var u=new ApplicationUser{Id=id,UserName=name,NormalizedUserName=name.ToUpperInvariant(),Email=name+"@example.test",NormalizedEmail=(name+"@example.test").ToUpperInvariant(),SecurityStamp=Guid.NewGuid().ToString(),Name="Synthetic recovery learner",Role="learner",Goal=0,Interests=[0]};
            var en=new Enrollment{LearnerUserId=id,CourseId=f.Purchase.Course,CourseVersionId=f.Purchase.Version};ids.Add(en.Id);
            db.AddRange(u,new IdentityUserRole<string>{UserId=id,RoleId=role.Id},en,new EnrollmentVersionAccess{EnrollmentId=en.Id,CourseId=en.CourseId,CourseVersionId=en.CourseVersionId,Reason="enrolled"});
            foreach(var lesson in new[]{f.Lesson,f.Article})db.LessonProgressRecords.Add(new(){EnrollmentId=en.Id,LessonId=lesson,IsCompleted=true,CompletedAt=DateTimeOffset.UtcNow});
        }
        await db.SaveChangesAsync();return(f,ids);
    }
    [Phase1SqlFact]public async Task Recovery_crosses_fifty_rows_continues_after_poison_and_retries_without_duplicates(){
        var fault=new RecoveryFault();using var p=await CompletionSqlServerTests.Provider(fault);var (f,ids)=await RecoveryGraph(p,62);fault.Poison=ids[3];fault.Enabled=true;
        var failures=new List<Guid>();using(var scope=p.CreateScope())await CompletionSqlServerTests.Service(scope.ServiceProvider).RecoverAsync(default,failures.Add,f.Purchase.Course);
        Assert.Equal(new[]{ids[3]},failures);
        using(var scope=p.CreateScope()){var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();Assert.Equal(61,await db.Certificates.CountAsync(x=>ids.Contains(x.EnrollmentId)));Assert.Null((await db.Enrollments.SingleAsync(x=>x.Id==ids[3])).CompletedAt);}
        fault.Enabled=false;using(var scope=p.CreateScope())await CompletionSqlServerTests.Service(scope.ServiceProvider).RecoverAsync(default,null,f.Purchase.Course);
        await AssertRecovered(p,f,ids);
    }
    [Phase1SqlFact]public async Task Recovery_interruption_restarts_from_durable_rows_in_a_new_scope(){
        var interrupt=new InterruptAfterCommit();using var p=await CompletionSqlServerTests.Provider(interrupt);var (f,ids)=await RecoveryGraph(p,57);using var stop=new CancellationTokenSource();interrupt.Remaining=8;interrupt.Stop=stop;
        using(var scope=p.CreateScope())await Assert.ThrowsAnyAsync<OperationCanceledException>(()=>CompletionSqlServerTests.Service(scope.ServiceProvider).RecoverAsync(stop.Token,null,f.Purchase.Course));
        interrupt.Stop=null;
        Dictionary<Guid,Guid> issuedBefore;Dictionary<Guid,DateTimeOffset> datesBefore;
        using(var scope=p.CreateScope()){var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();issuedBefore=await db.Certificates.Where(x=>ids.Contains(x.EnrollmentId)).ToDictionaryAsync(x=>x.EnrollmentId,x=>x.Id);Assert.InRange(issuedBefore.Count,1,56);
            datesBefore=await db.Enrollments.Where(x=>ids.Contains(x.Id)&&x.CompletedAt!=null).ToDictionaryAsync(x=>x.Id,x=>x.CompletedAt!.Value);}
        var run=Guid.NewGuid().ToString("N");var file=Path.Combine(Artifacts(),"restart-"+run+".json");await File.WriteAllTextAsync(file,JsonSerializer.Serialize(new{courseId=f.Purchase.Course,enrollments=ids}));
        var repository=RepositoryRoot();
        var start=new System.Diagnostics.ProcessStartInfo("dotnet"){UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true,RedirectStandardError=true,WorkingDirectory=repository};
        foreach(var arg in new[]{"test",Path.Combine(repository,"backend/esham.Tests/esham.Tests.csproj"),"--no-build","-p:OutputPath="+AppContext.BaseDirectory,"--filter","FullyQualifiedName~Phase4RecoveryResumeTests.Resume_in_new_process","--logger","trx;LogFileName=restart-child-"+run+".trx","--results-directory",Artifacts()})start.ArgumentList.Add(arg);
        start.Environment["ESHAM_PHASE4_RECOVERY_ACTION"]="resume";start.Environment["ESHAM_PHASE4_RECOVERY_FILE"]=file;
        using var child=System.Diagnostics.Process.Start(start)!;var output=child.StandardOutput.ReadToEndAsync();var error=child.StandardError.ReadToEndAsync();
        await child.WaitForExitAsync().WaitAsync(TimeSpan.FromSeconds(60));await File.WriteAllTextAsync(Path.Combine(Artifacts(),"restart-child-"+run+".log"),await output+await error);Assert.Equal(0,child.ExitCode);
        await AssertRecovered(p,f,ids);
        using var final=p.CreateScope();var check=final.ServiceProvider.GetRequiredService<AppDbContext>();
        foreach(var entry in issuedBefore)Assert.Equal(entry.Value,(await check.Certificates.SingleAsync(x=>x.EnrollmentId==entry.Key)).Id);
        foreach(var entry in datesBefore)Assert.Equal(entry.Value,(await check.Enrollments.SingleAsync(x=>x.Id==entry.Key)).CompletedAt);
    }
    [Phase1SqlFact]public async Task Concurrent_recovery_workers_preserve_one_certificate_and_notice_per_enrollment(){
        using var p=await CompletionSqlServerTests.Provider();var(f,ids)=await RecoveryGraph(p,53);
        await Task.WhenAll(Enumerable.Range(0,2).Select(async _=>{using var scope=p.CreateScope();await CompletionSqlServerTests.Service(scope.ServiceProvider).RecoverAsync(default,null,f.Purchase.Course);}));await AssertRecovered(p,f,ids);
    }
    private static async Task AssertRecovered(ServiceProvider p,LearningFixture f,List<Guid> ids){
        using var scope=p.CreateScope();var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();Assert.Equal(ids.Count,await db.Certificates.CountAsync(x=>ids.Contains(x.EnrollmentId)));Assert.Equal(ids.Count,await db.Enrollments.CountAsync(x=>ids.Contains(x.Id)&&x.Status=="completed"&&x.CompletedAt!=null));
        Assert.Equal(ids.Count,await db.Notifications.CountAsync(x=>x.NotificationType=="certificate.issued"&&db.Certificates.Any(c=>ids.Contains(c.EnrollmentId)&&c.Id==x.Id)));
        Assert.Equal(0,(await db.Wallets.SingleAsync(x=>x.UserId==f.Purchase.Learner)).Balance);Assert.Equal(40,(await db.Wallets.SingleAsync(x=>x.UserId==f.Purchase.Owner)).Balance);
        Assert.All(await db.Enrollments.Where(x=>ids.Contains(x.Id)).ToListAsync(),x=>Assert.Equal(f.Purchase.Version,x.CourseVersionId));
    }
    private sealed class Diagnostics:DbCommandInterceptor{
        public ConcurrentBag<object> Failures=new();
        public override Task CommandFailedAsync(DbCommand c,CommandErrorEventData e,CancellationToken ct=default){if(e.Exception is SqlException sql)Failures.Add(new{sql.Number,Context=e.Context?.ContextId.ToString(),Statement=c.CommandText});return Task.CompletedTask;}
    }
    private static EnrollmentPurchaseGate PurchaseGate(AppDbContext db)=>new(db,Options.Create(new EnrollmentPurchaseOptions{Enabled=true,ApprovedIsolatedDatabase=CompletionMutationGate.Catalog}));
    private sealed record Graph(Guid Course,Guid Version,Guid Lesson,Guid Task);
    private static async Task<Graph> Course(AppDbContext db,string owner,Guid category){
        var c=new Course{OwnerUserId=owner};var v=new CourseVersion{CourseId=c.Id,CategoryId=category,VersionNumber=1,TitleEn="Synthetic mixed course",ReviewStatus="approved",ApprovedAt=DateTimeOffset.UtcNow};var section=new CourseSection{CourseVersionId=v.Id};var lesson=new Lesson{CourseSectionId=section.Id,ContentType="article",TitleEn="Mixed lesson"};var task=new CourseTask{CourseVersionId=v.Id,TitleEn="Mixed work"};db.AddRange(c,v,section,lesson,task);await db.SaveChangesAsync();c.PublishedVersionId=v.Id;c.DraftVersionId=v.Id;await db.SaveChangesAsync();return new(c.Id,v.Id,lesson.Id,task.Id);
    }
    [Phase1SqlTheory][InlineData(1)][InlineData(2)][InlineData(3)]
    public Task Mixed_shared_participants_purchase_progress_submit_approve_and_reconcile(int wave)=>RunMixed(wave);
    internal async Task RunMixed(int wave,bool phase5=false){
        var started=DateTimeOffset.UtcNow;
        var diagnostics=new Diagnostics();using var p=await CompletionSqlServerTests.Provider(diagnostics);var f=await LessonProgressSqlServerTests.Fixture(p);Graph a,b,c;Guid eb;
        using(var scope=p.CreateScope()){var s=scope.ServiceProvider;var db=s.GetRequiredService<AppDbContext>();Http(s,f.Purchase.Owner);Assert.Equal(AccountFailure.None,(await s.GetRequiredService<AccountService>().UpdateCurrentProfileAsync(Principal(f.Purchase.Owner),Profile("both","mixed_"+Guid.NewGuid().ToString("N")[..12]))).Failure);
            var category=(await db.CourseVersions.SingleAsync(x=>x.Id==f.Purchase.Version)).CategoryId;var task=new CourseTask{CourseVersionId=f.Purchase.Version,TitleEn="Mixed original task"};db.Add(task);await db.SaveChangesAsync();a=new(f.Purchase.Course,f.Purchase.Version,f.Article,task.Id);b=await Course(db,f.Purchase.Learner,category);c=await Course(db,f.Purchase.Owner,category);
            var purchase=await EnrollmentTests.Service(s,PurchaseGate(db)).PurchaseAsync(Principal(f.Purchase.Owner),new(b.Course,b.Version,Guid.NewGuid()));Assert.Equal(ServiceFailure.None,purchase.Failure);eb=purchase.Value!.Enrollment.Id;
        }
        async Task Workflow(Graph g,Guid eid,string learner,string instructor,params Guid[] lessons){
            using var scope=p.CreateScope();var s=scope.ServiceProvider;var db=s.GetRequiredService<AppDbContext>();var sub=LearnerSubmissionTests.Service(s,SubmissionSqlServerTests.Gate(db));
            var draft=(await sub.CreateAsync(Principal(learner),eid,g.Task,new(Guid.NewGuid(),g.Version))).Value!;Assert.NotNull(draft);
            var saved=(await sub.SaveAsync(Principal(learner),eid,draft.Id,new(g.Version,draft.DraftToken,"Synthetic mixed workload answer",null))).Value!;Assert.NotNull(saved);
            Assert.Equal(ServiceFailure.None,(await sub.SubmitAsync(Principal(learner),eid,saved.Id,new(g.Version,saved.DraftToken))).Failure);
            await Task.WhenAll(lessons.Select(async lid=>{using var sc=p.CreateScope();var sp=sc.ServiceProvider;var d=sp.GetRequiredService<AppDbContext>();var w=new LessonProgressService(d,Access(sp),LessonProgressSqlServerTests.Gate(d),new CourseVersionUpdates(d,new NotificationWriter(d)),CompletionSqlServerTests.Service(sp));Assert.Equal(ServiceFailure.None,(await w.CompleteAsync(Principal(learner),eid,lid,new(g.Version))).Failure);}).Append(Task.Run(async()=>{using var sc=p.CreateScope();var sp=sc.ServiceProvider;Assert.Equal(ServiceFailure.None,(await new InstructorInsightsService(sp.GetRequiredService<AppDbContext>(),CompletionSqlServerTests.Service(sp)).Review(Principal(instructor),saved.Id,new("approved",null))).Failure);})));
            Assert.Equal("completed",(await CompletionSqlServerTests.Service(s).ReconcileAsync(Principal(learner),eid,g.Version)).Value!.Status);
        }
        async Task Poll(Graph g,Guid eid,string learner){for(int i=0;i<5;i++){using var sc=p.CreateScope();var svc=CompletionSqlServerTests.Service(sc.ServiceProvider);var r=await svc.GetAsync(Principal(learner),eid);Assert.Equal(ServiceFailure.None,r.Failure);Assert.NotEqual("historical_completion_ambiguous",r.Value!.ReasonCode);Assert.Equal(ServiceFailure.None,(await svc.ReconcileAsync(Principal(learner),eid,g.Version)).Failure);}}
        var request=new esham.BLL.DTOs.Enrollments.PurchaseEnrollmentRequest(c.Course,c.Version,Guid.NewGuid());
        async Task<Guid> Purchase(){using var sc=p.CreateScope();var sp=sc.ServiceProvider;var r=await EnrollmentTests.Service(sp,PurchaseGate(sp.GetRequiredService<AppDbContext>())).PurchaseAsync(Principal(f.Purchase.Learner),request);Assert.Equal(ServiceFailure.None,r.Failure);return r.Value!.Enrollment.Id;}
        try {
            var purchases=Enumerable.Range(0,4).Select(_=>Purchase()).ToArray();
            async Task Phase5(){
                if(!phase5)return;
                using var scope=p.CreateScope();var s=scope.ServiceProvider;var db=s.GetRequiredService<AppDbContext>();
                var announcement=new Announcement{AuthorUserId=f.Purchase.Owner,Audience="all",Status="published",PublishedAt=DateTimeOffset.UtcNow,TitleEn="Mixed isolated announcement",ContentEn="Synthetic mixed workload"};db.Add(announcement);await db.SaveChangesAsync();
                async Task Review(){using var sc=p.CreateScope();var svc=Phase5Tests.Reviews(sc.ServiceProvider);var r=await svc.WriteAsync(Principal(f.Purchase.Learner),f.Enrollment,Phase5Tests.Write(f.Purchase.Version));Assert.Equal(ServiceFailure.None,r.Failure);Assert.Equal(ServiceFailure.None,(await svc.ReplyAsync(Principal(f.Purchase.Owner),f.Enrollment,new(Guid.NewGuid(),r.Value!.Review!.Version,"Mixed instructor reply"))).Failure);}
                async Task Deliver(){using var sc=p.CreateScope();Assert.Equal(2,await Phase5SqlTests.Delivery(sc.ServiceProvider,announcement.Id,[f.Purchase.Learner,f.Purchase.Owner]).RecoverAsync());}
                async Task Security(){using var sc=p.CreateScope();var ticket=await Phase5Tests.Ticket(sc.ServiceProvider,f.Purchase.Owner);Assert.Equal(ServiceFailure.None,(await Phase5Tests.Security(sc.ServiceProvider,new()).RevokeAsync(ticket,new(AccountFinalizationTests.Password))).Failure);}
                await Task.WhenAll(Review(),Deliver(),Security());
            }
            var mixed=Task.WhenAll(Workflow(a,f.Enrollment,f.Purchase.Learner,f.Purchase.Owner,f.Lesson,f.Article),Workflow(b,eb,f.Purchase.Owner,f.Purchase.Learner,b.Lesson),Poll(a,f.Enrollment,f.Purchase.Learner),Poll(b,eb,f.Purchase.Owner),Task.WhenAll(purchases),Phase5());
            async Task Observe(){if(!phase5)return;while(!mixed.IsCompleted){await Task.WhenAny(mixed,Task.Delay(1000));if(mixed.IsCompleted)break;using var sc=p.CreateScope();var d=sc.ServiceProvider.GetRequiredService<AppDbContext>();await d.Database.OpenConnectionAsync();IsolatedSqlMutationGuard.Verify(d.Database.GetDbConnection());using var command=d.Database.GetDbConnection().CreateCommand();command.CommandTimeout=3;command.CommandText="SELECT session_id,blocking_session_id,wait_type,wait_resource FROM sys.dm_exec_requests WHERE database_id=DB_ID() AND blocking_session_id>0";using var reader=await command.ExecuteReaderAsync();var waits=new List<object>();while(await reader.ReadAsync())waits.Add(new{Session=reader.GetInt16(0),BlockedBy=reader.GetInt16(1),Wait=reader.IsDBNull(2)?null:reader.GetString(2),Resource=reader.GetString(3)});await File.AppendAllTextAsync(Path.Combine(Phase5SqlTests.Artifacts(),$"mixed-{wave}-blocking.jsonl"),JsonSerializer.Serialize(new{at=DateTimeOffset.UtcNow,waits})+Environment.NewLine);}}
            await Task.WhenAll(mixed,Observe());
            var ec=purchases[0].Result;Assert.All(purchases,x=>Assert.Equal(ec,x.Result));await Task.WhenAll(Workflow(c,ec,f.Purchase.Learner,f.Purchase.Owner,c.Lesson),Poll(c,ec,f.Purchase.Learner));
            Assert.Empty(diagnostics.Failures);
            using var verify=p.CreateScope();var db=verify.ServiceProvider.GetRequiredService<AppDbContext>();var ids=new[]{f.Enrollment,eb,ec};Assert.Equal(3,await db.Certificates.CountAsync(x=>ids.Contains(x.EnrollmentId)));Assert.Equal(6,await db.PointTransactions.CountAsync(x=>x.EnrollmentId!=null&&ids.Contains(x.EnrollmentId.Value)));Assert.Equal(0,(await db.Wallets.SingleAsync(x=>x.UserId==f.Purchase.Learner)).Balance);Assert.Equal(40,(await db.Wallets.SingleAsync(x=>x.UserId==f.Purchase.Owner)).Balance);
        } finally {
            var record=JsonSerializer.Serialize(new{wave,started,finished=DateTimeOffset.UtcNow,sqlErrors=diagnostics.Failures.ToArray()});
            await File.WriteAllTextAsync(Path.Combine(Artifacts(),$"mixed-{wave}-diagnostics.json"),record);
            await File.WriteAllTextAsync(Path.Combine(Artifacts(),$"mixed-{wave}-{Guid.NewGuid():N}-diagnostics.json"),record);
            using var scope=p.CreateScope();var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();
            try {await db.Database.OpenConnectionAsync();IsolatedSqlMutationGuard.Verify(db.Database.GetDbConnection());await using var command=db.Database.GetDbConnection().CreateCommand();
                command.CommandText="SELECT CONVERT(nvarchar(max),t.target_data) FROM sys.dm_xe_session_targets t JOIN sys.dm_xe_sessions s ON s.address=t.event_session_address WHERE s.name='system_health' AND t.target_name='ring_buffer'";
                var xml=await command.ExecuteScalarAsync() as string;
                if(xml!=null){var events=System.Xml.Linq.XDocument.Parse(xml).Descendants("event").Where(x=>(string?)x.Attribute("name")=="xml_deadlock_report"&&DateTimeOffset.TryParse((string?)x.Attribute("timestamp"),out var at)&&at>=started);await File.WriteAllTextAsync(Path.Combine(Artifacts(),$"mixed-{wave}-deadlocks.xml"),new System.Xml.Linq.XElement("deadlocks",events).ToString());}
                else await File.WriteAllTextAsync(Path.Combine(Artifacts(),$"mixed-{wave}-xevent-status.txt"),"system_health ring_buffer is not available; command failure diagnostics retained.");
            }catch(SqlException){await File.WriteAllTextAsync(Path.Combine(Artifacts(),$"mixed-{wave}-xevent-status.txt"),"system_health read unavailable; no event session was created or changed.");}
            finally{await db.Database.CloseConnectionAsync();}
        }
    }
}
