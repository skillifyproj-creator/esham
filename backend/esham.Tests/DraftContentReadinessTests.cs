using esham.BLL.DTOs;
using esham.BLL.DTOs.Courses;
using esham.BLL.Services;
using esham.DAL.Data;
using esham.DAL.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Xunit;
namespace esham.Tests;

public sealed class DraftContentReadinessTests
{
    [Theory] [InlineData(0, false)] [InlineData(1, true)] [InlineData(2, true)] [InlineData(3, true)] [InlineData(4, false)]
    public async Task Submission_eligibility_checks_course_level_task_count_and_actual_metadata_without_publishing(int count, bool eligible)
    {
        await using var db = Context(); var d = await Seed(db);
        var category = new Category { NameAr = "تصنيف", NameEn = "Category", IsActive = true };
        var cover = new MediaAsset { OwnerUserId = Owner.UserId, MediaType = "image", MimeType = "image/png", SizeBytes = 100, StorageKey = "cover", ContentHash = "cover" };
        d.Draft.CategoryId = category.Id; d.Draft.TitleAr = "عنوان الدورة"; d.Draft.DescriptionAr = "وصف تعليمي كامل للدورة التجريبية";
        d.Draft.Objectives = [new("هدف الدورة", null)]; d.Draft.CoverMediaAssetId = cover.Id;
        db.AddRange(category, cover);
        for (var i = 0; i < count; i++) db.CourseTasks.Add(new CourseTask { CourseVersionId = d.Draft.Id, TitleEn = "Task", DescriptionEn = "Description",
            Instructions = new(null, "Instructions"), Requirements = [new(null, "Assessment")], IsReady = true });
        await db.SaveChangesAsync();
        var result = (await new CourseSubmissionEligibilityService(db).GetAsync(d.Course.Id, Owner)).Value!;
        Assert.Equal(eligible, result.ContentEligible); Assert.Equal(count, result.ReadyTaskCount);
        Assert.False(result.SubmissionImplemented); Assert.False(result.CanSubmit);
        Assert.Null((await db.Courses.AsNoTracking().SingleAsync()).PublishedVersionId);
        Assert.Equal("draft", (await db.CourseVersions.AsNoTracking().SingleAsync()).ReviewStatus);
    }
    [Fact] public async Task Missing_cover_and_course_objectives_are_reported_even_with_ready_lesson_and_one_complete_task()
    {
        await using var db = Context(); var d = await Seed(db);
        var category = new Category { NameAr = "تصنيف", NameEn = "Category", IsActive = true };
        d.Draft.CategoryId = category.Id; d.Draft.TitleEn = "Course"; d.Draft.DescriptionEn = "A complete description for this course";
        db.Categories.Add(category); db.CourseTasks.Add(new CourseTask { CourseVersionId = d.Draft.Id, TitleEn = "Task", DescriptionEn = "Description",
            Instructions = new(null, "Instructions"), Requirements = [new(null, "Assessment")], IsReady = true }); await db.SaveChangesAsync();
        var service = new CourseSubmissionEligibilityService(db);
        var result = (await service.GetAsync(d.Course.Id, Owner)).Value!;
        Assert.Equal(new[] { "cover", "objectives" }, result.Checks.Where(x => !x.IsMet).Select(x => x.Code).ToArray());
        Assert.Equal(1, result.TaskCount); Assert.Equal(1, result.ReadyTaskCount); Assert.False(result.ContentEligible);
        Assert.Equal(ServiceFailure.Forbidden, (await service.GetAsync(d.Course.Id, new("stranger", true, false))).Failure);
        var task = await db.CourseTasks.SingleAsync(); task.Requirements = []; await db.SaveChangesAsync();
        result = (await service.GetAsync(d.Course.Id, Owner)).Value!;
        Assert.False(result.Checks.Single(x => x.Code == "task-readiness").IsMet); Assert.Equal(0, result.ReadyTaskCount);
    }
    private static readonly CourseActor Owner = new("owner", true, false);
    private static LessonRequest Article() => new("عنوان الدرس", null, 0, DescriptionAr: "محتوى مقال تعليمي مكتمل ومحفوظ", ContentType: "article",
        DurationSeconds: 600, Objectives: [new("هدف تعليمي", null)]);
    [Fact] public void Arabic_only_content_is_ready_independent_of_selected_ui_language_or_legacy_status()
    {
        var ready = DraftContentReadiness.Lesson(Article(), false);
        Assert.True(ready.IsReady); Assert.Equal(100, ready.Percentage);
        Assert.True(ready.TitleComplete && ready.ContentReady && ready.ObjectivesComplete && ready.DurationSet);
    }
    [Theory] [InlineData("title")] [InlineData("article")] [InlineData("objectives")] [InlineData("duration")]
    public void Each_actual_missing_requirement_remains_incomplete(string missing)
    {
        var request = Article();
        request = missing switch { "title" => request with { TitleAr = "x" }, "article" => request with { DescriptionAr = "short" },
            "objectives" => request with { Objectives = [] }, _ => request with { DurationSeconds = 0 } };
        var result = DraftContentReadiness.Lesson(request, false);
        Assert.False(result.IsReady); Assert.Equal(75, result.Percentage);
    }
    [Theory] [InlineData(59)] [InlineData(36001)] [InlineData(double.NaN)] [InlineData(double.PositiveInfinity)]
    public void Duration_bounds_are_not_weakened(double seconds) => Assert.False(DraftContentReadiness.Lesson(Article() with { DurationSeconds = seconds }, false).DurationSet);

    private static AppDbContext Context() => new(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString())
        .ReplaceService<IDbContextTransactionManager, TestTransactionManager>().Options);
    private static async Task<(Course Course, CourseVersion Draft, CourseSection Section, Lesson Lesson, MediaAsset Asset)> Seed(AppDbContext db)
    {
        var course = new Course { OwnerUserId = Owner.UserId };
        var draft = new CourseVersion { CourseId = course.Id }; course.DraftVersionId = draft.Id;
        var section = new CourseSection { CourseVersionId = draft.Id, TitleAr = "قسم" };
        var asset = new MediaAsset { OwnerUserId = Owner.UserId, MediaType = "video", MimeType = "video/webm", SizeBytes = 42, StorageKey = "stored-video", ContentHash = "hash" };
        var lesson = new Lesson { CourseSectionId = section.Id, TitleAr = "درس محفوظ", DescriptionAr = "وصف تعليمي محفوظ",
            Objectives = [new("هدف محفوظ", null)], DurationSeconds = 600, ContentType = "video", PrimaryVideoMediaAssetId = asset.Id };
        db.AddRange(course, draft, section, lesson, asset,
            new LessonAttachment { LessonId = lesson.Id, MediaAssetId = asset.Id, DisplayName = "video" });
        await db.SaveChangesAsync(); return (course, draft, section, lesson, asset);
    }
    [Fact] public async Task Persisted_video_preview_section_and_curriculum_share_one_policy_and_no_section_task_requirement()
    {
        await using var db = Context(); var d = await Seed(db); var service = new CurriculumService(db);
        var response = (await service.GetReadinessAsync(d.Course.Id, Owner)).Value!;
        Assert.Equal(d.Draft.Id, response.CourseVersionId); Assert.True(response.IsReady); Assert.Equal(100, response.Percentage);
        var section = Assert.Single(response.Sections); Assert.True(section.Readiness.IsReady); Assert.Equal(100, section.Readiness.Percentage);
        var lesson = Assert.Single(section.Lessons); Assert.Equal(d.Lesson.Id, lesson.Id); Assert.True(lesson.Readiness.IsReady);
        var metadata = new LessonRequest(lesson.TitleAr, lesson.TitleEn, lesson.SortOrder, lesson.DescriptionAr, lesson.DescriptionEn,
            lesson.ContentType, lesson.DurationSeconds, lesson.IsPreview, lesson.Objectives, lesson.PrimaryVideoMediaAssetId);
        Assert.Equal(lesson.Readiness, (await service.PreviewLessonReadinessAsync(d.Course.Id, d.Section.Id, Owner, new(d.Lesson.Id, metadata))).Value);
        Assert.Equal(lesson.Readiness, Assert.Single((await service.GetSectionsAsync(d.Course.Id, Owner)).Value!).Lessons.Single().Readiness);
        var incomplete = await service.PreviewLessonReadinessAsync(d.Course.Id, d.Section.Id, Owner, new(d.Lesson.Id, metadata with { Objectives = [] }));
        Assert.Equal(75, incomplete.Value!.Percentage); Assert.False(incomplete.Value.IsReady);
        Assert.True((await service.GetReadinessAsync(d.Course.Id, Owner)).Value!.IsReady); // Preview never writes metadata.
        Assert.Empty(await db.CourseTasks.ToListAsync()); // Course-level task readiness stays separate.
    }
    [Theory] [InlineData("missing-attachment")] [InlineData("foreign-owner")] [InlineData("missing-asset-pointer")] [InlineData("empty-file")]
    public async Task A_primary_id_alone_or_invalid_media_cannot_artificially_mark_video_ready(string invalid)
    {
        await using var db = Context(); var d = await Seed(db);
        if (invalid == "missing-attachment") db.LessonAttachments.Remove(await db.LessonAttachments.SingleAsync());
        else if (invalid == "foreign-owner") d.Asset.OwnerUserId = "stranger";
        else if (invalid == "missing-asset-pointer") d.Lesson.PrimaryVideoMediaAssetId = null;
        else d.Asset.SizeBytes = 0;
        await db.SaveChangesAsync(); var ready = (await new CurriculumService(db).GetReadinessAsync(d.Course.Id, Owner)).Value!;
        Assert.False(ready.IsReady); Assert.False(ready.Sections[0].Lessons[0].Readiness.ContentReady);
        Assert.False(ready.Sections[0].Readiness.IsReady);
    }
    [Fact] public async Task Readiness_preview_rejects_foreign_sections_and_wrong_owners_and_immutable_versions()
    {
        await using var db = Context(); var d = await Seed(db); var service = new CurriculumService(db);
        Assert.Equal(ServiceFailure.NotFound, (await service.PreviewLessonReadinessAsync(d.Course.Id, Guid.NewGuid(), Owner, new(d.Lesson.Id, Article()))).Failure);
        Assert.Equal(ServiceFailure.NotFound, (await service.PreviewLessonReadinessAsync(d.Course.Id, d.Section.Id, Owner, new(Guid.NewGuid(), Article()))).Failure);
        Assert.Equal(ServiceFailure.Forbidden, (await service.GetReadinessAsync(d.Course.Id, new("stranger", true, false))).Failure);
        Assert.Equal(ServiceFailure.Forbidden, (await service.PreviewLessonReadinessAsync(d.Course.Id, d.Section.Id, new("stranger", true, false), new(d.Lesson.Id, Article()))).Failure);
        var version = await db.CourseVersions.SingleAsync(); version.ReviewStatus = "approved"; await db.SaveChangesAsync();
        Assert.Equal(ServiceFailure.Conflict, (await service.GetReadinessAsync(d.Course.Id, Owner)).Failure);
        Assert.Equal(ServiceFailure.Conflict, (await service.PreviewLessonReadinessAsync(d.Course.Id, d.Section.Id, Owner, new(d.Lesson.Id, Article()))).Failure);
    }
    [Fact] public async Task Empty_sections_and_empty_curricula_are_not_ready()
    {
        await using var db = Context(); var d = await Seed(db);
        db.LessonAttachments.RemoveRange(db.LessonAttachments); db.Lessons.Remove(d.Lesson); await db.SaveChangesAsync();
        var service = new CurriculumService(db); Assert.False((await service.GetReadinessAsync(d.Course.Id, Owner)).Value!.IsReady);
        db.CourseSections.Remove(await db.CourseSections.SingleAsync()); await db.SaveChangesAsync();
        var empty = (await service.GetReadinessAsync(d.Course.Id, Owner)).Value!; Assert.False(empty.IsReady); Assert.Equal(0, empty.Percentage);
    }
}
