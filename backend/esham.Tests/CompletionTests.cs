using esham.BLL.DTOs;
using esham.BLL.Interfaces;
using esham.BLL.Services;
using esham.DAL.Data;
using esham.DAL.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Xunit;
using static esham.Tests.AccountFinalizationTests;
namespace esham.Tests;
public sealed class CompletionTests
{
    internal sealed class MemoryGate(AppDbContext db,bool enabled=true):ICompletionMutationGate {
        public Task<bool> IsEnabledAsync(CancellationToken ct=default)=>db.Database.IsInMemory()?Task.FromResult(enabled):throw new InvalidOperationException("Memory-only gate.");
    }
    internal static EnrollmentCompletionService Service(IServiceProvider s,ICompletionMutationGate? gate=null) {
        var db=s.GetRequiredService<AppDbContext>();return new(db,gate??new MemoryGate(db),new CourseVersionUpdates(db,new NotificationWriter(db)),s.GetRequiredService<UserManager<ApplicationUser>>(),s.GetRequiredService<AccountService>());
    }
    internal static CertificateService Certificates(IServiceProvider s,ICompletionMutationGate? gate=null)=>new(s.GetRequiredService<AppDbContext>(),s.GetRequiredService<UserManager<ApplicationUser>>(),s.GetRequiredService<AccountService>(),gate??new MemoryGate(s.GetRequiredService<AppDbContext>()));
    internal static async Task Earn(AppDbContext db,LearnerLearningTests.LearningFixture f) {
        foreach(var id in new[]{f.Lesson,f.Article})db.LessonProgressRecords.Add(new(){EnrollmentId=f.Enrollment,LessonId=id,IsCompleted=true,CompletedAt=DateTimeOffset.UtcNow});
        await db.SaveChangesAsync();
    }
    [Theory][InlineData("learner")][InlineData("both")]
    public async Task Exact_completion_issues_one_immutable_certificate_and_notification(string persona){
        using var p=Services();using var scope=p.CreateScope();var s=scope.ServiceProvider;var f=await LearnerLearningTests.Setup(s,persona);var db=s.GetRequiredService<AppDbContext>();await Earn(db,f);
        var before=await db.PointTransactions.CountAsync();var svc=Service(s);
        var result=await svc.ReconcileAsync(Principal(f.Purchase.Learner),f.Enrollment,f.Purchase.Version);Assert.Equal(ServiceFailure.None,result.Failure);
        var c=result.Value!.Certificate!;Assert.Equal("completed",result.Value.Status);Assert.NotNull(result.Value.CompletedAt);Assert.Equal(f.Purchase.Version,c.CourseVersionId);
        var again=await svc.ReconcileAsync(Principal(f.Purchase.Learner),f.Enrollment,f.Purchase.Version);
        Assert.Equal(c,again.Value!.Certificate);Assert.Equal(result.Value.CompletedAt,again.Value.CompletedAt);Assert.Equal(before,await db.PointTransactions.CountAsync());
        Assert.Equal(1,await db.Notifications.CountAsync(x=>x.Id==c.Id));Assert.Equal(f.Purchase.Version,(await db.Enrollments.SingleAsync(x=>x.Id==f.Enrollment)).CourseVersionId);
        var record=await db.Certificates.SingleAsync(x=>x.Id==c.Id);record.LearnerNameSnapshot="Changed";await Assert.ThrowsAsync<InvalidOperationException>(()=>db.SaveChangesAsync());
    }
    [Theory][InlineData("empty")][InlineData("missing_lesson")][InlineData("pending_task")][InlineData("unavailable")][InlineData("missing_receipt")]
    public async Task Unsatisfied_or_unavailable_requirements_never_complete(string kind){
        using var p=Services();using var scope=p.CreateScope();var s=scope.ServiceProvider;var f=await LearnerLearningTests.Setup(s);var db=s.GetRequiredService<AppDbContext>();
        if(kind=="empty"){db.RemoveRange(await db.LessonAttachments.ToListAsync());db.RemoveRange(await db.Lessons.ToListAsync());}
        else if(kind!="missing_lesson")await Earn(db,f);
        if(kind=="pending_task")db.CourseTasks.Add(new(){CourseVersionId=f.Purchase.Version,TitleEn="Required task"});
        if(kind=="unavailable")(await db.Courses.SingleAsync(x=>x.Id==f.Purchase.Course)).SafetyStatus="blocked";
        if(kind=="missing_receipt")db.RemoveRange(await db.EnrollmentVersionAccess.Where(x=>x.EnrollmentId==f.Enrollment).ToListAsync());
        await db.SaveChangesAsync();var r=await Service(s).ReconcileAsync(Principal(f.Purchase.Learner),f.Enrollment,f.Purchase.Version);
        Assert.Equal("active",r.Value!.Status);Assert.Null(r.Value.CompletedAt);Assert.Null(r.Value.Certificate);
        if(kind=="empty")Assert.Equal("no_requirements",r.Value.ReasonCode);
    }
    [Fact]public async Task Disabled_gate_preserves_evidence_without_completion(){
        using var p=Services();using var scope=p.CreateScope();var s=scope.ServiceProvider;var f=await LearnerLearningTests.Setup(s);var db=s.GetRequiredService<AppDbContext>();await Earn(db,f);
        var r=await Service(s,new MemoryGate(db,false)).ReconcileAsync(Principal(f.Purchase.Learner),f.Enrollment,f.Purchase.Version);
        Assert.Equal("completion_disabled",r.Code);Assert.Empty(await db.Certificates.ToListAsync());
        Assert.False(await new CompletionMutationGate(db,Options.Create(new CourseCompletionOptions{Enabled=true,ApprovedIsolatedDatabase=CompletionMutationGate.Catalog})).IsEnabledAsync());
    }
    [Theory][InlineData(true)][InlineData(false)]public async Task Ambiguous_history_is_not_repaired(bool dateMissing){
        using var p=Services();using var scope=p.CreateScope();var s=scope.ServiceProvider;var f=await LearnerLearningTests.Setup(s);var db=s.GetRequiredService<AppDbContext>();await Earn(db,f);
        var e=await db.Enrollments.SingleAsync(x=>x.Id==f.Enrollment);e.Status=dateMissing?"completed":"active";e.CompletedAt=dateMissing?null:DateTimeOffset.UtcNow.AddDays(-2);await db.SaveChangesAsync();var old=e.CompletedAt;
        var r=await Service(s).ReconcileAsync(Principal(f.Purchase.Learner),f.Enrollment,f.Purchase.Version);
        Assert.Equal("historical_completion_ambiguous",r.Value!.ReasonCode);Assert.Equal(old,r.Value.CompletedAt);Assert.Null(r.Value.Certificate);
    }
    [Fact]public async Task Ownership_membership_privacy_and_name_changes(){
        using var p=Services();using var scope=p.CreateScope();var s=scope.ServiceProvider;var f=await LearnerLearningTests.Setup(s);var db=s.GetRequiredService<AppDbContext>();await Earn(db,f);var svc=Service(s);
        Assert.Equal(ServiceFailure.Forbidden,(await svc.GetAsync(Principal(f.Purchase.Owner),f.Enrollment)).Failure);
        var other=await Seed(s);Assert.NotEqual(ServiceFailure.None,(await svc.GetAsync(Principal(other),f.Enrollment)).Failure);
        var c=(await svc.ReconcileAsync(Principal(f.Purchase.Learner),f.Enrollment,f.Purchase.Version)).Value!.Certificate!;
        var cert=Certificates(s);Assert.Equal(ServiceFailure.Forbidden,(await cert.GetAsync(Principal(f.Purchase.Owner),c.Id)).Failure);
        var publicData=(await cert.VerifyAsync(c.VerificationCode)).Value!;Assert.EndsWith("***",publicData.LearnerName);Assert.NotEqual(c.LearnerNameSnapshot,publicData.LearnerName);
        Assert.Equal(ServiceFailure.NotFound,(await cert.VerifyAsync("1")).Failure);
        var u=await db.Users.SingleAsync(x=>x.Id==f.Purchase.Learner);u.Name="New profile name";await db.SaveChangesAsync();
        Assert.Equal(c.LearnerNameSnapshot,(await cert.GetAsync(Principal(u.Id),c.Id)).Value!.LearnerNameSnapshot);
    }
    [Fact]public async Task Completion_date_cannot_be_replaced_or_cleared(){
        using var p=Services();using var scope=p.CreateScope();var s=scope.ServiceProvider;var f=await LearnerLearningTests.Setup(s);var db=s.GetRequiredService<AppDbContext>();await Earn(db,f);await Service(s).ReconcileAsync(Principal(f.Purchase.Learner),f.Enrollment,f.Purchase.Version);
        var e=await db.Enrollments.SingleAsync(x=>x.Id==f.Enrollment);e.CompletedAt=null;await Assert.ThrowsAsync<InvalidOperationException>(()=>db.SaveChangesAsync());
    }
    [Fact]public async Task Rounded_one_hundred_percent_is_not_eligibility(){
        using var p=Services();using var scope=p.CreateScope();var s=scope.ServiceProvider;var f=await LearnerLearningTests.Setup(s);var db=s.GetRequiredService<AppDbContext>();var section=await db.CourseSections.SingleAsync(x=>x.CourseVersionId==f.Purchase.Version);
        for(int i=0;i<198;i++)db.Lessons.Add(new(){CourseSectionId=section.Id,ContentType="article"});await db.SaveChangesAsync();
        var ids=await db.Lessons.Where(x=>x.CourseSectionId==section.Id).Select(x=>x.Id).ToListAsync();foreach(var id in ids.Take(199))db.LessonProgressRecords.Add(new(){EnrollmentId=f.Enrollment,LessonId=id,IsCompleted=true});await db.SaveChangesAsync();
        var projection=(await new CourseVersionUpdates(db,new NotificationWriter(db)).GetStateAsync(f.Enrollment,f.Purchase.Learner)).Value!;Assert.Equal(100,projection.ProgressPercentage);Assert.False(projection.MeetsCurrentRequirements);
        var state=(await Service(s).GetAsync(Principal(f.Purchase.Learner),f.Enrollment)).Value!;Assert.False(state.Eligible);Assert.Equal(199,state.EarnedRequiredLessonCount);
    }
    [Fact]public async Task Optional_rejection_does_not_revoke_earned_task_and_pause_does_not_block_completion(){
        using var p=Services();using var scope=p.CreateScope();var s=scope.ServiceProvider;var f=await LearnerLearningTests.Setup(s);var db=s.GetRequiredService<AppDbContext>();await Earn(db,f);
        var task=new CourseTask{CourseVersionId=f.Purchase.Version};db.Add(task);db.AddRange(new TaskSubmission{EnrollmentId=f.Enrollment,CourseTaskId=task.Id,Status="approved",AttemptNumber=1},new TaskSubmission{EnrollmentId=f.Enrollment,CourseTaskId=task.Id,Status="rejected",AttemptNumber=2,IsOptionalAtCreation=true});(await db.Courses.SingleAsync(x=>x.Id==f.Purchase.Course)).EnrollmentPaused=true;await db.SaveChangesAsync();
        Assert.Equal("completed",(await Service(s).ReconcileAsync(Principal(f.Purchase.Learner),f.Enrollment,f.Purchase.Version)).Value!.Status);
    }
    [Theory][InlineData("db75401","(localdb)\\MSSQLLocalDB")][InlineData("Esham_AccountTests_Phase1_20261114","hosted.example.invalid")]
    public async Task Hosted_or_unapproved_targets_are_rejected_without_opening_a_connection(string catalog,string server){
        using var db=new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlServer(new Microsoft.Data.SqlClient.SqlConnectionStringBuilder{DataSource=server,InitialCatalog=catalog,IntegratedSecurity=true}.ConnectionString).Options);
        Assert.False(await new CompletionMutationGate(db,Options.Create(new CourseCompletionOptions{Enabled=true,ApprovedIsolatedDatabase=CompletionMutationGate.Catalog})).IsEnabledAsync());Assert.Equal(System.Data.ConnectionState.Closed,db.Database.GetDbConnection().State);
    }
}
