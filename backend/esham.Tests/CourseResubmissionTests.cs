using Microsoft.Extensions.DependencyInjection;
using esham.BLL.DTOs;
using esham.BLL.Services;
using esham.DAL.Data;
using esham.DAL.Entities;
using Microsoft.EntityFrameworkCore;
using Xunit;
using static esham.Tests.CourseReviewWorkflowTests;

namespace esham.Tests;
public sealed class CourseResubmissionTests
{
    private static readonly CourseActor Owner = new("owner",true,false), Reviewer = new("reviewer",false,false,true);
    private static async Task<(Guid Course, Guid Reviewed, Guid Draft)> Revision(AppDbContext db)
    {
        var d=await Seed(db);var s=new CourseReviewService(db,new Store());
        Assert.Equal(ServiceFailure.None,(await s.SubmitAsync(d.CourseId,Owner,new(d.VersionId))).Failure);
        await s.DecideAsync(d.CourseId,d.VersionId,Reviewer,new("changes_requested","Improve the explanation"));
        var draft=(await s.ReviseAsync(d.CourseId,Owner,new(d.VersionId))).Value;
        return(d.CourseId,d.VersionId,draft);
    }
    [AccountSqlServerFact] public async Task Sql_comparison_survives_new_scope_and_serializes_with_content_edits()
    {
        using var provider=AccountFinalizationSqlServerTests.DatabaseServices();(Guid Course,Guid Reviewed,Guid Draft) d;
        using(var setup=provider.CreateScope())d=await Revision(setup.ServiceProvider.GetRequiredService<AppDbContext>());
        using(var fresh=provider.CreateScope()) {
            var db=fresh.ServiceProvider.GetRequiredService<AppDbContext>();
            Assert.Equal(ServiceFailure.Validation,(await new CourseReviewService(db,new Store()).SubmitAsync(d.Course,Owner,new(d.Draft))).Failure);
        }
        using var edit=provider.CreateScope();var editing=edit.ServiceProvider.GetRequiredService<AppDbContext>();
        await editing.Database.CreateExecutionStrategy().ExecuteAsync(async () => {
        await using var tx=await editing.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
        await editing.Courses.FromSqlInterpolated($"SELECT * FROM [Courses] WITH (UPDLOCK,HOLDLOCK) WHERE [Id]={d.Course}").SingleAsync();
        var v=await editing.CourseVersions.SingleAsync(x=>x.Id==d.Draft);v.TitleEn="Concurrent meaningful update";
        async Task<ServiceFailure> Submit() {using var scope=provider.CreateScope();var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();return(await new CourseReviewService(db,new Store()).SubmitAsync(d.Course,Owner,new(d.Draft))).Failure;}
        var submission=Submit();await editing.SaveChangesAsync();await tx.CommitAsync();
        Assert.Equal(ServiceFailure.None,await submission);
        });
        using var check=provider.CreateScope();var verify=check.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal("pending",(await verify.CourseVersions.SingleAsync(x=>x.Id==d.Draft)).ReviewStatus);
        Assert.Equal("Improve the explanation",(await verify.CourseReviewDecisions.SingleAsync(x=>x.CourseVersionId==d.Reviewed)).Comment);
    }

    [Theory] [InlineData("none")] [InlineData("save")] [InlineData("metadata")] [InlineData("revert")] [InlineData("whitespace")]
    public async Task Unchanged_final_content_is_rejected_and_feedback_preserved(string edit)
    {
        await using var db=Context();var d=await Revision(db);var s=new CourseReviewService(db,new Store());
        var v=await db.CourseVersions.SingleAsync(x=>x.Id==d.Draft);
        if(edit=="save") await new CourseService(db).UpdateDraftAsync(d.Course,Owner,new(){TitleEn=v.TitleEn});
        if(edit=="revert") {var title=v.TitleEn;await new CourseService(db).UpdateDraftAsync(d.Course,Owner,new(){TitleEn="Changed temporarily"});await new CourseService(db).UpdateDraftAsync(d.Course,Owner,new(){TitleEn=title});}
        if(edit=="metadata") {v.UpdatedAt=DateTimeOffset.UtcNow.AddDays(1);v.VersionNumber+=5;var lesson=await db.Lessons.SingleAsync(x=>x.CourseSection.CourseVersionId==d.Draft);lesson.UpdatedAt=DateTimeOffset.UtcNow.AddDays(1);await db.SaveChangesAsync();}
        if(edit=="whitespace") {v.TitleEn="  "+v.TitleEn+"  ";await db.SaveChangesAsync();}
        var result=await s.SubmitAsync(d.Course,Owner,new(d.Draft));Assert.Equal(ServiceFailure.Validation,result.Failure);
        Assert.Equal("course_resubmission_unchanged",result.Code);
        Assert.Contains("You must make an actual change to the course before resubmitting it for review.",result.Message);
        Assert.Contains("يجب إجراء تعديل فعلي على الدورة قبل إعادة إرسالها للمراجعة.",result.Message);
        Assert.Equal("draft",(await db.CourseVersions.AsNoTracking().SingleAsync(x=>x.Id==d.Draft)).ReviewStatus);
        Assert.Equal("Improve the explanation",(await db.CourseReviewDecisions.SingleAsync()).Comment);
        Assert.Equal("changes_requested",(await db.CourseVersions.AsNoTracking().SingleAsync(x=>x.Id==d.Reviewed)).ReviewStatus);
    }
    [Theory] [InlineData("details")] [InlineData("section")] [InlineData("lesson")] [InlineData("task")] [InlineData("attachment")]
    public async Task Meaningful_edits_on_the_same_draft_id_allow_submission(string edit)
    {
        await using var db=Context();var d=await Revision(db);var s=new CourseReviewService(db,new Store());
        var v=await db.CourseVersions.SingleAsync(x=>x.Id==d.Draft);var section=await db.CourseSections.Include(x=>x.Lessons).SingleAsync(x=>x.CourseVersionId==d.Draft);
        if(edit=="details")v.DescriptionEn+=" Additional explanation.";
        if(edit=="section")section.TitleEn="Improved section";
        if(edit=="lesson")section.Lessons.Single().DescriptionEn+=" Additional explanation.";
        if(edit=="task")(await db.CourseTasks.SingleAsync(x=>x.CourseVersionId==d.Draft)).TitleEn="Improved task";
        if(edit=="attachment")db.LessonAttachments.Add(new(){LessonId=section.Lessons.Single().Id,MediaAssetId=v.CoverMediaAssetId!.Value,DisplayName="Additional illustration"});
        await db.SaveChangesAsync();Assert.Equal(ServiceFailure.None,(await s.SubmitAsync(d.Course,Owner,new(d.Draft))).Failure);
        Assert.Equal("pending",(await db.CourseVersions.AsNoTracking().SingleAsync(x=>x.Id==d.Draft)).ReviewStatus);
        Assert.Single(await db.CourseReviewDecisions.ToListAsync());
    }
    [Fact] public async Task Actual_video_bytes_are_detected_but_identical_reuploads_do_not_bypass_validation()
    {
        await using var db=Context();var d=await Revision(db);var s=new CourseReviewService(db,new Store());
        var reviewed=await db.Lessons.SingleAsync(x=>x.CourseSection.CourseVersionId==d.Reviewed);var draft=await db.Lessons.SingleAsync(x=>x.CourseSection.CourseVersionId==d.Draft);
        var original=new MediaAsset{OwnerUserId=Owner.UserId,MediaType="video",MimeType="video/mp4",StorageKey="original",ContentHash="original-bytes",SizeBytes=50};
        var same=new MediaAsset{OwnerUserId=Owner.UserId,MediaType="video",MimeType="video/mp4",StorageKey="reupload",ContentHash="original-bytes",SizeBytes=50};
        db.MediaAssets.AddRange(original,same);reviewed.PrimaryVideoMediaAssetId=original.Id;draft.PrimaryVideoMediaAssetId=same.Id;await db.SaveChangesAsync();
        Assert.Equal(ServiceFailure.Validation,(await s.SubmitAsync(d.Course,Owner,new(d.Draft))).Failure);
        var replacement=new MediaAsset{OwnerUserId=Owner.UserId,MediaType="video",MimeType="video/mp4",StorageKey="replacement",ContentHash="replacement-bytes",SizeBytes=60};
        db.MediaAssets.Add(replacement);(await db.Lessons.SingleAsync(x=>x.Id==draft.Id)).PrimaryVideoMediaAssetId=replacement.Id;await db.SaveChangesAsync();
        Assert.Equal(ServiceFailure.None,(await s.SubmitAsync(d.Course,Owner,new(d.Draft))).Failure);
    }
    [Fact] public async Task Meaningful_change_does_not_bypass_readiness_or_authorization()
    {
        await using var db=Context();var d=await Revision(db);var s=new CourseReviewService(db,new Store());
        var v=await db.CourseVersions.SingleAsync(x=>x.Id==d.Draft);v.TitleEn="Changed title";v.Objectives=[];await db.SaveChangesAsync();
        Assert.Equal(ServiceFailure.Forbidden,(await s.SubmitAsync(d.Course,new("outsider",true,false),new(d.Draft))).Failure);
        var result=await s.SubmitAsync(d.Course,Owner,new(d.Draft));Assert.Equal(ServiceFailure.Validation,result.Failure);Assert.Contains("objectives",result.Message);
    }
}

