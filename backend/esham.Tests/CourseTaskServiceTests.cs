using esham.BLL.DTOs;
using esham.BLL.DTOs.Courses;
using esham.BLL.Services;
using esham.DAL.Data;
using esham.DAL.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Xunit;
namespace esham.Tests;

public sealed class CourseTaskServiceTests
{
    private static readonly CourseActor Owner = new("teacher", true, false);
    private static AppDbContext Context() => new(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString())
        .ReplaceService<IDbContextTransactionManager, TestTransactionManager>().Options);
    private static CourseTaskRequest Request(string title = "Task", Guid? section = null) => new(null, title, 0,
        DescriptionEn: "Build a practical example", Instructions: new(null, "Follow the steps"), Requirements: [new(null, "Correct result")], DisplaySectionId: section);
    private static async Task<(Course Course, CourseVersion Draft, CourseSection Section)> Seed(AppDbContext db)
    {
        var course = new Course { OwnerUserId = Owner.UserId }; var draft = new CourseVersion { CourseId = course.Id };
        var section = new CourseSection { CourseVersionId = draft.Id, TitleEn = "Placement" }; course.DraftVersionId = draft.Id;
        db.AddRange(course, draft, section); await db.SaveChangesAsync(); return (course, draft, section);
    }
    [Theory] [InlineData(false, "teacher")] [InlineData(true, "stranger")]
    public async Task All_operations_require_owner_instructor(bool instructor, string user)
    {
        await using var db = Context(); var d = await Seed(db); var s = new CourseTaskService(db); var actor = new CourseActor(user, instructor, true);
        Assert.Equal(ServiceFailure.Forbidden, (await s.GetAllAsync(d.Course.Id, actor)).Failure);
        Assert.Equal(ServiceFailure.Forbidden, (await s.GetAsync(d.Course.Id, Guid.NewGuid(), actor)).Failure);
        Assert.Equal(ServiceFailure.Forbidden, (await s.SaveAsync(d.Course.Id, null, actor, Request())).Failure);
        Assert.Equal(ServiceFailure.Forbidden, (await s.DeleteAsync(d.Course.Id, Guid.NewGuid(), actor)).Failure);
        Assert.Equal(ServiceFailure.Forbidden, (await s.ReorderAsync(d.Course.Id, actor, new([]))).Failure);
        Assert.Equal(ServiceFailure.Forbidden, (await s.GetReadinessAsync(d.Course.Id, actor)).Failure);
    }
    [Theory] [InlineData("pending")] [InlineData("approved")] [InlineData("rejected")] [InlineData("changes_requested")]
    [InlineData("no-draft")] [InlineData("published-pointer")] [InlineData("approval-time")]
    public async Task Immutable_or_missing_drafts_reject_every_operation(string state)
    {
        await using var db = Context(); var d = await Seed(db);
        if (state == "no-draft") d.Course.DraftVersionId = null;
        else if (state == "published-pointer") d.Course.PublishedVersionId = d.Draft.Id;
        else if (state == "approval-time") d.Draft.ApprovedAt = DateTimeOffset.UtcNow;
        else d.Draft.ReviewStatus = state;
        await db.SaveChangesAsync(); var s = new CourseTaskService(db);
        Assert.Equal(ServiceFailure.Conflict, (await s.GetAllAsync(d.Course.Id, Owner)).Failure);
        Assert.Equal(ServiceFailure.Conflict, (await s.GetAsync(d.Course.Id, Guid.NewGuid(), Owner)).Failure);
        Assert.Equal(ServiceFailure.Conflict, (await s.SaveAsync(d.Course.Id, null, Owner, Request())).Failure);
        Assert.Equal(ServiceFailure.Conflict, (await s.DeleteAsync(d.Course.Id, Guid.NewGuid(), Owner)).Failure);
        Assert.Equal(ServiceFailure.Conflict, (await s.ReorderAsync(d.Course.Id, Owner, new([]))).Failure);
        Assert.Equal(ServiceFailure.Conflict, (await s.GetReadinessAsync(d.Course.Id, Owner)).Failure);
    }
    [Fact] public async Task Create_edit_assign_unassign_reorder_and_delete_preserve_version_and_localization()
    {
        await using var db = Context(); var d = await Seed(db); var s = new CourseTaskService(db);
        var a = (await s.SaveAsync(d.Course.Id, null, Owner, Request(section: d.Section.Id) with { TitleAr = "مهمة", IsReady = true })).Value!;
        var b = (await s.SaveAsync(d.Course.Id, null, Owner, Request("Second") with { SortOrder = 1 })).Value!;
        Assert.Equal(d.Draft.Id, a.CourseVersionId); Assert.Equal(d.Section.Id, a.DisplaySectionId);
        Assert.Equal(ServiceFailure.None, (await s.SaveAsync(d.Course.Id, a.Id, Owner, Request("Edited") with { TitleAr = "مهمة" })).Failure);
        var fresh = (await s.GetAsync(d.Course.Id, a.Id, Owner)).Value!;
        Assert.Null(fresh.DisplaySectionId); Assert.Equal("مهمة", fresh.TitleAr); Assert.Equal("Edited", fresh.TitleEn);
        Assert.Equal("Follow the steps", fresh.Instructions!.En); Assert.Single(fresh.Requirements);
        Assert.Equal(ServiceFailure.None, (await s.ReorderAsync(d.Course.Id, Owner, new([b.Id, a.Id]))).Failure);
        Assert.Equal(new[] { b.Id, a.Id }, (await s.GetAllAsync(d.Course.Id, Owner)).Value!.Select(x => x.Id));
        Assert.Equal(ServiceFailure.None, (await s.DeleteAsync(d.Course.Id, a.Id, Owner)).Failure);
        Assert.Equal(ServiceFailure.None, (await s.DeleteAsync(d.Course.Id, b.Id, Owner)).Failure);
        Assert.Empty((await s.GetAllAsync(d.Course.Id, Owner)).Value!); Assert.Single(await db.CourseSections.ToListAsync());
    }
    [Theory] [InlineData(true)] [InlineData(false)]
    public async Task Cross_version_and_cross_course_tasks_and_placement_are_rejected(bool historical)
    {
        await using var db = Context(); var d = await Seed(db);
        var v = new CourseVersion { CourseId = historical ? d.Course.Id : Guid.NewGuid(), ReviewStatus = "approved", VersionNumber = 2 };
        var section = new CourseSection { CourseVersionId = v.Id }; var task = new CourseTask { CourseVersionId = v.Id, TitleEn = "Historical" };
        db.AddRange(v, section, task); await db.SaveChangesAsync(); var s = new CourseTaskService(db);
        Assert.Equal(ServiceFailure.NotFound, (await s.GetAsync(d.Course.Id, task.Id, Owner)).Failure);
        Assert.Equal(ServiceFailure.NotFound, (await s.SaveAsync(d.Course.Id, task.Id, Owner, Request())).Failure);
        Assert.Equal(ServiceFailure.NotFound, (await s.DeleteAsync(d.Course.Id, task.Id, Owner)).Failure);
        Assert.Equal(ServiceFailure.Validation, (await s.SaveAsync(d.Course.Id, null, Owner, Request(section: section.Id))).Failure);
        Assert.Equal(ServiceFailure.Validation, (await s.ReorderAsync(d.Course.Id, Owner, new([task.Id]))).Failure);
        Assert.Equal("Historical", (await db.CourseTasks.AsNoTracking().SingleAsync()).TitleEn);
    }
    [Fact] public async Task Invalid_fields_and_unknown_placement_are_rejected_without_writes()
    {
        await using var db = Context(); var d = await Seed(db); var s = new CourseTaskService(db);
        foreach (var request in new[] { Request(" "), Request(new string('x', 201)), Request() with { SortOrder = -1 },
            Request(section: Guid.NewGuid()), Request() with { DescriptionEn = new string('x', 10001) },
            Request() with { Instructions = new(null, new string('x', 10001)) }, Request() with { Requirements = [new(null, " ")] },
            Request() with { Requirements = [new(null, new string('x', 2001))] }, Request() with { IsReady = true, Instructions = null } })
            Assert.Equal(ServiceFailure.Validation, (await s.SaveAsync(d.Course.Id, null, Owner, request)).Failure);
        Assert.Empty((await s.GetAllAsync(d.Course.Id, Owner)).Value!);
    }
    [Fact] public async Task Reorder_requires_exact_complete_set_and_keeps_other_values()
    {
        await using var db = Context(); var d = await Seed(db); var s = new CourseTaskService(db);
        var a = (await s.SaveAsync(d.Course.Id, null, Owner, Request())).Value!;
        var b = (await s.SaveAsync(d.Course.Id, null, Owner, Request("Second") with { SortOrder = 1 })).Value!;
        foreach (var ids in new List<Guid>?[] { null, [], [a.Id], [a.Id, a.Id], [a.Id, Guid.NewGuid()] })
            Assert.Equal(ServiceFailure.Validation, (await s.ReorderAsync(d.Course.Id, Owner, new(ids))).Failure);
        Assert.Equal(1, (await s.GetAsync(d.Course.Id, b.Id, Owner)).Value!.SortOrder);
    }
    [Theory] [InlineData(0, false)] [InlineData(1, true)] [InlineData(2, true)] [InlineData(3, true)] [InlineData(4, false)] [InlineData(5, false)]
    public async Task Draft_task_counts_are_unrestricted_and_readiness_is_separate(int count, bool ready)
    {
        await using var db = Context(); var d = await Seed(db); var s = new CourseTaskService(db);
        for (var i = 0; i < count; i++) Assert.Equal(ServiceFailure.None, (await s.SaveAsync(d.Course.Id, null, Owner, Request($"Task {i}"))).Failure);
        var result = (await s.GetReadinessAsync(d.Course.Id, Owner)).Value!;
        Assert.Equal(count, result.TaskCount); Assert.Equal(ready, result.MeetsTaskCount);
        Assert.Equal(ready, CourseTaskService.CheckTaskCount(count).MeetsTaskCount);
        if (count > 0)
        {
            var id = (await s.GetAllAsync(d.Course.Id, Owner)).Value![0].Id;
            Assert.Equal(ServiceFailure.None, (await s.SaveAsync(d.Course.Id, id, Owner, Request("Edited regardless of count"))).Failure);
            Assert.Equal(ServiceFailure.None, (await s.DeleteAsync(d.Course.Id, id, Owner)).Failure);
        }
    }
    [Theory] [InlineData(true)] [InlineData(false)]
    public async Task Delete_protects_existing_attachments_and_submissions(bool attachment)
    {
        await using var db = Context(); var d = await Seed(db); var s = new CourseTaskService(db);
        var task = (await s.SaveAsync(d.Course.Id, null, Owner, Request())).Value!;
        if (attachment) db.TaskAttachments.Add(new() { CourseTaskId = task.Id, MediaAssetId = Guid.NewGuid() });
        else db.TaskSubmissions.Add(new() { CourseTaskId = task.Id, EnrollmentId = Guid.NewGuid() });
        await db.SaveChangesAsync();
        Assert.Equal(ServiceFailure.Conflict, (await s.DeleteAsync(d.Course.Id, task.Id, Owner)).Failure);
        Assert.Single((await s.GetAllAsync(d.Course.Id, Owner)).Value!);
    }
}
