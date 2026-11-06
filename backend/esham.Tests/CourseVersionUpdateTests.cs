using System.Data;
using esham.BLL.DTOs;
using esham.BLL.Services;
using esham.DAL.Data;
using esham.DAL.Entities;
using Microsoft.EntityFrameworkCore;
using Xunit;
using static esham.Tests.CourseReviewWorkflowTests;
namespace esham.Tests;

public sealed class CourseVersionUpdateTests
{
    internal sealed record Data(Guid CourseId, Guid V1, string Owner, string Reviewer, string Learner, Guid EnrollmentId, Guid LessonId, Guid TaskId, Guid? CertificateId);
    internal static CourseActor Owner(Data d) => new(d.Owner, true, false);
    internal static CourseActor Reviewer(Data d) => new(d.Reviewer, false, false, true);
    internal static CourseVersionUpdates Updates(AppDbContext db) => new(db, new NotificationWriter(db));
    internal static CourseReviewService Reviews(AppDbContext db) => new(db, new Store());
    internal static async Task Transaction(AppDbContext db, Func<Task> action) =>
        await db.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
        {
            db.ChangeTracker.Clear();
            await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
            await action(); await db.SaveChangesAsync(); await tx.CommitAsync();
        });
    internal static async Task<Data> Setup(AppDbContext db, bool completed = false, bool video = false)
    {
        var owner = Guid.NewGuid().ToString(); var reviewer = Guid.NewGuid().ToString();
        var d = await Seed(db, owner, reviewer); var s = Reviews(db);
        if(video) {
            var originalLesson=await db.Lessons.SingleAsync(x=>x.CourseSection.CourseVersionId==d.VersionId);
            var media=new MediaAsset {OwnerUserId=owner,MediaType="video",MimeType="video/mp4",StorageKey=Guid.NewGuid().ToString("N"),ContentHash=Guid.NewGuid().ToString("N"),OriginalFileName="original.mp4",SizeBytes=100};
            db.MediaAssets.Add(media);originalLesson.ContentType="video";originalLesson.PrimaryVideoMediaAssetId=media.Id;
            db.LessonAttachments.Add(new(){LessonId=originalLesson.Id,MediaAssetId=media.Id,DisplayName="Original video"});await db.SaveChangesAsync();
        }
        Assert.Equal(ServiceFailure.None, (await s.SubmitAsync(d.CourseId, new(owner,true,false), new(d.VersionId))).Failure);
        Assert.Equal(ServiceFailure.None, (await s.DecideAsync(d.CourseId,d.VersionId,new(reviewer,false,false,true),new("approved",null))).Failure);
        var learner = new ApplicationUser { UserName = Guid.NewGuid().ToString("N"), Name = "Learner" };
        db.Users.Add(learner); await db.SaveChangesAsync();
        var enrollment = new Enrollment { LearnerUserId = learner.Id, CourseId = d.CourseId, CourseVersionId = d.VersionId,
            Status = completed ? "completed" : "active", CompletedAt = completed ? DateTimeOffset.UtcNow.AddDays(-1) : null };
        db.Enrollments.Add(enrollment); await db.SaveChangesAsync();
        await Transaction(db, async () => await Updates(db).StageEnrollmentAsync(await db.Enrollments.SingleAsync(x=>x.Id==enrollment.Id)));
        var lesson = await db.Lessons.SingleAsync(x=>x.CourseSection.CourseVersionId==d.VersionId);
        var task = await db.CourseTasks.SingleAsync(x=>x.CourseVersionId==d.VersionId);
        db.LessonProgressRecords.Add(new(){EnrollmentId=enrollment.Id,LessonId=lesson.Id,IsCompleted=true,CompletedAt=DateTimeOffset.UtcNow.AddHours(-2),LastPositionSeconds=120});
        var attempt=new TaskSubmission {EnrollmentId=enrollment.Id,CourseTaskId=task.Id,Status="approved",SubmittedAt=DateTimeOffset.UtcNow.AddHours(-2)};
        db.TaskSubmissions.Add(attempt);
        db.TaskSubmissionReviews.Add(new(){TaskSubmissionId=attempt.Id,ReviewerUserId=owner,Decision="approved",Feedback="Original approved work"});
        db.Wallets.Add(new(){UserId=learner.Id,Balance=80});
        db.PointTransactions.Add(new(){UserId=learner.Id,EnrollmentId=enrollment.Id,Amount=-20,TransactionType="enrollment",OperationKey="version-test:"+enrollment.Id});
        Certificate? certificate = completed ? new(){EnrollmentId=enrollment.Id,CourseVersionId=d.VersionId,VerificationCode=Guid.NewGuid().ToString(),
            LearnerNameSnapshot="Learner",InstructorNameSnapshot="Instructor",CourseTitleSnapshotEn="Original title"} : null;
        if(certificate!=null)db.Certificates.Add(certificate);
        db.CourseReviews.Add(new(){EnrollmentId=enrollment.Id,CourseVersionId=d.VersionId,Rating=5,Comment="Original version review"});
        await db.SaveChangesAsync();
        return new(d.CourseId,d.VersionId,owner,reviewer,learner.Id,enrollment.Id,lesson.Id,task.Id,certificate?.Id);
    }
    internal static async Task<Guid> Revision(AppDbContext db, Data d, bool add = false, bool replace = false)
    {
        var previous = (await db.Courses.AsNoTracking().SingleAsync(x=>x.Id==d.CourseId)).DraftVersionId!.Value;
        var result = await Reviews(db).ReviseAsync(d.CourseId,Owner(d),new(previous));Assert.Equal(ServiceFailure.None,result.Failure);
        var id=result.Value;var section=await db.CourseSections.SingleAsync(x=>x.CourseVersionId==id);
        var lesson=await db.Lessons.SingleAsync(x=>x.CourseSectionId==section.Id);lesson.DescriptionEn="The updated lesson has entirely different content.";
        var task=await db.CourseTasks.SingleAsync(x=>x.CourseVersionId==id);task.Instructions=new(null,"Updated instructions");task.Requirements=[new(null,"A changed assessment requirement")];
        if(replace){db.Lessons.Remove(lesson);db.CourseTasks.Remove(task);}
        if(add||replace)
        {
            db.Lessons.Add(new(){CourseSectionId=section.Id,TitleEn="Reading lesson",ContentType="article",DescriptionEn="New independent educational article",DurationSeconds=600,Objectives=[new(null,"New objective")]});
            db.CourseTasks.Add(new(){CourseVersionId=id,DisplaySectionId=section.Id,TitleEn="Task",DescriptionEn="New task",Instructions=new(null,"New instructions"),Requirements=[new(null,"New assessment")],IsReady=true});
        }
        await db.SaveChangesAsync();return id;
    }
    internal static async Task Publish(AppDbContext db, Data d, Guid id)
    {
        Assert.Equal(ServiceFailure.None,(await Reviews(db).SubmitAsync(d.CourseId,Owner(d),new(id))).Failure);
        Assert.Equal(ServiceFailure.None,(await Reviews(db).DecideAsync(d.CourseId,id,Reviewer(d),new("approved","Reviewed updated content"))).Failure);
    }
    internal static async Task<esham.BLL.DTOs.Courses.EnrollmentVersionState> State(AppDbContext db, Data d)
    {
        var result=await Updates(db).GetStateAsync(d.EnrollmentId,d.Learner);Assert.Equal(ServiceFailure.None,result.Failure);return result.Value!;
    }
    [Fact] public async Task Edited_logical_content_inherits_achievements_without_reenrollment_or_points()
    {
        await using var db=Context();var d=await Setup(db);var v2=await Revision(db,d);await Publish(db,d,v2);
        var state=await State(db,d);Assert.Equal(d.V1,state.OriginalCourseVersionId);Assert.Equal(v2,state.AvailableCourseVersionId);
        Assert.True(Assert.Single(state.Lessons).IsCompleted);Assert.True(state.Lessons[0].IsInherited);Assert.True(state.Lessons[0].IsUpdated);
        Assert.True(Assert.Single(state.Tasks).IsApproved);Assert.True(state.Tasks[0].IsInherited);Assert.True(state.Tasks[0].IsUpdated);
        Assert.Equal(100,state.ProgressPercentage);Assert.True(state.MeetsCurrentRequirements);Assert.Equal(1,await db.Enrollments.CountAsync());
        Assert.Equal(1,await db.PointTransactions.CountAsync());Assert.Equal(80,(await db.Wallets.SingleAsync()).Balance);
        Assert.Equal(d.V1,(await db.CourseReviews.SingleAsync()).CourseVersionId);
        Assert.Single(await db.LessonProgressRecords.ToListAsync());Assert.Equal(120,(await db.LessonProgressRecords.SingleAsync()).LastPositionSeconds);
    }
    [Fact] public async Task New_content_is_incomplete_for_ongoing_learners_but_does_not_remove_old_achievements()
    {
        await using var db=Context();var d=await Setup(db);var id=await Revision(db,d,add:true);await Publish(db,d,id);var state=await State(db,d);
        Assert.Equal(50,state.ProgressPercentage);Assert.Equal(4,state.RequiredItemCount);
        Assert.False(Assert.Single(state.Lessons,x=>x.IsNewToEnrollment).IsCompleted);
        Assert.False(Assert.Single(state.Tasks,x=>x.IsNewToEnrollment).IsApproved);
        Assert.Equal(d.LessonId,state.Lessons.Single(x=>x.IsCompleted).CompletionSource!.ContentId);
    }
    [Fact] public async Task Completed_learners_keep_status_date_certificate_and_one_hundred_percent_with_optional_new_material()
    {
        await using var db=Context();var d=await Setup(db,true);var before=await db.Enrollments.AsNoTracking().SingleAsync();
        var id=await Revision(db,d,add:true);await Publish(db,d,id);var state=await State(db,d);
        Assert.True(state.IsCourseCompleted);Assert.Equal(before.CompletedAt,state.CompletedAt);Assert.Equal("completed",state.EnrollmentStatus);
        Assert.Equal(100,state.ProgressPercentage);Assert.Equal(50,state.CurrentCoveragePercentage);Assert.Equal(0,state.RequiredItemCount);
        Assert.All(state.Lessons,x=>Assert.True(x.IsOptional));Assert.All(state.Tasks,x=>Assert.True(x.IsOptional));
        Assert.All(state.Tasks,x=>Assert.True(x.OptionalResubmissionAllowedByPolicy));
        Assert.Equal(d.CertificateId,state.CertificateId);Assert.Equal(d.V1,state.CertificateCourseVersionId);
        Assert.Equal("Original title",(await db.Certificates.SingleAsync()).CourseTitleSnapshotEn);
    }
    [Fact] public async Task Optional_rejected_attempt_and_revisit_cannot_revoke_an_earned_achievement()
    {
        await using var db=Context();var d=await Setup(db);var id=await Revision(db,d);await Publish(db,d,id);
        var task=await db.CourseTasks.SingleAsync(x=>x.CourseVersionId==id);
        var optional=new TaskSubmission {EnrollmentId=d.EnrollmentId,CourseTaskId=task.Id,Status="rejected",AttemptNumber=1,IsOptionalAtCreation=true,AnswerText="Optional new work"};
        db.TaskSubmissions.Add(optional);db.TaskSubmissionReviews.Add(new(){TaskSubmissionId=optional.Id,ReviewerUserId=d.Owner,Decision="rejected",Feedback="Optional attempt rejected"});
        var lesson=await db.Lessons.SingleAsync(x=>x.CourseSection.CourseVersionId==id);
        db.LessonProgressRecords.Add(new(){EnrollmentId=d.EnrollmentId,LessonId=lesson.Id,IsCompleted=false,LastPositionSeconds=30});
        await db.SaveChangesAsync();var state=await State(db,d);
        Assert.True(state.Tasks[0].IsApproved);Assert.True(state.Tasks[0].OptionalResubmissionAllowedByPolicy);
        Assert.False(state.LearnerSubmissionApiAvailable);Assert.True(state.Lessons[0].IsCompleted);Assert.Equal(100,state.ProgressPercentage);
        Assert.Equal(2,await db.TaskSubmissions.CountAsync());Assert.Equal(2,await db.TaskSubmissionReviews.CountAsync());
        Assert.True((await db.TaskSubmissions.SingleAsync(x=>x.Id==optional.Id)).IsOptionalAtCreation);
        Assert.True((await db.LessonProgressRecords.SingleAsync(x=>x.LessonId==d.LessonId)).IsCompleted);
    }
    [Fact] public async Task Deleted_and_replaced_content_never_inherits_by_title_and_history_is_retained()
    {
        await using var db=Context();var d=await Setup(db);var id=await Revision(db,d,replace:true);await Publish(db,d,id);var state=await State(db,d);
        Assert.Equal(0,state.ProgressPercentage);Assert.All(state.Lessons,x=>Assert.False(x.IsCompleted));Assert.All(state.Tasks,x=>Assert.False(x.IsApproved));
        Assert.True(await db.LessonProgressRecords.AnyAsync(x=>x.LessonId==d.LessonId&&x.IsCompleted));
        Assert.True(await db.TaskSubmissions.AnyAsync(x=>x.CourseTaskId==d.TaskId&&x.Status=="approved"));
    }
    [Fact] public async Task Lineage_is_preserved_across_multiple_publications()
    {
        await using var db=Context();var d=await Setup(db);var v2=await Revision(db,d);await Publish(db,d,v2);var v3=await Revision(db,d);await Publish(db,d,v3);
        var state=await State(db,d);Assert.Equal(d.V1,state.Lessons[0].CompletionSource!.CourseVersionId);Assert.Equal(d.V1,state.Tasks[0].ApprovalSource!.CourseVersionId);
        Assert.Equal(100,state.ProgressPercentage);Assert.Equal(3,await db.EnrollmentVersionAccess.CountAsync());
        Assert.Equal(2,await db.Notifications.Where(x=>x.RecipientUserId==d.Learner).CountAsync());Assert.Equal(v2,(await db.EnrollmentVersionAccess.SingleAsync(x=>x.CourseVersionId==v3)).PreviousCourseVersionId);
    }
    [Fact] public async Task Publication_replay_deduplicates_receipts_and_preserves_notification_read_state()
    {
        await using var db=Context();var d=await Setup(db);var id=await Revision(db,d);await Publish(db,d,id);
        var notification=await db.Notifications.Where(x=>x.RecipientUserId==d.Learner).SingleAsync();notification.IsRead=true;notification.ReadAt=DateTimeOffset.UtcNow;await db.SaveChangesAsync();var readAt=notification.ReadAt;
        await Transaction(db,async()=>{var course=await db.Courses.SingleAsync(x=>x.Id==d.CourseId);var version=await db.CourseVersions.SingleAsync(x=>x.Id==id);
            await Updates(db).StagePublicationAsync(course,version,d.V1);await Updates(db).StagePublicationAsync(course,version,d.V1);});
        Assert.Equal(2,await db.EnrollmentVersionAccess.CountAsync());Assert.Equal(1,await db.Notifications.Where(x=>x.RecipientUserId==d.Learner).CountAsync());Assert.Equal(readAt,(await db.Notifications.Where(x=>x.RecipientUserId==d.Learner).SingleAsync()).ReadAt);
        Assert.Equal("course.updated",(await db.Notifications.Where(x=>x.RecipientUserId==d.Learner).SingleAsync()).NotificationType);
    }
    [Theory] [InlineData("rejected")] [InlineData("changes_requested")]
    public async Task Unapproved_versions_never_trigger_learner_access_or_publication_notifications(string decision)
    {
        await using var db=Context();var d=await Setup(db);var id=await Revision(db,d);await Reviews(db).SubmitAsync(d.CourseId,Owner(d),new(id));
        Assert.Empty(await db.Notifications.Where(x=>x.RecipientUserId==d.Learner).ToListAsync());
        await Reviews(db).DecideAsync(d.CourseId,id,Reviewer(d),new(decision,"Needs more work"));
        Assert.Empty(await db.Notifications.Where(x=>x.RecipientUserId==d.Learner).Where(x=>x.RecipientUserId==d.Learner).ToListAsync());Assert.Equal(d.V1,(await State(db,d)).AvailableCourseVersionId);Assert.Equal(1,await db.EnrollmentVersionAccess.CountAsync());
    }
    [Theory] [InlineData("canceled")] [InlineData("cancelled")] [InlineData("refunded")] [InlineData("suspended")]
    public async Task Ineligible_enrollments_are_not_changed_or_notified(string status)
    {
        await using var db=Context();var d=await Setup(db);var e=await db.Enrollments.SingleAsync();e.Status=status;await db.SaveChangesAsync();
        var id=await Revision(db,d);await Publish(db,d,id);Assert.Empty(await db.Notifications.Where(x=>x.RecipientUserId==d.Learner).ToListAsync());Assert.Equal(1,await db.EnrollmentVersionAccess.CountAsync());
        Assert.Equal(ServiceFailure.Forbidden,(await Updates(db).GetStateAsync(d.EnrollmentId,d.Learner)).Failure);
    }
    [Fact] public async Task Unauthorized_version_access_and_unapproved_staging_fail_closed()
    {
        await using var db=Context();var d=await Setup(db);
        Assert.Equal(ServiceFailure.Forbidden,(await Updates(db).GetStateAsync(d.EnrollmentId,"other-user")).Failure);
        await Assert.ThrowsAsync<InvalidOperationException>(()=>Updates(db).StageEnrollmentAsync(new()));
        var id=await Revision(db,d);
        await Transaction(db,async()=>await Assert.ThrowsAsync<InvalidOperationException>(()=>Updates(db).StagePublicationAsync(
            db.Courses.Single(x=>x.Id==d.CourseId),db.CourseVersions.Single(x=>x.Id==id),d.V1)));
        Assert.Empty(await db.Notifications.Where(x=>x.RecipientUserId==d.Learner).ToListAsync());
    }
    [Fact] public async Task Original_version_and_logical_identity_cannot_be_rewritten_after_save()
    {
        await using var db=Context();var d=await Setup(db);
        var e=await db.Enrollments.SingleAsync();e.CourseVersionId=Guid.NewGuid();await Assert.ThrowsAsync<InvalidOperationException>(()=>db.SaveChangesAsync());
        db.ChangeTracker.Clear();var lesson=await db.Lessons.SingleAsync();lesson.LogicalLessonId=Guid.NewGuid();await Assert.ThrowsAsync<InvalidOperationException>(()=>db.SaveChangesAsync());
    }

    [Fact] public async Task Persisted_legacy_approval_without_a_review_row_is_preserved()
    {
        await using var db=Context();var d=await Setup(db);
        db.TaskSubmissionReviews.RemoveRange(await db.TaskSubmissionReviews.ToListAsync());await db.SaveChangesAsync();
        var id=await Revision(db,d);await Publish(db,d,id);var state=await State(db,d);
        Assert.True(Assert.Single(state.Tasks).IsApproved);Assert.Equal(d.TaskId,state.Tasks[0].ApprovalSource!.ContentId);
    }
    [Fact] public async Task Updated_video_keeps_old_completion_and_position_without_overwriting_new_playback()
    {
        await using var db=Context();var d=await Setup(db,video:true);var id=await Revision(db,d);
        var lesson=await db.Lessons.SingleAsync(x=>x.CourseSection.CourseVersionId==id);
        db.LessonAttachments.RemoveRange(await db.LessonAttachments.Where(x=>x.LessonId==lesson.Id).ToListAsync());
        var media=new MediaAsset {OwnerUserId=d.Owner,MediaType="video",MimeType="video/mp4",StorageKey=Guid.NewGuid().ToString("N"),ContentHash=Guid.NewGuid().ToString("N"),OriginalFileName="updated.mp4",SizeBytes=100};
        db.MediaAssets.Add(media);lesson.PrimaryVideoMediaAssetId=media.Id;db.LessonAttachments.Add(new(){LessonId=lesson.Id,MediaAssetId=media.Id,DisplayName="Updated video"});
        await db.SaveChangesAsync();await Publish(db,d,id);var state=await State(db,d);var item=Assert.Single(state.Lessons);
        Assert.True(item.IsCompleted);Assert.True(item.IsInherited);Assert.Equal(120,item.PreviousLastPositionSeconds);
        Assert.Null(item.ResumePositionSeconds);Assert.Equal(0,item.CurrentLastPositionSeconds);
        var original=await db.LessonProgressRecords.SingleAsync(x=>x.LessonId==d.LessonId);Assert.True(original.IsCompleted);Assert.Equal(120,original.LastPositionSeconds);
    }

    [Fact] public async Task Historical_progress_and_submission_cannot_be_retargeted_to_updated_content()
    {
        await using var db=Context();var d=await Setup(db);var id=await Revision(db,d);
        var newTask=await db.CourseTasks.SingleAsync(x=>x.CourseVersionId==id);
        var oldAttempt=await db.TaskSubmissions.SingleAsync();oldAttempt.CourseTaskId=newTask.Id;
        await Assert.ThrowsAsync<InvalidOperationException>(()=>db.SaveChangesAsync());db.ChangeTracker.Clear();
        var newLesson=await db.Lessons.SingleAsync(x=>x.CourseSection.CourseVersionId==id);
        var oldProgress=await db.LessonProgressRecords.SingleAsync();oldProgress.LessonId=newLesson.Id;
        await Assert.ThrowsAsync<InvalidOperationException>(()=>db.SaveChangesAsync());
    }

    [Fact] public async Task Explicit_historical_achievements_survive_unknown_legacy_availability_without_fabricating_access()
    {
        await using var db=Context();var d=await Setup(db);var v2=await Revision(db,d,add:true);await Publish(db,d,v2);
        var second=await State(db,d);var lesson=second.Lessons.Single(x=>x.IsNewToEnrollment);var task=second.Tasks.Single(x=>x.IsNewToEnrollment);
        db.LessonProgressRecords.Add(new(){EnrollmentId=d.EnrollmentId,LessonId=lesson.LessonId,IsCompleted=true,CompletedAt=DateTimeOffset.UtcNow});
        db.TaskSubmissions.Add(new(){EnrollmentId=d.EnrollmentId,CourseTaskId=task.TaskId,Status="approved"});
        // Emulate legacy history known through earned records but without an availability receipt.
        db.EnrollmentVersionAccess.Remove(await db.EnrollmentVersionAccess.SingleAsync(x=>x.EnrollmentId==d.EnrollmentId&&x.CourseVersionId==v2));await db.SaveChangesAsync();
        var v3=(await Reviews(db).ReviseAsync(d.CourseId,Owner(d),new(v2))).Value;await Publish(db,d,v3);var current=await State(db,d);
        Assert.Equal(100,current.ProgressPercentage);Assert.Equal(v2,current.Lessons.Single(x=>x.LogicalLessonId==lesson.LogicalLessonId).CompletionSource!.CourseVersionId);
        Assert.False(await db.EnrollmentVersionAccess.AnyAsync(x=>x.EnrollmentId==d.EnrollmentId&&x.CourseVersionId==v2));
    }

    [Fact] public async Task Updated_attachment_flags_do_not_reset_earned_credit()
    {
        await using var db=Context();var d=await Setup(db);var id=await Revision(db,d);
        var old=await db.CourseTasks.SingleAsync(x=>x.Id==d.TaskId);var task=await db.CourseTasks.SingleAsync(x=>x.CourseVersionId==id);
        task.Instructions=old.Instructions;task.Requirements=old.Requirements!.ToList();
        var file=new MediaAsset {OwnerUserId=d.Owner,MediaType="document",MimeType="application/pdf",StorageKey=Guid.NewGuid().ToString("N"),ContentHash=Guid.NewGuid().ToString("N"),OriginalFileName="updated.pdf",SizeBytes=100};
        db.MediaAssets.Add(file);db.TaskAttachments.Add(new(){CourseTaskId=task.Id,MediaAssetId=file.Id,DisplayName="New instructions file"});
        await db.SaveChangesAsync();await Publish(db,d,id);var state=await State(db,d);
        Assert.True(Assert.Single(state.Tasks).IsUpdated);Assert.True(state.Tasks[0].IsApproved);Assert.Equal(100,state.ProgressPercentage);
    }
}
