using System.Data;
using System.Data.Common;
using System.Text.Json;
using esham.BLL.DTOs;
using esham.BLL.Interfaces;
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
using static esham.Tests.LearnerLearningTests;
namespace esham.Tests;
public sealed class CompletionSqlServerTests
{
    internal static CompletionMutationGate Gate(AppDbContext db,bool enabled=true)=>new(db,Options.Create(new CourseCompletionOptions{Enabled=enabled,ApprovedIsolatedDatabase=CompletionMutationGate.Catalog}));
    internal static EnrollmentCompletionService Service(IServiceProvider s)=>CompletionTests.Service(s,Gate(s.GetRequiredService<AppDbContext>()));
    internal static async Task<ServiceProvider> Provider(params IInterceptor[] interceptors){var p=await LessonProgressSqlServerTests.Provider(interceptors);using var scope=p.CreateScope();Assert.True(await Gate(scope.ServiceProvider.GetRequiredService<AppDbContext>()).IsEnabledAsync());return p;}
    private static async Task<LearningFixture> Ready(ServiceProvider p){var f=await LessonProgressSqlServerTests.Fixture(p);using var scope=p.CreateScope();await CompletionTests.Earn(scope.ServiceProvider.GetRequiredService<AppDbContext>(),f);return f;}
    private static async Task<esham.BLL.DTOs.Completion.CompletionState> Reconcile(ServiceProvider p,LearningFixture f){using var scope=p.CreateScope();var r=await Service(scope.ServiceProvider).ReconcileAsync(Principal(f.Purchase.Learner),f.Enrollment,f.Purchase.Version);Assert.Equal(ServiceFailure.None,r.Failure);return r.Value!;}
    [Phase1SqlFact]public async Task Concurrent_reconciliation_creates_one_certificate_first_timestamp_and_notice(){
        using var p=await Provider();var f=await Ready(p);var results=await Task.WhenAll(Enumerable.Range(0,6).Select(_=>Reconcile(p,f)));
        Assert.Single(results.Select(x=>x.Certificate!.Id).Distinct());Assert.Single(results.Select(x=>x.CompletedAt).Distinct());
        using var scope=p.CreateScope();var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();Assert.Equal(1,await db.Certificates.CountAsync(x=>x.EnrollmentId==f.Enrollment));Assert.Equal(1,await db.Notifications.CountAsync(x=>x.Id==results[0].Certificate!.Id));
        Assert.Equal(0,(await db.Wallets.SingleAsync(x=>x.UserId==f.Purchase.Learner)).Balance);Assert.Equal(40,(await db.Wallets.SingleAsync(x=>x.UserId==f.Purchase.Owner)).Balance);
        Assert.Equal(2,await db.PointTransactions.CountAsync(x=>x.EnrollmentId==f.Enrollment));Assert.Equal(f.Purchase.Version,(await db.Enrollments.SingleAsync(x=>x.Id==f.Enrollment)).CourseVersionId);
    }
    [Phase1SqlFact]public async Task Concurrent_last_lesson_hooks_are_atomic_and_replayable(){
        using var p=await Provider();var f=await LessonProgressSqlServerTests.Fixture(p);
        using(var scope=p.CreateScope()){var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();db.LessonProgressRecords.Add(new(){EnrollmentId=f.Enrollment,LessonId=f.Lesson,IsCompleted=true,CompletedAt=DateTimeOffset.UtcNow});await db.SaveChangesAsync();}
        await Task.WhenAll(Enumerable.Range(0,4).Select(async _=>{using var scope=p.CreateScope();var s=scope.ServiceProvider;var db=s.GetRequiredService<AppDbContext>();var writes=new LessonProgressService(db,Access(s),LessonProgressSqlServerTests.Gate(db),new CourseVersionUpdates(db,new NotificationWriter(db)),Service(s));Assert.Equal(ServiceFailure.None,(await writes.CompleteAsync(Principal(f.Purchase.Learner),f.Enrollment,f.Article,new(f.Purchase.Version))).Failure);}));
        Assert.NotNull((await Reconcile(p,f)).Certificate);
    }
    [Phase1SqlTheory][InlineData("progress")][InlineData("certificate")][InlineData("notification")]
    public async Task Intermediate_failure_rolls_back_lesson_completion_enrollment_certificate_and_notice(string point){
        var fault=new Fault{Point=point};using var p=await Provider(fault);var f=await LessonProgressSqlServerTests.Fixture(p);
        using(var scope=p.CreateScope()){var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();db.LessonProgressRecords.Add(new(){EnrollmentId=f.Enrollment,LessonId=f.Lesson,IsCompleted=true});await db.SaveChangesAsync();}
        fault.Armed=true;
        using(var scope=p.CreateScope()){var s=scope.ServiceProvider;var db=s.GetRequiredService<AppDbContext>();var writes=new LessonProgressService(db,Access(s),LessonProgressSqlServerTests.Gate(db),new CourseVersionUpdates(db,new NotificationWriter(db)),Service(s));await Assert.ThrowsAsync<InvalidOperationException>(()=>writes.CompleteAsync(Principal(f.Purchase.Learner),f.Enrollment,f.Article,new(f.Purchase.Version)));}
        using var verify=p.CreateScope();var d=verify.ServiceProvider.GetRequiredService<AppDbContext>();Assert.False(await d.LessonProgressRecords.AnyAsync(x=>x.EnrollmentId==f.Enrollment&&x.LessonId==f.Article));Assert.False(await d.Certificates.AnyAsync(x=>x.EnrollmentId==f.Enrollment));Assert.Null((await d.Enrollments.SingleAsync(x=>x.Id==f.Enrollment)).CompletedAt);
    }
    [Phase1SqlFact]public async Task Approval_hook_completes_and_repeated_assessment_preserves_first_record(){
        using var p=await Provider();var f=await Ready(p);Guid sid;
        using(var scope=p.CreateScope()){var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();var task=new CourseTask{CourseVersionId=f.Purchase.Version,TitleEn="Required work"};var sub=new TaskSubmission{EnrollmentId=f.Enrollment,CourseTaskId=task.Id,Status="awaitingReview",SubmittedAt=DateTimeOffset.UtcNow,AnswerText="Synthetic answer"};db.AddRange(task,sub);await db.SaveChangesAsync();sid=sub.Id;}
        using(var scope=p.CreateScope()){var s=scope.ServiceProvider;var review=new InstructorInsightsService(s.GetRequiredService<AppDbContext>(),Service(s));Assert.Equal(ServiceFailure.None,(await review.Review(Principal(f.Purchase.Owner),sid,new("approved",null))).Failure);Assert.Equal(ServiceFailure.Conflict,(await review.Review(Principal(f.Purchase.Owner),sid,new("approved",null))).Failure);}
        Assert.NotNull((await Reconcile(p,f)).Certificate);
    }
    [Phase1SqlFact]public async Task Failed_approval_finalization_rolls_back_review_status_and_both_notifications(){
        var fault=new Fault{Point="certificate"};using var p=await Provider(fault);var f=await Ready(p);Guid sid;
        using(var scope=p.CreateScope()){var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();var task=new CourseTask{CourseVersionId=f.Purchase.Version};var sub=new TaskSubmission{EnrollmentId=f.Enrollment,CourseTaskId=task.Id,Status="awaitingReview",SubmittedAt=DateTimeOffset.UtcNow};db.AddRange(task,sub);await db.SaveChangesAsync();sid=sub.Id;}
        fault.Armed=true;using(var scope=p.CreateScope()){var s=scope.ServiceProvider;await Assert.ThrowsAsync<InvalidOperationException>(()=>new InstructorInsightsService(s.GetRequiredService<AppDbContext>(),Service(s)).Review(Principal(f.Purchase.Owner),sid,new("approved",null)));}
        using var v=p.CreateScope();var d=v.ServiceProvider.GetRequiredService<AppDbContext>();Assert.Equal("awaitingReview",(await d.TaskSubmissions.SingleAsync(x=>x.Id==sid)).Status);Assert.False(await d.TaskSubmissionReviews.AnyAsync(x=>x.TaskSubmissionId==sid));Assert.False(await d.Certificates.AnyAsync(x=>x.EnrollmentId==f.Enrollment));Assert.False(await d.Notifications.AnyAsync(x=>x.NotificationType=="task.assessed"&&x.RecipientUserId==f.Purchase.Learner));
    }
    [Phase1SqlFact]public async Task Transient_retry_and_lost_acknowledgement_reconcile_persisted_identity(){
        var transient=new Transient();var lost=new LostCommit();using var p=await Provider(transient,lost);var f=await Ready(p);transient.Armed=true;var first=await Reconcile(p,f);Assert.True(transient.Injected);
        // A new fixture exercises ambiguity at the committing transaction, not a fabricated response.
        var second=await Ready(p);lost.Armed=true;var result=await Reconcile(p,second);Assert.True(lost.Injected);Assert.Equal(result.Certificate,(await Reconcile(p,second)).Certificate);Assert.Equal("completed",first.Status);
    }
    [Phase1SqlFact]public async Task Durable_scan_recovers_gate_off_evidence_and_repeat_pass_is_idempotent(){
        using var p=await Provider();var f=await Ready(p);using var scope=p.CreateScope();var svc=Service(scope.ServiceProvider);await svc.RecoverAsync(default,_=>{},f.Purchase.Course);var first=await Reconcile(p,f);Assert.NotNull(first.Certificate);await svc.RecoverAsync(default,_=>{},f.Purchase.Course);Assert.Equal(first.Certificate,(await Reconcile(p,f)).Certificate);
    }
    [Phase1SqlFact]public async Task Publication_race_pins_actual_locked_version_and_preserves_receipts(){
        using var p=await Provider();var f=await Ready(p);var publish=Task.Run(async()=>{using var scope=p.CreateScope();var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();await db.Database.CreateExecutionStrategy().ExecuteAsync(async()=>{await using var tx=await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);var c=await db.Courses.FromSqlInterpolated($"SELECT * FROM [Courses] WITH (UPDLOCK,HOLDLOCK) WHERE [Id]={f.Purchase.Course}").SingleAsync();var old=c.PublishedVersionId;var prev=await db.CourseVersions.SingleAsync(x=>x.Id==old);var v=new CourseVersion{CourseId=c.Id,CategoryId=prev.CategoryId,VersionNumber=2,TitleEn="Updated course",ReviewStatus="approved",ApprovedAt=DateTimeOffset.UtcNow};db.Add(v);await db.SaveChangesAsync();var section=new CourseSection{CourseVersionId=v.Id};db.Add(section);db.Add(new Lesson{CourseSectionId=section.Id,ContentType="article",TitleEn="New requirement"});await db.SaveChangesAsync();c.PublishedVersionId=v.Id;c.DraftVersionId=v.Id;await new CourseVersionUpdates(db,new NotificationWriter(db)).StagePublicationAsync(c,v,old);await db.SaveChangesAsync();await tx.CommitAsync();});});
        using(var scope=p.CreateScope()){var r=await Service(scope.ServiceProvider).ReconcileAsync(Principal(f.Purchase.Learner),f.Enrollment,f.Purchase.Version);Assert.True(r.Failure==ServiceFailure.None||r.Code=="publication_changed");}
        await publish;using var verify=p.CreateScope();var d=verify.ServiceProvider.GetRequiredService<AppDbContext>();var cert=await d.Certificates.SingleOrDefaultAsync(x=>x.EnrollmentId==f.Enrollment);if(cert!=null)Assert.Equal(f.Purchase.Version,cert.CourseVersionId);Assert.Equal(2,await d.EnrollmentVersionAccess.CountAsync(x=>x.EnrollmentId==f.Enrollment));Assert.Equal(f.Purchase.Version,(await d.Enrollments.SingleAsync(x=>x.Id==f.Enrollment)).CourseVersionId);
    }
    [Phase1SqlFact]public async Task Revocation_is_gated_admin_only_audited_once_and_publicly_private(){
        using var p=await Provider();var f=await Ready(p);var c=(await Reconcile(p,f)).Certificate!;using var scope=p.CreateScope();var s=scope.ServiceProvider;var db=s.GetRequiredService<AppDbContext>();var admin=await Seed(s,true);var cert=CompletionTests.Certificates(s,Gate(db));
        Assert.Equal(ServiceFailure.Forbidden,(await cert.RevokeAsync(Principal(f.Purchase.Owner),c.Id,"Test reason")).Failure);
        Assert.Equal("completion_disabled",(await CompletionTests.Certificates(s,Gate(db,false)).RevokeAsync(Principal(admin),c.Id,"Test reason")).Code);
        Assert.Equal(ServiceFailure.None,(await cert.RevokeAsync(Principal(admin),c.Id,"Test reason")).Failure);await cert.RevokeAsync(Principal(admin),c.Id,"Repeated request");Assert.Equal(1,await db.AdminActivityLogs.CountAsync(x=>x.TargetId==c.Id.ToString("D")));Assert.Equal("revoked",(await cert.VerifyAsync(c.VerificationCode)).Value!.Status);
    }
    [Phase1SqlFact]public async Task Gate_checks_actual_catalog_inside_transaction_and_refuses_master(){
        using var p=await Provider();using var scope=p.CreateScope();var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();await db.Database.CreateExecutionStrategy().ExecuteAsync(async()=>{await using var tx=await db.Database.BeginTransactionAsync();Assert.True(await Gate(db).IsEnabledAsync());await tx.RollbackAsync();});
        await db.Database.OpenConnectionAsync();try{db.Database.GetDbConnection().ChangeDatabase("master");Assert.False(await Gate(db).IsEnabledAsync());db.Database.GetDbConnection().ChangeDatabase(CompletionMutationGate.Catalog);}finally{await db.Database.CloseConnectionAsync();}
    }
    [Phase1SqlFact]public async Task Disabled_automatic_hooks_preserve_progress_and_assessment_then_durable_scan_recovers(){
        using var p=await Provider();var f=await LessonProgressSqlServerTests.Fixture(p);Guid sid;
        using(var scope=p.CreateScope()){var s=scope.ServiceProvider;var db=s.GetRequiredService<AppDbContext>();var off=CompletionTests.Service(s,Gate(db,false));var writes=new LessonProgressService(db,Access(s),LessonProgressSqlServerTests.Gate(db),new CourseVersionUpdates(db,new NotificationWriter(db)),off);
            foreach(var id in new[]{f.Lesson,f.Article})Assert.Equal(ServiceFailure.None,(await writes.CompleteAsync(Principal(f.Purchase.Learner),f.Enrollment,id,new(f.Purchase.Version))).Failure);
            Assert.False(await db.Certificates.AnyAsync(x=>x.EnrollmentId==f.Enrollment));var task=new CourseTask{CourseVersionId=f.Purchase.Version};var sub=new TaskSubmission{EnrollmentId=f.Enrollment,CourseTaskId=task.Id,Status="awaitingReview",SubmittedAt=DateTimeOffset.UtcNow};db.AddRange(task,sub);await db.SaveChangesAsync();sid=sub.Id;
            Assert.Equal(ServiceFailure.None,(await new InstructorInsightsService(db,off).Review(Principal(f.Purchase.Owner),sid,new("approved",null))).Failure);Assert.False(await db.Certificates.AnyAsync(x=>x.EnrollmentId==f.Enrollment));
            await Service(s).RecoverAsync(default,null,f.Purchase.Course);
        }
        Assert.Equal("completed",(await Reconcile(p,f)).Status);
    }
    [Phase1SqlFact]public async Task Last_lesson_and_instructor_approval_race_finalize_once(){
        using var p=await Provider();var f=await LessonProgressSqlServerTests.Fixture(p);Guid sid;
        using(var scope=p.CreateScope()){var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();var task=new CourseTask{CourseVersionId=f.Purchase.Version};var sub=new TaskSubmission{EnrollmentId=f.Enrollment,CourseTaskId=task.Id,Status="awaitingReview",SubmittedAt=DateTimeOffset.UtcNow};db.AddRange(task,sub);db.LessonProgressRecords.Add(new(){EnrollmentId=f.Enrollment,LessonId=f.Lesson,IsCompleted=true});await db.SaveChangesAsync();sid=sub.Id;}
        await Task.WhenAll(Task.Run(async()=>{using var scope=p.CreateScope();var s=scope.ServiceProvider;var db=s.GetRequiredService<AppDbContext>();Assert.Equal(ServiceFailure.None,(await new LessonProgressService(db,Access(s),LessonProgressSqlServerTests.Gate(db),new CourseVersionUpdates(db,new NotificationWriter(db)),Service(s)).CompleteAsync(Principal(f.Purchase.Learner),f.Enrollment,f.Article,new(f.Purchase.Version))).Failure);}),Task.Run(async()=>{using var scope=p.CreateScope();var s=scope.ServiceProvider;Assert.Equal(ServiceFailure.None,(await new InstructorInsightsService(s.GetRequiredService<AppDbContext>(),Service(s)).Review(Principal(f.Purchase.Owner),sid,new("approved",null))).Failure);}));
        Assert.NotNull((await Reconcile(p,f)).Certificate);
    }
    [Phase1SqlFact]public async Task Durable_scan_after_publication_uses_inherited_evidence_and_new_version_without_changing_purchase(){
        using var p=await Provider();var f=await LessonProgressSqlServerTests.Fixture(p);
        using(var scope=p.CreateScope()){var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();db.LessonProgressRecords.Add(new(){EnrollmentId=f.Enrollment,LessonId=f.Lesson,IsCompleted=true,CompletedAt=DateTimeOffset.UtcNow});await db.SaveChangesAsync();Assert.False((await Service(scope.ServiceProvider).GetAsync(Principal(f.Purchase.Learner),f.Enrollment)).Value!.Eligible);}
        var next=await LessonProgressSqlServerTests.NextVersion(p,f);await LessonProgressSqlServerTests.Publish(p,f,next.Version);
        using var v=p.CreateScope();var s=v.ServiceProvider;await Service(s).RecoverAsync(default,null,f.Purchase.Course);var c=(await Service(s).GetAsync(Principal(f.Purchase.Learner),f.Enrollment)).Value!;Assert.Equal("completed",c.Status);Assert.Equal(next.Version,c.Certificate!.CourseVersionId);
        var db2=s.GetRequiredService<AppDbContext>();Assert.Equal(f.Purchase.Version,(await db2.Enrollments.SingleAsync(x=>x.Id==f.Enrollment)).CourseVersionId);Assert.Equal(2,await db2.EnrollmentVersionAccess.CountAsync(x=>x.EnrollmentId==f.Enrollment));Assert.Single(await db2.LessonProgressRecords.Where(x=>x.EnrollmentId==f.Enrollment).ToListAsync());
    }
    private sealed class Fault:SaveChangesInterceptor{
        public bool Armed;public string Point="certificate";
        public override ValueTask<int> SavedChangesAsync(SaveChangesCompletedEventData e,int result,CancellationToken ct=default){var d=e.Context!;if(Armed&&(Point=="progress"&&d.ChangeTracker.Entries<LessonProgress>().Any()||Point=="certificate"&&d.ChangeTracker.Entries<Certificate>().Any()||Point=="notification"&&d.ChangeTracker.Entries<Notification>().Any(x=>x.Entity.NotificationType=="certificate.issued"))){Armed=false;throw new InvalidOperationException("Injected Phase4 persistence failure.");}return ValueTask.FromResult(result);}
    }
    private sealed class Transient:SaveChangesInterceptor{public bool Armed,Injected;public override ValueTask<InterceptionResult<int>> SavingChangesAsync(DbContextEventData e,InterceptionResult<int> r,CancellationToken ct=default){if(Armed&&e.Context!.ChangeTracker.Entries<Certificate>().Any()){Armed=false;Injected=true;throw new TimeoutException("Injected retry.");}return ValueTask.FromResult(r);}}
    private sealed class LostCommit:DbTransactionInterceptor{public bool Armed,Injected;public override Task TransactionCommittedAsync(DbTransaction t,TransactionEndEventData e,CancellationToken ct=default){if(Armed){Armed=false;Injected=true;throw new TimeoutException("Injected commit acknowledgement loss.");}return Task.CompletedTask;}}
}
