using System.Data;
using esham.BLL.DTOs;
using esham.BLL.DTOs.Courses;
using esham.BLL.Interfaces;
using esham.DAL.Data;
using esham.DAL.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Data.SqlClient;
namespace esham.BLL.Services;

public sealed class CurriculumService(AppDbContext db) : ICurriculumService
{
    private static ServiceResult<T> Fail<T>(ServiceFailure failure, string message) => ServiceResult<T>.Fail(failure, message);
    internal async Task<ServiceResult<T>> InDraft<T>(Guid courseId, CourseActor actor, bool write,
        Func<CourseVersion, Task<ServiceResult<T>>> action, CancellationToken ct)
    {
        if (!actor.IsInstructor || string.IsNullOrWhiteSpace(actor.UserId))
            return Fail<T>(ServiceFailure.Forbidden, "Instructor access is required.");
        return await db.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
        {
            db.ChangeTracker.Clear();
            await using var transaction = write ? await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct) : null;
            // Lock the course before reading its children so concurrent writers use a consistent lock order.
            var courses = write && db.Database.IsSqlServer()
                ? db.Courses.FromSqlInterpolated($"SELECT * FROM [Courses] WITH (UPDLOCK, HOLDLOCK) WHERE [Id] = {courseId}")
                : db.Courses.AsQueryable();
            var course = await courses.Include(x => x.DraftVersion).SingleOrDefaultAsync(x => x.Id == courseId, ct);
            if (course is null) return Fail<T>(ServiceFailure.NotFound, "Course not found.");
            if (course.OwnerUserId != actor.UserId) return Fail<T>(ServiceFailure.Forbidden, "Only the course owner can manage its curriculum.");
            var draft = course.DraftVersion;
            if (draft is null || draft.CourseId != course.Id || draft.Id == course.PublishedVersionId
                || draft.ReviewStatus != CourseReviewStatuses.Draft || draft.ApprovedAt != null)
                return Fail<T>(ServiceFailure.Conflict, "An editable current draft is required.");
            var result = await action(draft);
            if (result.Failure != ServiceFailure.None) return result;
            if (write)
            {
                course.UpdatedAt = draft.UpdatedAt = DateTimeOffset.UtcNow;
                try { await db.SaveChangesAsync(ct); }
                catch (DbUpdateConcurrencyException) { return Fail<T>(ServiceFailure.Conflict, "Curriculum changed. Reload and retry."); }
                catch (DbUpdateException exception) when (exception.InnerException is SqlException { Number: 547 or 2601 or 2627 })
                { return Fail<T>(ServiceFailure.Conflict, "Curriculum has dependent or conflicting records. Reload and retry."); }
            }
            if (transaction != null) await transaction.CommitAsync(ct);
            return result;
        });
    }
    private static string? TitleError(string? ar, string? en, int order) =>
        string.IsNullOrWhiteSpace(ar) && string.IsNullOrWhiteSpace(en) ? "Provide an Arabic or English title."
        : ar?.Length > 200 || en?.Length > 200 ? "Titles must not exceed 200 characters."
        : order < 0 ? "SortOrder must be nonnegative." : null;
    private static bool HasVideo(Lesson x, string ownerId, Guid? mediaId) => mediaId.HasValue
        && x.Attachments.Count(a => a.MediaAsset.MediaType == "video") == 1 && x.Attachments.Any(a =>
        a.MediaAssetId == mediaId && a.MediaAsset.OwnerUserId == ownerId && a.MediaAsset.MediaType == "video"
        && a.MediaAsset.MimeType.StartsWith("video/") && a.MediaAsset.SizeBytes > 0 && !string.IsNullOrWhiteSpace(a.MediaAsset.StorageKey));
    private static LessonRequest Metadata(Lesson x) => new(x.TitleAr, x.TitleEn, x.SortOrder, x.DescriptionAr, x.DescriptionEn,
        x.ContentType, x.DurationSeconds, x.IsPreview, x.Objectives?.Select(o => new ObjectiveDto(o.Ar, o.En)).ToList(), x.PrimaryVideoMediaAssetId);
    private static LessonResponse Map(Lesson x, string ownerId) => new(x.Id, x.CourseSectionId, x.TitleAr, x.TitleEn, x.SortOrder,
        x.DescriptionAr, x.DescriptionEn, x.ContentType, x.DurationSeconds, x.IsPreview,
        x.Objectives?.Select(o => new ObjectiveDto(o.Ar, o.En)).ToList() ?? [], x.PrimaryVideoMediaAssetId,
        DraftContentReadiness.Lesson(Metadata(x), HasVideo(x, ownerId, x.PrimaryVideoMediaAssetId)));
    private static SectionResponse Map(CourseSection x, string ownerId)
    {
        var lessons = x.Lessons.OrderBy(l => l.SortOrder).ThenBy(l => l.Id).Select(l => Map(l, ownerId)).ToList();
        return new(x.Id, x.CourseVersionId, x.TitleAr, x.TitleEn, x.SortOrder, lessons, DraftContentReadiness.Section(x.TitleAr, x.TitleEn, lessons));
    }
    private IQueryable<CourseSection> Sections() => db.CourseSections.Include(x => x.Lessons)
        .ThenInclude(x => x.Attachments).ThenInclude(x => x.MediaAsset);
    private Task<CourseSection?> Section(Guid versionId, Guid sectionId, CancellationToken ct) =>
        Sections().SingleOrDefaultAsync(x => x.Id == sectionId && x.CourseVersionId == versionId, ct);

    public Task<ServiceResult<List<SectionResponse>>> GetSectionsAsync(Guid courseId, CourseActor actor, CancellationToken ct = default) =>
        InDraft(courseId, actor, false, async draft => ServiceResult<List<SectionResponse>>.Ok(
            (await Sections().Where(x => x.CourseVersionId == draft.Id)
                .OrderBy(x => x.SortOrder).ThenBy(x => x.Id).ToListAsync(ct)).Select(x => Map(x, actor.UserId)).ToList()), ct);

    public Task<ServiceResult<CurriculumReadinessResponse>> GetReadinessAsync(Guid courseId, CourseActor actor, CancellationToken ct = default) =>
        InDraft(courseId, actor, false, async draft => ServiceResult<CurriculumReadinessResponse>.Ok(
            DraftContentReadiness.Curriculum(draft.Id, (await Sections().Where(x => x.CourseVersionId == draft.Id)
                .OrderBy(x => x.SortOrder).ThenBy(x => x.Id).ToListAsync(ct)).Select(x => Map(x, actor.UserId)).ToList())), ct);

    public Task<ServiceResult<LessonReadinessResponse>> PreviewLessonReadinessAsync(Guid courseId, Guid sectionId, CourseActor actor,
        LessonReadinessPreviewRequest request, CancellationToken ct = default) =>
        InDraft(courseId, actor, false, async draft =>
        {
            var section = await Section(draft.Id, sectionId, ct);
            var lesson = section?.Lessons.SingleOrDefault(x => x.Id == request.LessonId);
            if (section == null || request.LessonId.HasValue && lesson == null)
                return Fail<LessonReadinessResponse>(ServiceFailure.NotFound, "Lesson or section not found in this draft.");
            if (request.Lesson == null) return Fail<LessonReadinessResponse>(ServiceFailure.Validation, "Lesson metadata is required.");
            return ServiceResult<LessonReadinessResponse>.Ok(DraftContentReadiness.Lesson(request.Lesson,
                lesson != null && HasVideo(lesson, actor.UserId, request.Lesson.PrimaryVideoMediaAssetId)));
        }, ct);

    public Task<ServiceResult<List<SectionResponse>>> EnsureDefaultSectionAsync(Guid courseId, CourseActor actor, CancellationToken ct = default)
    {
        var createdId = Guid.NewGuid();
        return InDraft(courseId, actor, true, async draft =>
        {
            var sections = await Sections()
                .Where(x => x.CourseVersionId == draft.Id).OrderBy(x => x.SortOrder).ThenBy(x => x.Id).ToListAsync(ct);
            if (sections.Count == 0)
            {
                var section = new CourseSection { Id = createdId, CourseVersionId = draft.Id,
                    TitleAr = "قسم جديد", TitleEn = "New Section", SortOrder = 0 };
                db.CourseSections.Add(section);
                sections.Add(section);
            }
            return ServiceResult<List<SectionResponse>>.Ok(sections.Select(x => Map(x, actor.UserId)).ToList());
        }, ct);
    }

    public Task<ServiceResult<SectionResponse>> SaveSectionAsync(Guid courseId, Guid? sectionId, CourseActor actor,
        SectionRequest request, CancellationToken ct = default)
    {
        var createdId = Guid.NewGuid();
        return InDraft(courseId, actor, true, async draft =>
    {
        var section = sectionId.HasValue ? await Section(draft.Id, sectionId.Value, ct)
            : await Section(draft.Id, createdId, ct) ?? new CourseSection { Id = createdId, CourseVersionId = draft.Id };
        if (section is null) return Fail<SectionResponse>(ServiceFailure.NotFound, "Section not found in the current draft.");
        var error = TitleError(request.TitleAr, request.TitleEn, request.SortOrder);
        if (error != null) return Fail<SectionResponse>(ServiceFailure.Validation, error);
        section.TitleAr = request.TitleAr?.Trim(); section.TitleEn = request.TitleEn?.Trim();
        section.SortOrder = request.SortOrder; section.UpdatedAt = DateTimeOffset.UtcNow;
        if (db.Entry(section).State == EntityState.Detached) db.CourseSections.Add(section);
        return ServiceResult<SectionResponse>.Ok(Map(section, actor.UserId));
    }, ct);
    }

    public Task<ServiceResult<bool>> DeleteSectionAsync(Guid courseId, Guid sectionId, CourseActor actor, CancellationToken ct = default) =>
        InDraft(courseId, actor, true, async draft =>
        {
            var section = await Section(draft.Id, sectionId, ct);
            if (section is null) return Fail<bool>(ServiceFailure.NotFound, "Section not found in the current draft.");
            if (section.Lessons.Count != 0 || await db.CourseTasks.AnyAsync(x => x.DisplaySectionId == sectionId, ct))
                return Fail<bool>(ServiceFailure.Conflict, "Remove lessons and relocate dependent tasks before deleting this section.");
            db.CourseSections.Remove(section); return ServiceResult<bool>.Ok(true);
        }, ct);

    public Task<ServiceResult<List<LessonResponse>>> GetLessonsAsync(Guid courseId, Guid sectionId, CourseActor actor, CancellationToken ct = default) =>
        InDraft(courseId, actor, false, async draft =>
        {
            var section = await Section(draft.Id, sectionId, ct);
            return section is null ? Fail<List<LessonResponse>>(ServiceFailure.NotFound, "Section not found in the current draft.")
                : ServiceResult<List<LessonResponse>>.Ok(Map(section, actor.UserId).Lessons);
        }, ct);

    public Task<ServiceResult<LessonResponse>> SaveLessonAsync(Guid courseId, Guid sectionId, Guid? lessonId, CourseActor actor,
        LessonRequest request, CancellationToken ct = default)
    {
        var createdId = Guid.NewGuid();
        return InDraft(courseId, actor, true, async draft =>
    {
        var section = await Section(draft.Id, sectionId, ct);
        if (section is null) return Fail<LessonResponse>(ServiceFailure.NotFound, "Section not found in the current draft.");
        var lesson = lessonId.HasValue ? section.Lessons.SingleOrDefault(x => x.Id == lessonId)
            : section.Lessons.SingleOrDefault(x => x.Id == createdId) ?? new Lesson { Id = createdId, CourseSectionId = sectionId };
        if (lesson is null) return Fail<LessonResponse>(ServiceFailure.NotFound, "Lesson not found in this draft section.");
        var error = TitleError(request.TitleAr, request.TitleEn, request.SortOrder);
        if (error != null) return Fail<LessonResponse>(ServiceFailure.Validation, error);
        if (request.ContentType is not ("video" or "article") || request.DescriptionAr?.Length > 10000 || request.DescriptionEn?.Length > 10000
            || request.DurationSeconds.HasValue && (!double.IsFinite(request.DurationSeconds.Value) || request.DurationSeconds <= 0)
            || request.Objectives?.Count > 50 || request.Objectives?.Any(o => o is null ||
                string.IsNullOrWhiteSpace(o.Ar) && string.IsNullOrWhiteSpace(o.En) || o.Ar?.Length > 2000 || o.En?.Length > 2000) == true)
            return Fail<LessonResponse>(ServiceFailure.Validation, "Invalid content type, description, positive duration or localized objectives.");
        if (request.PrimaryVideoMediaAssetId.HasValue && !await db.MediaAssets.AnyAsync(x => x.Id == request.PrimaryVideoMediaAssetId
            && x.OwnerUserId == actor.UserId && x.MediaType == "video" && x.MimeType.StartsWith("video/"), ct))
            return Fail<LessonResponse>(ServiceFailure.Validation, "Video must be an existing video asset owned by the instructor.");
        if (request.PrimaryVideoMediaAssetId.HasValue && request.PrimaryVideoMediaAssetId != lesson.PrimaryVideoMediaAssetId
            && !await db.LessonAttachments.AnyAsync(x => x.LessonId == lesson.Id && x.MediaAssetId == request.PrimaryVideoMediaAssetId, ct))
            return Fail<LessonResponse>(ServiceFailure.Validation, "Video must first be uploaded and attached to this same draft lesson.");
        lesson.TitleAr = request.TitleAr?.Trim(); lesson.TitleEn = request.TitleEn?.Trim(); lesson.SortOrder = request.SortOrder;
        lesson.DescriptionAr = request.DescriptionAr?.Trim(); lesson.DescriptionEn = request.DescriptionEn?.Trim();
        lesson.ContentType = request.ContentType; lesson.DurationSeconds = request.DurationSeconds; lesson.IsPreview = request.IsPreview;
        lesson.Objectives = request.Objectives?.Select(o => new LocalizedText(o.Ar?.Trim(), o.En?.Trim())).ToList();
        lesson.PrimaryVideoMediaAssetId = request.PrimaryVideoMediaAssetId; lesson.UpdatedAt = section.UpdatedAt = DateTimeOffset.UtcNow;
        if (db.Entry(lesson).State == EntityState.Detached) db.Lessons.Add(lesson);
        return ServiceResult<LessonResponse>.Ok(Map(lesson, actor.UserId));
    }, ct);
    }

    public Task<ServiceResult<bool>> DeleteLessonAsync(Guid courseId, Guid sectionId, Guid lessonId, CourseActor actor, CancellationToken ct = default) =>
        InDraft(courseId, actor, true, async draft =>
        {
            var section = await Section(draft.Id, sectionId, ct);
            var lesson = section?.Lessons.SingleOrDefault(x => x.Id == lessonId);
            if (lesson is null) return Fail<bool>(ServiceFailure.NotFound, "Lesson not found in this draft section.");
            if (await db.LessonAttachments.AnyAsync(x => x.LessonId == lessonId, ct)
                || await db.LessonProgressRecords.AnyAsync(x => x.LessonId == lessonId, ct)
                || await db.CourseReports.AnyAsync(x => x.LessonId == lessonId, ct))
                return Fail<bool>(ServiceFailure.Conflict, "Lesson has attachments, progress or reports and cannot be deleted.");
            db.Lessons.Remove(lesson); section!.UpdatedAt = DateTimeOffset.UtcNow;
            return ServiceResult<bool>.Ok(true);
        }, ct);

    public Task<ServiceResult<bool>> ReorderAsync(Guid courseId, Guid? sectionId, CourseActor actor, ReorderRequest request, CancellationToken ct = default) =>
        InDraft(courseId, actor, true, async draft =>
        {
            var sections = sectionId.HasValue ? null : await db.CourseSections.Where(x => x.CourseVersionId == draft.Id).ToListAsync(ct);
            var section = sectionId.HasValue ? await Section(draft.Id, sectionId.Value, ct) : null;
            if (sectionId.HasValue && section is null) return Fail<bool>(ServiceFailure.NotFound, "Section not found in the current draft.");
            var existing = sections?.Select(x => x.Id).ToHashSet() ?? section!.Lessons.Select(x => x.Id).ToHashSet();
            if (request.Ids is null || request.Ids.Count != existing.Count || !existing.SetEquals(request.Ids))
                return Fail<bool>(ServiceFailure.Validation, "Ids must contain every current sibling exactly once, with no foreign IDs.");
            var positions = request.Ids.Select((id, index) => (id, index)).ToDictionary(x => x.id, x => x.index);
            if (sections != null) foreach (var item in sections) { item.SortOrder = positions[item.Id]; item.UpdatedAt = DateTimeOffset.UtcNow; }
            else foreach (var item in section!.Lessons) { item.SortOrder = positions[item.Id]; item.UpdatedAt = DateTimeOffset.UtcNow; }
            return ServiceResult<bool>.Ok(true);
        }, ct);
}
