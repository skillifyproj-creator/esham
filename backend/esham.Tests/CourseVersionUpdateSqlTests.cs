using Microsoft.Extensions.DependencyInjection;
using esham.BLL.DTOs;
using esham.BLL.Services;
using esham.DAL.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Xunit;
using static esham.Tests.CourseVersionUpdateTests;
using static esham.Tests.AccountFinalizationSqlServerTests;
namespace esham.Tests;

// Uses the existing explicitly isolated Esham_AccountTests_* connection only.
// Never reads application settings/secrets or creates/applies schema from a test.
public sealed class CourseVersionUpdateSqlTests
{
    [AccountSqlServerFact] public async Task Requested_changes_are_atomic_deduplicated_and_owner_inbox_survives_new_scope()
    {
        using var provider=DatabaseServices();Data d;Guid version;
        using(var setup=provider.CreateScope()) {var db=setup.ServiceProvider.GetRequiredService<AppDbContext>();d=await Setup(db);version=await Revision(db,d);
            await Reviews(db).SubmitAsync(d.CourseId,Owner(d),new(version));}
        var gate=new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        async Task<ServiceFailure> Decide(){await gate.Task;using var scope=provider.CreateScope();var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();
            return (await Reviews(db).DecideAsync(d.CourseId,version,Reviewer(d),new("changes_requested","Improve the video"))).Failure;}
        var requests=new[]{Decide(),Decide()};gate.SetResult();var results=await Task.WhenAll(requests);
        Assert.Single(results,x=>x==ServiceFailure.None);Assert.Single(results,x=>x==ServiceFailure.Conflict);
        using var verify=provider.CreateScope();var check=verify.ServiceProvider.GetRequiredService<AppDbContext>();
        var decision=await check.CourseReviewDecisions.SingleAsync(x=>x.CourseVersionId==version);
        var notice=await check.Notifications.SingleAsync(x=>x.Id==decision.Id);
        Assert.Equal(d.Owner,notice.RecipientUserId);Assert.Contains("Improve the video",notice.MessageEn);
        var users=verify.ServiceProvider.GetRequiredService<Microsoft.AspNetCore.Identity.UserManager<esham.DAL.Entities.ApplicationUser>>();
        var inbox=new NotificationService(check,users);
        var owner=(await inbox.GetCurrentAsync(AccountFinalizationTests.Principal(d.Owner),new(1,100))).Value!;
        Assert.Equal($"/instructor/courses/{d.CourseId:D}/review",Assert.Single(owner.Items,x=>x.Id==notice.Id).TargetUrl);
        var other=(await inbox.GetCurrentAsync(AccountFinalizationTests.Principal(d.Reviewer),new(1,100))).Value!;
        Assert.DoesNotContain(other.Items,x=>x.Id==notice.Id);
    }

    [AccountSqlServerFact] public async Task Requested_changes_failure_before_commit_rolls_back_decision_status_log_and_notification()
    {
        var failure=new FailAfterPublicationSave();using var provider=DatabaseServices(failure);Data d;Guid version;
        using(var setup=provider.CreateScope()){var db=setup.ServiceProvider.GetRequiredService<AppDbContext>();d=await Setup(db);version=await Revision(db,d);
            await Reviews(db).SubmitAsync(d.CourseId,Owner(d),new(version));failure.Armed=true;
            await Assert.ThrowsAsync<InvalidOperationException>(()=>Reviews(db).DecideAsync(d.CourseId,version,Reviewer(d),new("changes_requested","Improve video")));}
        using var verify=provider.CreateScope();var check=verify.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal("pending",(await check.CourseVersions.SingleAsync(x=>x.Id==version)).ReviewStatus);
        Assert.False(await check.CourseReviewDecisions.AnyAsync(x=>x.CourseVersionId==version));
        Assert.False(await check.Notifications.AnyAsync(x=>x.RecipientUserId==d.Owner&&x.NotificationType=="course.changes_requested"));
        Assert.False(await check.AdminActivityLogs.AnyAsync(x=>x.CourseVersionId==version&&x.Action=="course.changes_requested"));
    }

    [AccountSqlServerFact] public async Task Concurrent_publications_commit_one_transition_and_one_notification_per_learner()
    {
        using var provider=DatabaseServices();Data d;Guid version;
        using(var setup=provider.CreateScope()){var db=setup.ServiceProvider.GetRequiredService<AppDbContext>();d=await Setup(db);version=await Revision(db,d,add:true);
            Assert.Equal(ServiceFailure.None,(await Reviews(db).SubmitAsync(d.CourseId,Owner(d),new(version))).Failure);}
        var gate=new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        async Task<ServiceFailure> Decide(){await gate.Task;using var scope=provider.CreateScope();var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();
            return (await Reviews(db).DecideAsync(d.CourseId,version,Reviewer(d),new("approved",null))).Failure;}
        var requests=new[]{Decide(),Decide()};gate.SetResult();var results=await Task.WhenAll(requests);
        Assert.Single(results,x=>x==ServiceFailure.None);Assert.Single(results,x=>x==ServiceFailure.Conflict);
        using var verify=provider.CreateScope();var check=verify.ServiceProvider.GetRequiredService<AppDbContext>();var state=await State(check,d);
        var decision=await check.CourseReviewDecisions.SingleAsync(x=>x.CourseVersionId==version);
        var ownerNotice=await check.Notifications.SingleAsync(x=>x.Id==decision.Id);
        Assert.Equal(d.Owner,ownerNotice.RecipientUserId);Assert.Equal("course.published",ownerNotice.NotificationType);
        var users=verify.ServiceProvider.GetRequiredService<Microsoft.AspNetCore.Identity.UserManager<esham.DAL.Entities.ApplicationUser>>();
        var inbox=(await new NotificationService(check,users).GetCurrentAsync(AccountFinalizationTests.Principal(d.Owner),new(1,100))).Value!;
        Assert.Equal($"/courses/{d.CourseId:D}",Assert.Single(inbox.Items,x=>x.Id==ownerNotice.Id).TargetUrl);
        Assert.Equal(version,Assert.Single(await new CourseService(check).GetPublicAsync(),x=>x.CourseId==d.CourseId).PublishedVersionId);
        Assert.Equal(version,state.AvailableCourseVersionId);Assert.Equal(d.V1,state.OriginalCourseVersionId);Assert.Equal(50,state.ProgressPercentage);
        Assert.Equal(2,await check.EnrollmentVersionAccess.CountAsync(x=>x.EnrollmentId==d.EnrollmentId));
        Assert.Equal(1,await check.Notifications.CountAsync(x=>x.RecipientUserId==d.Learner&&x.NotificationType=="course.updated"));
        Assert.Equal(1,await check.PointTransactions.CountAsync(x=>x.EnrollmentId==d.EnrollmentId));
    }
    [AccountSqlServerFact] public async Task Failure_after_saving_publication_rolls_back_pointer_receipts_notifications_and_decision()
    {
        var failure=new FailAfterPublicationSave();using var provider=DatabaseServices(failure);Data d;Guid version;
        using(var setup=provider.CreateScope()){var db=setup.ServiceProvider.GetRequiredService<AppDbContext>();d=await Setup(db);version=await Revision(db,d);
            await Reviews(db).SubmitAsync(d.CourseId,Owner(d),new(version));failure.Armed=true;
            await Assert.ThrowsAsync<InvalidOperationException>(()=>Reviews(db).DecideAsync(d.CourseId,version,Reviewer(d),new("approved",null)));}
        using var verify=provider.CreateScope();var check=verify.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(d.V1,(await check.Courses.SingleAsync(x=>x.Id==d.CourseId)).PublishedVersionId);
        Assert.Equal("pending",(await check.CourseVersions.SingleAsync(x=>x.Id==version)).ReviewStatus);
        Assert.False(await check.EnrollmentVersionAccess.AnyAsync(x=>x.EnrollmentId==d.EnrollmentId&&x.CourseVersionId==version));
        Assert.False(await check.Notifications.AnyAsync(x=>x.RecipientUserId==d.Learner&&x.NotificationType=="course.updated"));
        Assert.Equal(1,await check.Notifications.CountAsync(x=>x.RecipientUserId==d.Owner&&x.NotificationType=="course.published"));
        Assert.False(await check.CourseReviewDecisions.AnyAsync(x=>x.CourseVersionId==version));
        Assert.False(await check.AdminActivityLogs.AnyAsync(x=>x.CourseVersionId==version&&x.Action=="course.approved"));
    }
    [AccountSqlServerFact] public async Task Publication_and_new_enrollment_serialize_on_the_course_without_duplicate_access_or_fees()
    {
        using var provider=DatabaseServices();Data d;Guid version;string learnerId;
        using(var setup=provider.CreateScope()){var db=setup.ServiceProvider.GetRequiredService<AppDbContext>();d=await Setup(db);version=await Revision(db,d);
            await Reviews(db).SubmitAsync(d.CourseId,Owner(d),new(version));
            var learner=new esham.DAL.Entities.ApplicationUser {UserName=Guid.NewGuid().ToString("N"),Name="Concurrent learner"};db.Users.Add(learner);await db.SaveChangesAsync();learnerId=learner.Id;}
        var enrollmentId=Guid.NewGuid();var gate=new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        async Task Enroll(){await gate.Task;using var scope=provider.CreateScope();var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await Transaction(db,async()=>{
                var course=await db.Courses.FromSqlInterpolated($"SELECT * FROM [Courses] WITH (UPDLOCK, HOLDLOCK) WHERE [Id]={d.CourseId}").SingleAsync();
                var enrollment=new esham.DAL.Entities.Enrollment {Id=enrollmentId,LearnerUserId=learnerId,CourseId=d.CourseId,CourseVersionId=course.PublishedVersionId!.Value};
                db.Enrollments.Add(enrollment);await db.SaveChangesAsync();await Updates(db).StageEnrollmentAsync(enrollment);
            });}
        async Task Approve(){await gate.Task;using var scope=provider.CreateScope();var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();
            Assert.Equal(ServiceFailure.None,(await Reviews(db).DecideAsync(d.CourseId,version,Reviewer(d),new("approved",null))).Failure);}
        var requests=new[]{Enroll(),Approve()};gate.SetResult();await Task.WhenAll(requests);
        using var verify=provider.CreateScope();var check=verify.ServiceProvider.GetRequiredService<AppDbContext>();
        var state=(await Updates(check).GetStateAsync(enrollmentId,learnerId)).Value!;Assert.Equal(version,state.AvailableCourseVersionId);
        Assert.Equal(1,await check.Enrollments.CountAsync(x=>x.Id==enrollmentId));Assert.False(await check.PointTransactions.AnyAsync(x=>x.EnrollmentId==enrollmentId));
        var notices=await check.Notifications.CountAsync(x=>x.RecipientUserId==learnerId&&x.NotificationType=="course.updated");
        Assert.Equal(state.OriginalCourseVersionId==version?0:1,notices);
    }
    private sealed class FailAfterPublicationSave : SaveChangesInterceptor
    {
        public bool Armed {get;set;}
        public override ValueTask<int> SavedChangesAsync(SaveChangesCompletedEventData eventData,int result,CancellationToken cancellationToken=default)
        {
            if(Armed){Armed=false;throw new InvalidOperationException("Injected failure after publication save and before commit.");}
            return ValueTask.FromResult(result);
        }
    }
}
