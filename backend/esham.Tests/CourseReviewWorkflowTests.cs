using esham.BLL.DTOs;
using esham.BLL.DTOs.Courses;
using esham.BLL.Interfaces;
using esham.BLL.Services;
using esham.DAL.Data;
using esham.DAL.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Xunit;
namespace esham.Tests;
public sealed class CourseReviewWorkflowTests
{
    private static readonly CourseActor Owner = new("owner", true, false), Reviewer = new("reviewer", false, false, true);
    internal static AppDbContext Context() => new(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString())
        .ReplaceService<IDbContextTransactionManager, TestTransactionManager>().Options);
    internal sealed class Store : IMediaStorage
    {
        public Task<StoredMediaFile> SaveAsync(Stream input, string contentType, CancellationToken ct) => throw new NotSupportedException();
        public Task DeleteAsync(string key, CancellationToken ct) => throw new NotSupportedException();
        public Task<Stream?> OpenAsync(string key, CancellationToken ct) => Task.FromResult<Stream?>(new MemoryStream([1,2,3]));
    }
    internal static async Task<(Guid CourseId, Guid VersionId, Guid CategoryId)> Seed(AppDbContext db, string owner = "owner", string reviewer = "reviewer")
    {
        foreach(var id in new[]{owner,reviewer}) if(!await db.Users.AnyAsync(x=>x.Id==id)) db.Users.Add(new(){Id=id,UserName=id,Name=id});
        var category=new Category {NameAr="Review category",NameEn="Review category",IsActive=true};
        var cover=new MediaAsset {OwnerUserId=owner,MediaType="image",MimeType="image/png",SizeBytes=100,StorageKey="review-cover-"+Guid.NewGuid(),ContentHash=Guid.NewGuid().ToString()};
        db.AddRange(category,cover);await db.SaveChangesAsync();
        var course=new Course {OwnerUserId=owner};db.Courses.Add(course);await db.SaveChangesAsync();
        var version=new CourseVersion {CourseId=course.Id,CategoryId=category.Id,VersionNumber=1,TitleEn="Temporary review test",DescriptionEn="A complete educational course description",
            Objectives=[new(null,"Course objective")],CoverMediaAssetId=cover.Id};
        db.CourseVersions.Add(version);await db.SaveChangesAsync();course.DraftVersionId=version.Id;await db.SaveChangesAsync();
        var section=new CourseSection {CourseVersionId=version.Id,TitleEn="Section"};db.CourseSections.Add(section);
        var lesson=new Lesson {CourseSectionId=section.Id,TitleEn="Reading lesson",ContentType="article",DescriptionEn="A complete educational lesson article",
            DurationSeconds=600,Objectives=[new(null,"Lesson objective")]};db.Lessons.Add(lesson);
        db.CourseTasks.Add(new(){CourseVersionId=version.Id,DisplaySectionId=section.Id,TitleEn="Task",DescriptionEn="Practical task",
            Instructions=new(null,"Instructions"),Requirements=[new(null,"Requirement")],IsReady=true});
        db.CategoryAdminAssignments.Add(new(){UserId=reviewer,CategoryId=category.Id});await db.SaveChangesAsync();
        return(course.Id,version.Id,category.Id);
    }
    [Fact] public async Task Eligible_submit_is_atomic_pending_never_publishes_and_blocks_duplicates_and_edits()
    {
        await using var db=Context();var d=await Seed(db);var service=new CourseReviewService(db,new Store());
        Assert.True((await new CourseSubmissionEligibilityService(db).GetAsync(d.CourseId,Owner)).Value!.CanSubmit);
        Assert.Equal(ServiceFailure.None,(await service.SubmitAsync(d.CourseId,Owner,new(d.VersionId))).Failure);
        var snapshot=(await service.GetAsync(d.CourseId,null,Owner)).Value!;
        Assert.Equal("pending",snapshot.Version.ReviewStatus);Assert.NotNull(snapshot.Version.SubmittedAt);Assert.Null(snapshot.PublishedVersionId);
        Assert.False(snapshot.Eligibility.CanSubmit);Assert.True(snapshot.Eligibility.ContentEligible);
        Assert.Equal(ServiceFailure.Conflict,(await service.SubmitAsync(d.CourseId,Owner,new(d.VersionId))).Failure);
        Assert.Equal(ServiceFailure.Conflict,(await new CourseService(db).UpdateDraftAsync(d.CourseId,Owner,new(){TitleEn="Illegal"})).Failure);
        Assert.Equal(ServiceFailure.Conflict,(await new CurriculumService(db).EnsureDefaultSectionAsync(d.CourseId,Owner)).Failure);
        Assert.Empty(await new CourseService(db).GetPublicAsync());Assert.Single(await db.AdminActivityLogs.ToListAsync());
    }
    [Fact] public async Task Submission_checks_ownership_expected_version_and_precise_missing_requirements()
    {
        await using var db=Context();var d=await Seed(db);var service=new CourseReviewService(db,new Store());
        Assert.Equal(ServiceFailure.Forbidden,(await service.SubmitAsync(d.CourseId,new("stranger",true,false),new(d.VersionId))).Failure);
        Assert.Equal(ServiceFailure.Conflict,(await service.SubmitAsync(d.CourseId,Owner,new(Guid.NewGuid()))).Failure);
        var v=await db.CourseVersions.SingleAsync();v.Objectives=[];v.CoverMediaAssetId=null;await db.SaveChangesAsync();
        var result=await service.SubmitAsync(d.CourseId,Owner,new(d.VersionId));Assert.Equal(ServiceFailure.Validation,result.Failure);
        Assert.Contains("cover",result.Message);Assert.Contains("objectives",result.Message);
        Assert.Equal("draft",(await db.CourseVersions.AsNoTracking().SingleAsync()).ReviewStatus);Assert.Empty(await db.AdminActivityLogs.ToListAsync());
    }
    [Fact] public async Task Category_scope_role_self_review_and_history_access_are_enforced()
    {
        await using var db=Context();var d=await Seed(db);var s=new CourseReviewService(db,new Store());await s.SubmitAsync(d.CourseId,Owner,new(d.VersionId));
        var outsider=new CourseActor("outsider",false,false,true);
        Assert.Empty((await s.ListAsync(outsider,null)).Value!);
        Assert.Equal(ServiceFailure.Forbidden,(await s.GetAsync(d.CourseId,d.VersionId,outsider)).Failure);
        Assert.Equal(ServiceFailure.Forbidden,(await s.DecideAsync(d.CourseId,d.VersionId,outsider,new("approved",null))).Failure);
        Assert.Equal(ServiceFailure.Forbidden,(await s.DecideAsync(d.CourseId,d.VersionId,new("general",false,true),new("approved",null))).Failure);
        Assert.Single((await s.ListAsync(new("general",false,true),null)).Value!);
        Assert.Equal(ServiceFailure.Forbidden,(await s.GetAsync(d.CourseId,null,new("",false,false))).Failure);
        Assert.Equal(ServiceFailure.Forbidden,(await s.DecideAsync(d.CourseId,d.VersionId,Owner with {IsCategoryAdmin=true},new("approved",null))).Failure);
        Assert.Single((await s.ListAsync(Reviewer,"pending")).Value!);Assert.True((await s.GetAsync(d.CourseId,d.VersionId,Reviewer)).Value!.CanReview);
        var assignment=await db.CategoryAdminAssignments.SingleAsync();assignment.IsActive=false;await db.SaveChangesAsync();
        Assert.Equal(ServiceFailure.Forbidden,(await s.DecideAsync(d.CourseId,d.VersionId,Reviewer,new("approved",null))).Failure);
    }
    [Theory] [InlineData("rejected")] [InlineData("changes_requested")]
    public async Task Rejection_requires_feedback_preserves_decided_snapshot_and_clones_complete_revision(string decision)
    {
        await using var db=Context();var d=await Seed(db);var s=new CourseReviewService(db,new Store());await s.SubmitAsync(d.CourseId,Owner,new(d.VersionId));
        Assert.Equal(ServiceFailure.Validation,(await s.DecideAsync(d.CourseId,d.VersionId,Reviewer,new(decision," "))).Failure);
        Assert.Equal(ServiceFailure.None,(await s.DecideAsync(d.CourseId,d.VersionId,Reviewer,new(decision,"Please improve the explanation"))).Failure);
        Assert.Equal(ServiceFailure.Conflict,(await s.DecideAsync(d.CourseId,d.VersionId,Reviewer,new("approved",null))).Failure);
        var old=(await s.GetAsync(d.CourseId,d.VersionId,Owner)).Value!;Assert.Null(old.PublishedVersionId);Assert.Equal(decision,old.Version.ReviewStatus);
        Assert.Equal("Please improve the explanation",Assert.Single(old.Decisions).Comment);
        var next=(await s.ReviseAsync(d.CourseId,Owner,new(d.VersionId))).Value;Assert.NotEqual(d.VersionId,next);
        var revised=(await s.GetAsync(d.CourseId,null,Owner)).Value!;Assert.Equal("draft",revised.Version.ReviewStatus);Assert.Equal(2,revised.Version.VersionNumber);
        Assert.NotEqual(old.Sections[0].Id,revised.Sections[0].Id);Assert.NotEqual(old.Sections[0].Lessons[0].Id,revised.Sections[0].Lessons[0].Id);
        Assert.Equal(revised.Sections[0].Id,revised.Tasks[0].DisplaySectionId);
        await new CourseService(db).UpdateDraftAsync(d.CourseId,Owner,new(){TitleEn="Changed revision"});
        Assert.Equal("Temporary review test",(await s.GetAsync(d.CourseId,d.VersionId,Owner)).Value!.Version.TitleEn);
        Assert.Empty(await new CourseService(db).GetPublicAsync());
    }
    [Fact] public async Task Requested_changes_stage_one_owner_notification_with_feedback_and_stable_decision_identity()
    {
        await using var db=Context();var d=await Seed(db);var s=new CourseReviewService(db,new Store());
        await s.SubmitAsync(d.CourseId,Owner,new(d.VersionId));
        Assert.Equal(ServiceFailure.Forbidden,(await s.DecideAsync(d.CourseId,d.VersionId,new("general",false,true),new("changes_requested","Feedback"))).Failure);
        Assert.Empty(await db.Notifications.ToListAsync());
        Assert.Equal(ServiceFailure.None,(await s.DecideAsync(d.CourseId,d.VersionId,Reviewer,new("changes_requested","Improve the video"))).Failure);
        var notice=Assert.Single(await db.Notifications.AsNoTracking().ToListAsync());
        Assert.Equal(Owner.UserId,notice.RecipientUserId);Assert.Equal("course.changes_requested",notice.NotificationType);
        Assert.Contains("Improve the video",notice.MessageEn);Assert.Contains("Improve the video",notice.MessageAr);
        Assert.Equal((await db.CourseReviewDecisions.SingleAsync()).Id,notice.Id);
        Assert.Equal(ServiceFailure.Conflict,(await s.DecideAsync(d.CourseId,d.VersionId,Reviewer,new("changes_requested","Improve the video"))).Failure);
        Assert.Single(await db.Notifications.AsNoTracking().ToListAsync());
    }

    [Fact] public async Task Approval_commits_published_catalog_and_one_owner_notification_without_exposing_later_drafts()
    {
        await using var db=Context();var d=await Seed(db);var s=new CourseReviewService(db,new Store());
        Assert.Empty(await new CourseService(db).GetPublicAsync());
        await s.SubmitAsync(d.CourseId,Owner,new(d.VersionId));Assert.Empty(await new CourseService(db).GetPublicAsync());
        Assert.Equal(ServiceFailure.Forbidden,(await s.DecideAsync(d.CourseId,d.VersionId,new("outsider",false,false,true),new("approved",null))).Failure);
        await s.DecideAsync(d.CourseId,d.VersionId,Reviewer,new("approved",null));
        var notice=Assert.Single(await db.Notifications.ToListAsync());Assert.Equal(Owner.UserId,notice.RecipientUserId);Assert.Equal("course.published",notice.NotificationType);
        Assert.Equal((await db.CourseReviewDecisions.SingleAsync()).Id,notice.Id);
        Assert.Equal(d.VersionId,Assert.Single(await new CourseService(db).GetPublicAsync()).PublishedVersionId);
        Assert.Equal(ServiceFailure.Conflict,(await s.DecideAsync(d.CourseId,d.VersionId,Reviewer,new("approved",null))).Failure);Assert.Single(await db.Notifications.ToListAsync());
        var next=(await s.ReviseAsync(d.CourseId,Owner,new(d.VersionId))).Value;
        await new CourseService(db).UpdateDraftAsync(d.CourseId,Owner,new(){TitleEn="PRIVATE draft title"});
        Assert.Equal("Temporary review test",(await new CourseService(db).GetPublicAsync(d.CourseId)).Value!.TitleEn);
        Assert.NotEqual(d.VersionId,next);Assert.Equal(2,await db.CourseVersions.CountAsync());
        var course=await db.Courses.SingleAsync();course.SafetyStatus="archived";await db.SaveChangesAsync();Assert.Empty(await new CourseService(db).GetPublicAsync());
    }

    [Fact] public async Task Approval_publishes_exact_snapshot_and_new_rejected_revision_cannot_replace_it()
    {
        await using var db=Context();var d=await Seed(db);var s=new CourseReviewService(db,new Store());await s.SubmitAsync(d.CourseId,Owner,new(d.VersionId));
        Assert.Equal(ServiceFailure.None,(await s.DecideAsync(d.CourseId,d.VersionId,Reviewer,new("approved",null))).Failure);
        var publicCourse=Assert.Single(await new CourseService(db).GetPublicAsync());Assert.Equal(d.VersionId,publicCourse.PublishedVersionId);
        var next=(await s.ReviseAsync(d.CourseId,Owner,new(d.VersionId))).Value;
        await new CourseService(db).UpdateDraftAsync(d.CourseId,Owner,new(){TitleEn="PRIVATE REVISION"});
        Assert.Equal("Temporary review test",Assert.Single(await new CourseService(db).GetPublicAsync()).TitleEn);
        await s.SubmitAsync(d.CourseId,Owner,new(next));await s.DecideAsync(d.CourseId,next,Reviewer,new("rejected","Needs improvement"));
        Assert.Equal(d.VersionId,Assert.Single(await new CourseService(db).GetPublicAsync()).PublishedVersionId);
        Assert.Equal("approved",(await s.GetAsync(d.CourseId,d.VersionId,Owner)).Value!.Version.ReviewStatus);
        Assert.Equal(5,await db.AdminActivityLogs.CountAsync());
    }
    [Fact] public async Task Approval_rechecks_category_and_media_scope_is_version_bound()
    {
        await using var db=Context();var d=await Seed(db);var s=new CourseReviewService(db,new Store());await s.SubmitAsync(d.CourseId,Owner,new(d.VersionId));
        var asset=(await s.GetAsync(d.CourseId,d.VersionId,Reviewer)).Value!.Media[0].Id;
        Assert.Equal(ServiceFailure.None,(await s.OpenMediaAsync(d.CourseId,d.VersionId,asset,Reviewer)).Failure);
        Assert.Equal(ServiceFailure.NotFound,(await s.OpenMediaAsync(d.CourseId,d.VersionId,Guid.NewGuid(),Reviewer)).Failure);
        Assert.Equal(ServiceFailure.Forbidden,(await s.OpenMediaAsync(d.CourseId,d.VersionId,asset,new("other",false,false,true))).Failure);
        var category=await db.Categories.SingleAsync();category.IsActive=false;await db.SaveChangesAsync();
        Assert.Equal(ServiceFailure.Conflict,(await s.DecideAsync(d.CourseId,d.VersionId,Reviewer,new("approved",null))).Failure);
        Assert.Null((await db.Courses.AsNoTracking().SingleAsync()).PublishedVersionId);
    }

    [Fact] public async Task Revision_copies_video_and_task_attachment_relationships_without_mutating_shared_assets()
    {
        await using var db=Context();var d=await Seed(db);
        var lesson=await db.Lessons.SingleAsync();var task=await db.CourseTasks.SingleAsync();
        var video=new MediaAsset {OwnerUserId=Owner.UserId,MediaType="video",MimeType="video/mp4",SizeBytes=100,StorageKey="video",ContentHash="immutable"};
        var file=new MediaAsset {OwnerUserId=Owner.UserId,MediaType="document",MimeType="application/pdf",SizeBytes=100,StorageKey="file",ContentHash="immutable-file"};
        db.MediaAssets.AddRange(video,file);lesson.ContentType="video";lesson.PrimaryVideoMediaAssetId=video.Id;
        db.LessonAttachments.Add(new(){LessonId=lesson.Id,MediaAssetId=video.Id,DisplayName="Video"});
        db.TaskAttachments.Add(new(){CourseTaskId=task.Id,MediaAssetId=file.Id,DisplayName="Instructions"});
        await db.SaveChangesAsync();var s=new CourseReviewService(db,new Store());
        Assert.Equal(ServiceFailure.None,(await s.SubmitAsync(d.CourseId,Owner,new(d.VersionId))).Failure);
        await s.DecideAsync(d.CourseId,d.VersionId,Reviewer,new("approved",null));
        await s.ReviseAsync(d.CourseId,Owner,new(d.VersionId));
        var current=(await s.GetAsync(d.CourseId,null,Owner)).Value!;var old=(await s.GetAsync(d.CourseId,d.VersionId,Owner)).Value!;
        Assert.Equal(video.Id,current.Sections[0].Lessons[0].PrimaryVideoMediaAssetId);
        Assert.Contains(current.Media,x=>x.Id==video.Id && x.LessonId==current.Sections[0].Lessons[0].Id);
        Assert.Contains(current.Media,x=>x.Id==file.Id && x.TaskId==current.Tasks[0].Id);
        Assert.NotEqual(old.Tasks[0].Id,current.Tasks[0].Id);Assert.Equal(old.Version.CoverMediaAssetId,current.Version.CoverMediaAssetId);
        Assert.Equal(2,await db.LessonAttachments.CountAsync());Assert.Equal(2,await db.TaskAttachments.CountAsync());
        Assert.Equal("immutable",(await db.MediaAssets.SingleAsync(x=>x.Id==video.Id)).ContentHash);
    }
    [Fact] public async Task Primary_video_is_reviewable_without_a_duplicate_attachment_and_only_in_its_version()
    {
        await using var db=Context();var d=await Seed(db);var lesson=await db.Lessons.SingleAsync();
        var video=new MediaAsset { OwnerUserId=Owner.UserId,MediaType="video",MimeType="video/mp4",SizeBytes=100,
            StorageKey="primary-review-video",ContentHash="primary-review-video",OriginalFileName="lesson.mp4" };
        db.MediaAssets.Add(video);lesson.ContentType="video";lesson.PrimaryVideoMediaAssetId=video.Id;await db.SaveChangesAsync();
        var service=new CourseReviewService(db,new Store());
        // Represent an imported submitted snapshot with primary media stored separately.
        var version=await db.CourseVersions.SingleAsync();version.ReviewStatus="pending";version.SubmittedAt=DateTimeOffset.UtcNow;await db.SaveChangesAsync();
        var snapshot=(await service.GetAsync(d.CourseId,d.VersionId,Reviewer)).Value!;
        var media=Assert.Single(snapshot.Media,x=>x.LessonId==lesson.Id);Assert.Equal(video.Id,media.Id);
        Assert.Equal(ServiceFailure.None,(await service.OpenMediaAsync(d.CourseId,d.VersionId,video.Id,Reviewer)).Failure);
        Assert.Equal(ServiceFailure.Forbidden,(await service.OpenMediaAsync(d.CourseId,d.VersionId,video.Id,new("outsider",false,false,true))).Failure);
        db.LessonAttachments.Add(new(){LessonId=lesson.Id,MediaAssetId=video.Id,DisplayName="Same video"});await db.SaveChangesAsync();
        snapshot=(await service.GetAsync(d.CourseId,d.VersionId,Reviewer)).Value!;
        Assert.Single(snapshot.Media,x=>x.LessonId==lesson.Id&&x.Id==video.Id);
    }
    [Fact] public async Task Stale_pending_version_does_not_offer_review_actions()
    {
        await using var db=Context();var d=await Seed(db);var service=new CourseReviewService(db,new Store());
        await service.SubmitAsync(d.CourseId,Owner,new(d.VersionId));
        var course=await db.Courses.SingleAsync();var newer=new CourseVersion {CourseId=d.CourseId,CategoryId=d.CategoryId,VersionNumber=2};
        db.CourseVersions.Add(newer);await db.SaveChangesAsync();course.DraftVersionId=newer.Id;await db.SaveChangesAsync();
        Assert.False((await service.GetAsync(d.CourseId,d.VersionId,Reviewer)).Value!.CanReview);
        Assert.Equal(ServiceFailure.Conflict,(await service.DecideAsync(d.CourseId,d.VersionId,Reviewer,new("approved",null))).Failure);
        Assert.Empty(await db.CourseReviewDecisions.ToListAsync());
    }

}
