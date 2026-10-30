using esham.BLL.DTOs;
using esham.BLL.DTOs.Courses;
using esham.BLL.Services;
using esham.DAL.Data;
using esham.DAL.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Xunit;
namespace esham.Tests;

public sealed class CurriculumServiceTests
{
    [Fact] public async Task Default_section_is_persisted_once_and_existing_sections_are_preserved()
    {
        await using var db = Context(); var d = await Seed(db);
        db.Lessons.Remove(d.Lesson); db.CourseSections.Remove(d.Section); await db.SaveChangesAsync();
        var service = new CurriculumService(db);
        var first = (await service.EnsureDefaultSectionAsync(d.Course.Id, Owner)).Value!;
        var section = Assert.Single(first);
        Assert.Equal("قسم جديد", section.TitleAr); Assert.Equal("New Section", section.TitleEn);
        Assert.Equal(section.Id, Assert.Single((await service.EnsureDefaultSectionAsync(d.Course.Id, Owner)).Value!).Id);
        await service.SaveSectionAsync(d.Course.Id, section.Id, Owner, new(null, "Renamed", 0));
        Assert.Equal("Renamed", Assert.Single((await service.EnsureDefaultSectionAsync(d.Course.Id, Owner)).Value!).TitleEn);
        Assert.Single(await db.CourseSections.ToListAsync());
    }
    private static readonly CourseActor Owner = new("teacher", true, false);
    private static AppDbContext Context() => new(new DbContextOptionsBuilder<AppDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString()).ReplaceService<IDbContextTransactionManager, TestTransactionManager>().Options);
    private static async Task<(Course Course, CourseVersion Draft, CourseSection Section, Lesson Lesson)> Seed(AppDbContext db)
    {
        var course = new Course { OwnerUserId = Owner.UserId };
        var draft = new CourseVersion { CourseId = course.Id };
        course.DraftVersionId = draft.Id;
        var section = new CourseSection { CourseVersionId = draft.Id, TitleEn = "Section" };
        var lesson = new Lesson { CourseSectionId = section.Id, TitleEn = "Lesson" };
        db.AddRange(course, draft, section, lesson); await db.SaveChangesAsync();
        return (course, draft, section, lesson);
    }
    [Theory] [InlineData(false, "teacher")] [InlineData(true, "stranger")]
    public async Task Every_operation_requires_owner_instructor(bool instructor, string user)
    {
        await using var db = Context(); var d = await Seed(db); var s = new CurriculumService(db); var actor = new CourseActor(user, instructor, true);
        Assert.Equal(ServiceFailure.Forbidden, (await s.GetSectionsAsync(d.Course.Id, actor)).Failure);
        Assert.Equal(ServiceFailure.Forbidden, (await s.EnsureDefaultSectionAsync(d.Course.Id, actor)).Failure);
        Assert.Equal(ServiceFailure.Forbidden, (await s.GetLessonsAsync(d.Course.Id, d.Section.Id, actor)).Failure);
        Assert.Equal(ServiceFailure.Forbidden, (await s.SaveSectionAsync(d.Course.Id, null, actor, new(null, "New", 0))).Failure);
        Assert.Equal(ServiceFailure.Forbidden, (await s.SaveLessonAsync(d.Course.Id, d.Section.Id, null, actor, new(null, "New", 0))).Failure);
        Assert.Equal(ServiceFailure.Forbidden, (await s.DeleteSectionAsync(d.Course.Id, d.Section.Id, actor)).Failure);
        Assert.Equal(ServiceFailure.Forbidden, (await s.DeleteLessonAsync(d.Course.Id, d.Section.Id, d.Lesson.Id, actor)).Failure);
        Assert.Equal(ServiceFailure.Forbidden, (await s.ReorderAsync(d.Course.Id, null, actor, new([d.Section.Id]))).Failure);
    }
    [Theory] [InlineData("pending")] [InlineData("approved")] [InlineData("rejected")] [InlineData("changes_requested")]
    [InlineData("published-pointer")] [InlineData("no-draft")]
    public async Task Noneditable_versions_reject_reads_and_writes(string state)
    {
        await using var db = Context(); var d = await Seed(db);
        if (state == "published-pointer") d.Course.PublishedVersionId = d.Draft.Id;
        else if (state == "no-draft") d.Course.DraftVersionId = null;
        else d.Draft.ReviewStatus = state;
        await db.SaveChangesAsync(); var s = new CurriculumService(db);
        Assert.Equal(ServiceFailure.Conflict, (await s.GetSectionsAsync(d.Course.Id, Owner)).Failure);
        Assert.Equal(ServiceFailure.Conflict, (await s.EnsureDefaultSectionAsync(d.Course.Id, Owner)).Failure);
        Assert.Equal(ServiceFailure.Conflict, (await s.SaveSectionAsync(d.Course.Id, d.Section.Id, Owner, new(null, "Changed", 0))).Failure);
        Assert.Equal(ServiceFailure.Conflict, (await s.SaveLessonAsync(d.Course.Id, d.Section.Id, d.Lesson.Id, Owner, new(null, "Changed", 0))).Failure);
        Assert.Equal(ServiceFailure.Conflict, (await s.DeleteLessonAsync(d.Course.Id, d.Section.Id, d.Lesson.Id, Owner)).Failure);
        Assert.Equal(ServiceFailure.Conflict, (await s.DeleteSectionAsync(d.Course.Id, d.Section.Id, Owner)).Failure);
        Assert.Equal(ServiceFailure.Conflict, (await s.ReorderAsync(d.Course.Id, d.Section.Id, Owner, new([d.Lesson.Id]))).Failure);
    }
    [Theory] [InlineData(true)] [InlineData(false)]
    public async Task Historical_and_other_course_sections_cannot_be_accessed(bool historical)
    {
        await using var db = Context(); var d = await Seed(db);
        var version = new CourseVersion { CourseId = historical ? d.Course.Id : Guid.NewGuid(), VersionNumber = 2, ReviewStatus = "approved" };
        var foreign = new CourseSection { CourseVersionId = version.Id, TitleEn = "Historical" };
        var lesson = new Lesson { CourseSectionId = foreign.Id, TitleEn = "Historical lesson" };
        db.AddRange(version, foreign, lesson); await db.SaveChangesAsync(); var s = new CurriculumService(db);
        Assert.Equal(ServiceFailure.NotFound, (await s.SaveSectionAsync(d.Course.Id, foreign.Id, Owner, new(null, "Bad", 0))).Failure);
        Assert.Equal(ServiceFailure.NotFound, (await s.DeleteSectionAsync(d.Course.Id, foreign.Id, Owner)).Failure);
        Assert.Equal(ServiceFailure.NotFound, (await s.GetLessonsAsync(d.Course.Id, foreign.Id, Owner)).Failure);
        Assert.Equal(ServiceFailure.NotFound, (await s.SaveLessonAsync(d.Course.Id, foreign.Id, null, Owner, new(null, "Bad", 0))).Failure);
        Assert.Equal(ServiceFailure.NotFound, (await s.SaveLessonAsync(d.Course.Id, d.Section.Id, lesson.Id, Owner, new(null, "Bad", 0))).Failure);
        Assert.Equal(ServiceFailure.NotFound, (await s.DeleteLessonAsync(d.Course.Id, d.Section.Id, lesson.Id, Owner)).Failure);
        Assert.Equal(ServiceFailure.Validation, (await s.ReorderAsync(d.Course.Id, null, Owner, new([foreign.Id]))).Failure);
        Assert.Equal("Historical", (await db.CourseSections.AsNoTracking().SingleAsync(x => x.Id == foreign.Id)).TitleEn);
    }
    [Theory] [InlineData(null, null, 0)] [InlineData(" ", " ", 0)] [InlineData(null, "Valid", -1)]
    public async Task Titles_and_order_are_validated(string? ar, string? en, int order)
    {
        await using var db = Context(); var d = await Seed(db); var s = new CurriculumService(db);
        Assert.Equal(ServiceFailure.Validation, (await s.SaveSectionAsync(d.Course.Id, null, Owner, new(ar, en, order))).Failure);
        Assert.Equal(ServiceFailure.Validation, (await s.SaveLessonAsync(d.Course.Id, d.Section.Id, null, Owner, new(ar, en, order))).Failure);
        Assert.Equal(ServiceFailure.Validation, (await s.SaveSectionAsync(d.Course.Id, null, Owner, new(null, new string('x', 201), 0))).Failure);
    }
    [Fact] public async Task Lesson_metadata_and_media_are_validated()
    {
        await using var db = Context(); var d = await Seed(db); var s = new CurriculumService(db);
        var request = new LessonRequest(null, "Valid", 0);
        foreach (var invalid in new[] { request with { DurationSeconds = -1 }, request with { ContentType = "unknown" },
            request with { Objectives = [new(null, null)] }, request with { PrimaryVideoMediaAssetId = Guid.NewGuid() },
            request with { DescriptionEn = new string('x', 10001) } })
            Assert.Equal(ServiceFailure.Validation, (await s.SaveLessonAsync(d.Course.Id, d.Section.Id, null, Owner, invalid)).Failure);
    }
    [Fact] public async Task Switching_content_type_preserves_text_objectives_and_owned_video_association()
    {
        await using var db = Context(); var d = await Seed(db);
        var asset = new MediaAsset { OwnerUserId = Owner.UserId, MediaType = "video", MimeType = "video/mp4" };
        db.MediaAssets.Add(asset); await db.SaveChangesAsync();
        db.LessonAttachments.Add(new LessonAttachment { LessonId = d.Lesson.Id, MediaAssetId = asset.Id, DisplayName = "Owned video" });
        await db.SaveChangesAsync();
        var service = new CurriculumService(db);
        var request = new LessonRequest(null, "Lesson", 0, DescriptionEn: "Persisted article content", ContentType: "video",
            DurationSeconds: 600, Objectives: [new(null, "Objective")], PrimaryVideoMediaAssetId: asset.Id);
        Assert.Equal(ServiceFailure.None, (await service.SaveLessonAsync(d.Course.Id, d.Section.Id, d.Lesson.Id, Owner, request)).Failure);
        Assert.Equal(ServiceFailure.None, (await service.SaveLessonAsync(d.Course.Id, d.Section.Id, d.Lesson.Id, Owner, request with { ContentType = "article" })).Failure);
        var saved = Assert.Single((await service.GetLessonsAsync(d.Course.Id, d.Section.Id, Owner)).Value!);
        Assert.Equal("article", saved.ContentType); Assert.Equal(asset.Id, saved.PrimaryVideoMediaAssetId);
        Assert.Equal("Persisted article content", saved.DescriptionEn); Assert.Equal("Objective", Assert.Single(saved.Objectives).En);
    }
    [Fact] public async Task Approved_timestamp_cannot_be_bypassed_with_a_draft_status()
    {
        await using var db = Context(); var d = await Seed(db);
        d.Draft.ApprovedAt = DateTimeOffset.UtcNow; await db.SaveChangesAsync();
        Assert.Equal(ServiceFailure.Conflict, (await new CurriculumService(db).SaveSectionAsync(d.Course.Id, d.Section.Id, Owner, new(null, "Changed", 0))).Failure);
    }
    [Fact] public async Task Lessons_cannot_be_updated_or_deleted_through_another_section_of_the_same_draft()
    {
        await using var db = Context(); var d = await Seed(db); var s = new CurriculumService(db);
        var second = (await s.SaveSectionAsync(d.Course.Id, null, Owner, new(null, "Second", 1))).Value!;
        Assert.Equal(ServiceFailure.NotFound, (await s.SaveLessonAsync(d.Course.Id, second.Id, d.Lesson.Id, Owner, new(null, "Bad", 0))).Failure);
        Assert.Equal(ServiceFailure.NotFound, (await s.DeleteLessonAsync(d.Course.Id, second.Id, d.Lesson.Id, Owner)).Failure);
        Assert.Equal("Lesson", (await db.Lessons.AsNoTracking().SingleAsync()).TitleEn);
    }
    [Fact] public async Task Create_update_reorder_and_reload_preserve_localized_metadata()
    {
        await using var db = Context(); var d = await Seed(db); var s = new CurriculumService(db);
        var second = (await s.SaveSectionAsync(d.Course.Id, null, Owner, new("قسم", "Second", 1))).Value!;
        var lesson = (await s.SaveLessonAsync(d.Course.Id, d.Section.Id, null, Owner,
            new("درس", "Second lesson", 1, ContentType: "article", DescriptionEn: "Text", Objectives: [new("هدف", "Goal")]))).Value!;
        Assert.Equal(ServiceFailure.None, (await s.SaveSectionAsync(d.Course.Id, second.Id, Owner, new("قسم", "Edited", 1))).Failure);
        Assert.Equal(ServiceFailure.None, (await s.SaveLessonAsync(d.Course.Id, d.Section.Id, lesson.Id, Owner, new("درس", "Edited lesson", 1))).Failure);
        Assert.Equal(ServiceFailure.None, (await s.ReorderAsync(d.Course.Id, null, Owner, new([second.Id, d.Section.Id]))).Failure);
        Assert.Equal(ServiceFailure.None, (await s.ReorderAsync(d.Course.Id, d.Section.Id, Owner, new([lesson.Id, d.Lesson.Id]))).Failure);
        var sections = (await s.GetSectionsAsync(d.Course.Id, Owner)).Value!;
        Assert.Equal(second.Id, sections[0].Id); Assert.Equal("Edited", sections[0].TitleEn);
        Assert.Equal(lesson.Id, sections[1].Lessons[0].Id); Assert.Equal("درس", sections[1].Lessons[0].TitleAr);
        Assert.Equal(new[] { 0, 1 }, sections.Select(x => x.SortOrder));
    }
    [Fact] public async Task Reorder_rejects_missing_duplicate_and_foreign_ids_atomically()
    {
        await using var db = Context(); var d = await Seed(db); var s = new CurriculumService(db);
        var second = (await s.SaveSectionAsync(d.Course.Id, null, Owner, new(null, "Second", 1))).Value!;
        foreach (var ids in new List<Guid>?[] { null, [], [d.Section.Id], [d.Section.Id, d.Section.Id], [d.Section.Id, Guid.NewGuid()] })
            Assert.Equal(ServiceFailure.Validation, (await s.ReorderAsync(d.Course.Id, null, Owner, new(ids))).Failure);
        Assert.Equal(ServiceFailure.Validation, (await s.ReorderAsync(d.Course.Id, d.Section.Id, Owner, new([Guid.NewGuid()]))).Failure);
        Assert.Equal(1, (await db.CourseSections.AsNoTracking().SingleAsync(x => x.Id == second.Id)).SortOrder);
    }
    [Theory] [InlineData("attachment")] [InlineData("progress")] [InlineData("report")]
    public async Task Delete_protects_lesson_dependencies(string dependency)
    {
        await using var db = Context(); var d = await Seed(db);
        if (dependency == "attachment") db.LessonAttachments.Add(new() { LessonId = d.Lesson.Id, MediaAssetId = Guid.NewGuid() });
        if (dependency == "progress") db.LessonProgressRecords.Add(new() { LessonId = d.Lesson.Id, EnrollmentId = Guid.NewGuid() });
        if (dependency == "report") db.CourseReports.Add(new() { LessonId = d.Lesson.Id, CourseId = d.Course.Id, CourseVersionId = d.Draft.Id });
        await db.SaveChangesAsync(); var s = new CurriculumService(db);
        Assert.Equal(ServiceFailure.Conflict, (await s.DeleteLessonAsync(d.Course.Id, d.Section.Id, d.Lesson.Id, Owner)).Failure);
        Assert.Single(await db.Lessons.ToListAsync());
    }
    [Fact] public async Task Delete_requires_empty_section_and_never_deletes_tasks_or_media()
    {
        await using var db = Context(); var d = await Seed(db); var s = new CurriculumService(db);
        Assert.Equal(ServiceFailure.Conflict, (await s.DeleteSectionAsync(d.Course.Id, d.Section.Id, Owner)).Failure);
        var media = new MediaAsset { OwnerUserId = Owner.UserId, StorageKey = "video", MimeType = "video/mp4", MediaType = "video" };
        db.MediaAssets.Add(media);
        (await db.Lessons.SingleAsync()).PrimaryVideoMediaAssetId = media.Id; await db.SaveChangesAsync();
        Assert.Equal(ServiceFailure.None, (await s.DeleteLessonAsync(d.Course.Id, d.Section.Id, d.Lesson.Id, Owner)).Failure);
        Assert.Single(await db.MediaAssets.ToListAsync());
        var task = new CourseTask { CourseVersionId = d.Draft.Id, DisplaySectionId = d.Section.Id };
        db.CourseTasks.Add(task); await db.SaveChangesAsync();
        Assert.Equal(ServiceFailure.Conflict, (await s.DeleteSectionAsync(d.Course.Id, d.Section.Id, Owner)).Failure);
        var trackedTask = await db.CourseTasks.SingleAsync(); trackedTask.DisplaySectionId = null; await db.SaveChangesAsync();
        Assert.Equal(ServiceFailure.None, (await s.DeleteSectionAsync(d.Course.Id, d.Section.Id, Owner)).Failure);
        Assert.Single(await db.CourseTasks.ToListAsync()); Assert.Empty((await s.GetSectionsAsync(d.Course.Id, Owner)).Value!);
    }
}
