using esham.BLL.DTOs;
using esham.BLL.DTOs.Courses;
using esham.BLL.Interfaces;
using esham.DAL.Data;
using esham.DAL.Entities;
using Microsoft.EntityFrameworkCore;
namespace esham.BLL.Services;

public sealed class CourseTaskService(AppDbContext db) : ICourseTaskService
{
    // Reuse exactly the same ownership, version and transaction boundary as sections/lessons.
    private readonly CurriculumService curriculum = new(db);
    private static ServiceResult<T> Fail<T>(ServiceFailure failure, string message) => ServiceResult<T>.Fail(failure, message);
    private static bool HasText(ObjectiveDto? value) => !string.IsNullOrWhiteSpace(value?.Ar) || !string.IsNullOrWhiteSpace(value?.En);
    private static CourseTaskResponse Map(CourseTask x) => new(x.Id, x.CourseVersionId, x.DisplaySectionId,
        x.TitleAr, x.TitleEn, x.DescriptionAr, x.DescriptionEn,
        x.Instructions is null ? null : new(x.Instructions.Ar, x.Instructions.En),
        x.Requirements?.Select(r => new ObjectiveDto(r.Ar, r.En)).ToList() ?? [], x.SortOrder, x.IsReady);
    public static TaskReadinessResponse CheckTaskCount(int count) => new(count, count is >= 1 and <= 3);
    public static bool IsCompleteForReview(CourseTask task) => task.IsReady
        && (!string.IsNullOrWhiteSpace(task.TitleAr) || !string.IsNullOrWhiteSpace(task.TitleEn))
        && (!string.IsNullOrWhiteSpace(task.DescriptionAr) || !string.IsNullOrWhiteSpace(task.DescriptionEn))
        && (!string.IsNullOrWhiteSpace(task.Instructions?.Ar) || !string.IsNullOrWhiteSpace(task.Instructions?.En))
        && task.Requirements is { Count: > 0 } && task.Requirements.All(x => !string.IsNullOrWhiteSpace(x.Ar) || !string.IsNullOrWhiteSpace(x.En));
    public Task<ServiceResult<TaskReadinessResponse>> GetReadinessAsync(Guid courseId, CourseActor actor, CancellationToken ct = default) =>
        curriculum.InDraft(courseId, actor, false, async draft => ServiceResult<TaskReadinessResponse>.Ok(
            CheckTaskCount(await db.CourseTasks.CountAsync(x => x.CourseVersionId == draft.Id, ct))), ct);
    public Task<ServiceResult<List<CourseTaskResponse>>> GetAllAsync(Guid courseId, CourseActor actor, CancellationToken ct = default) =>
        curriculum.InDraft(courseId, actor, false, async draft => ServiceResult<List<CourseTaskResponse>>.Ok(
            (await db.CourseTasks.AsNoTracking().Where(x => x.CourseVersionId == draft.Id).OrderBy(x => x.SortOrder).ThenBy(x => x.Id)
                .ToListAsync(ct)).Select(Map).ToList()), ct);
    public Task<ServiceResult<CourseTaskResponse>> GetAsync(Guid courseId, Guid taskId, CourseActor actor, CancellationToken ct = default) =>
        curriculum.InDraft(courseId, actor, false, async draft =>
        {
            var task = await db.CourseTasks.AsNoTracking().SingleOrDefaultAsync(x => x.Id == taskId && x.CourseVersionId == draft.Id, ct);
            return task is null ? Fail<CourseTaskResponse>(ServiceFailure.NotFound, "Task not found in the current draft.") : ServiceResult<CourseTaskResponse>.Ok(Map(task));
        }, ct);
    public Task<ServiceResult<CourseTaskResponse>> SaveAsync(Guid courseId, Guid? taskId, CourseActor actor,
        CourseTaskRequest request, CancellationToken ct = default)
    {
        var createdId = Guid.NewGuid();
        return curriculum.InDraft(courseId, actor, true, async draft =>
        {
            var task = await db.CourseTasks.SingleOrDefaultAsync(x => x.Id == (taskId ?? createdId) && x.CourseVersionId == draft.Id, ct);
            if (taskId.HasValue && task is null) return Fail<CourseTaskResponse>(ServiceFailure.NotFound, "Task not found in the current draft.");
            if (string.IsNullOrWhiteSpace(request.TitleAr) && string.IsNullOrWhiteSpace(request.TitleEn)
                || request.TitleAr?.Length > 200 || request.TitleEn?.Length > 200 || request.SortOrder < 0)
                return Fail<CourseTaskResponse>(ServiceFailure.Validation, "Provide an Arabic or English title (at most 200 characters) and a nonnegative SortOrder.");
            if (request.DescriptionAr?.Length > 10000 || request.DescriptionEn?.Length > 10000
                || request.Instructions?.Ar?.Length > 10000 || request.Instructions?.En?.Length > 10000
                || request.Requirements?.Count > 50 || request.Requirements?.Any(r => !HasText(r) || r.Ar?.Length > 2000 || r.En?.Length > 2000) == true)
                return Fail<CourseTaskResponse>(ServiceFailure.Validation, "Descriptions/instructions must not exceed 10000 characters; provide at most 50 nonblank localized requirements of at most 2000 characters per language.");
            if (request.IsReady && (!HasText(request.Instructions) || request.Requirements?.Count is not > 0
                || string.IsNullOrWhiteSpace(request.DescriptionAr) && string.IsNullOrWhiteSpace(request.DescriptionEn)))
                return Fail<CourseTaskResponse>(ServiceFailure.Validation, "A ready task requires a description, instructions and assessment requirements.");
            if (request.DisplaySectionId.HasValue && !await db.CourseSections.AnyAsync(x => x.Id == request.DisplaySectionId && x.CourseVersionId == draft.Id, ct))
                return Fail<CourseTaskResponse>(ServiceFailure.Validation, "DisplaySectionId must belong to the current draft version.");
            if (task is null) { task = new CourseTask { Id = createdId, CourseVersionId = draft.Id }; db.CourseTasks.Add(task); }
            task.TitleAr = request.TitleAr?.Trim(); task.TitleEn = request.TitleEn?.Trim(); task.SortOrder = request.SortOrder;
            task.DescriptionAr = request.DescriptionAr?.Trim(); task.DescriptionEn = request.DescriptionEn?.Trim();
            task.Instructions = request.Instructions is null ? null : new(request.Instructions.Ar?.Trim(), request.Instructions.En?.Trim());
            task.Requirements = request.Requirements?.Select(r => new LocalizedText(r.Ar?.Trim(), r.En?.Trim())).ToList();
            task.DisplaySectionId = request.DisplaySectionId; task.IsReady = request.IsReady; task.UpdatedAt = DateTimeOffset.UtcNow;
            // Task count is deliberately unrestricted during normal draft editing.
            return ServiceResult<CourseTaskResponse>.Ok(Map(task));
        }, ct);
    }
    public Task<ServiceResult<bool>> DeleteAsync(Guid courseId, Guid taskId, CourseActor actor, CancellationToken ct = default) =>
        curriculum.InDraft(courseId, actor, true, async draft =>
        {
            var task = await db.CourseTasks.SingleOrDefaultAsync(x => x.Id == taskId && x.CourseVersionId == draft.Id, ct);
            if (task is null) return Fail<bool>(ServiceFailure.NotFound, "Task not found in the current draft.");
            if (await db.TaskAttachments.AnyAsync(x => x.CourseTaskId == taskId, ct) || await db.TaskSubmissions.AnyAsync(x => x.CourseTaskId == taskId, ct))
                return Fail<bool>(ServiceFailure.Conflict, "Task has attachments or submissions and cannot be deleted.");
            db.CourseTasks.Remove(task); return ServiceResult<bool>.Ok(true);
        }, ct);
    public Task<ServiceResult<bool>> ReorderAsync(Guid courseId, CourseActor actor, ReorderRequest request, CancellationToken ct = default) =>
        curriculum.InDraft(courseId, actor, true, async draft =>
        {
            var tasks = await db.CourseTasks.Where(x => x.CourseVersionId == draft.Id).ToListAsync(ct);
            if (request.Ids is null || request.Ids.Count != tasks.Count || !tasks.Select(x => x.Id).ToHashSet().SetEquals(request.Ids))
                return Fail<bool>(ServiceFailure.Validation, "Ids must contain every current draft task exactly once, with no foreign IDs.");
            var positions = request.Ids.Select((id, index) => (id, index)).ToDictionary(x => x.id, x => x.index);
            foreach (var task in tasks) { task.SortOrder = positions[task.Id]; task.UpdatedAt = DateTimeOffset.UtcNow; }
            return ServiceResult<bool>.Ok(true);
        }, ct);
}
