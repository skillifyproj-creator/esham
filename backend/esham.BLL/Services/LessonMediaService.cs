using esham.BLL.DTOs;
using esham.BLL.DTOs.Courses;
using esham.BLL.Interfaces;
using esham.DAL.Data;
using esham.DAL.Entities;
using Microsoft.EntityFrameworkCore;
namespace esham.BLL.Services;

public sealed class LessonMediaService(AppDbContext db, IMediaStorage storage) : ILessonMediaService
{
    private readonly CurriculumService curriculum = new(db);
    private static ServiceResult<T> Fail<T>(ServiceFailure failure, string message) => ServiceResult<T>.Fail(failure, message);
    private Task<Lesson?> Lesson(Guid versionId, Guid sectionId, Guid lessonId, CancellationToken ct) =>
        db.Lessons.Include(x => x.Attachments).ThenInclude(x => x.MediaAsset)
            .SingleOrDefaultAsync(x => x.Id == lessonId && x.CourseSectionId == sectionId
                && x.CourseSection.CourseVersionId == versionId, ct);
    private static LessonMediaResponse Map(Guid courseId, Guid sectionId, Lesson lesson, LessonAttachment attachment)
    {
        var asset = attachment.MediaAsset;
        return new(attachment.Id, asset.Id, asset.OriginalFileName, asset.MimeType, asset.SizeBytes,
            asset.DurationSeconds, asset.SourceMediaAssetId, lesson.PrimaryVideoMediaAssetId == asset.Id,
            $"/api/courses/{courseId}/draft/sections/{sectionId}/lessons/{lesson.Id}/media/{attachment.Id}/content", "pending");
    }
    private static string? VideoConflict(IReadOnlyCollection<LessonMediaResponse> existing, VideoUploadRequest request)
    {
        if (existing.Count > 1) return "Legacy video relationships must be normalized before changing this lesson video.";
        var current = existing.SingleOrDefault();
        if (current?.MediaAssetId == request.UploadId) return null; // An identical retry is not a second video.
        return current != null && request.ReplaceAttachmentId != current.AttachmentId
            ? "This lesson already has a video. Use explicit Replace Video."
            : current == null && request.ReplaceAttachmentId.HasValue ? "The video to replace has changed. Reload the lesson." : null;
    }
    private async Task<bool> ValidSource(Lesson lesson, string ownerId, Guid sourceId, CancellationToken ct)
    {
        // Detached source history is valid only through this lesson's currently attached video lineage.
        var current = lesson.Attachments.Where(x => x.MediaAsset.MediaType == "video" && x.MediaAsset.OwnerUserId == ownerId).Select(x => x.MediaAsset).SingleOrDefault();
        var visited = new HashSet<Guid>();
        while (current != null && visited.Count < 64 && visited.Add(current.Id))
        {
            if (current.Id == sourceId) return true;
            current = current.SourceMediaAssetId.HasValue ? await db.MediaAssets.SingleOrDefaultAsync(x => x.Id == current.SourceMediaAssetId && x.OwnerUserId == ownerId && x.MediaType == "video", ct) : null;
        }
        return false;
    }
    public Task<ServiceResult<List<LessonMediaResponse>>> NormalizeAsync(Guid courseId, Guid sectionId, Guid lessonId, CourseActor actor, CancellationToken ct = default) =>
        curriculum.InDraft(courseId, actor, true, async draft =>
        {
            var lesson = await Lesson(draft.Id, sectionId, lessonId, ct);
            if (lesson == null) return Fail<List<LessonMediaResponse>>(ServiceFailure.NotFound, "Lesson not found in this draft.");
            var videos = lesson.Attachments.Where(x => x.MediaAsset.MediaType == "video").ToList();
            if (videos.Any(x => x.MediaAsset.OwnerUserId != actor.UserId)) return Fail<List<LessonMediaResponse>>(ServiceFailure.Forbidden, "Media ownership is invalid.");
            if (videos.Count <= 1) return ServiceResult<List<LessonMediaResponse>>.Ok(videos.Select(x => Map(courseId, sectionId, lesson, x)).ToList());
            var primary = videos.SingleOrDefault(x => x.MediaAssetId == lesson.PrimaryVideoMediaAssetId);
            if (primary == null || videos.Any(x => x.MediaAsset.OwnerUserId != actor.UserId))
                return Fail<List<LessonMediaResponse>>(ServiceFailure.Conflict, "Cannot safely normalize videos without a valid owned selected primary.");
            db.LessonAttachments.RemoveRange(videos.Where(x => x.Id != primary.Id));
            lesson.UpdatedAt = DateTimeOffset.UtcNow;
            return ServiceResult<List<LessonMediaResponse>>.Ok([Map(courseId, sectionId, lesson, primary)]);
        }, ct);
    public Task<ServiceResult<List<LessonMediaResponse>>> GetAsync(Guid courseId, Guid sectionId, Guid lessonId, CourseActor actor, CancellationToken ct = default) =>
        curriculum.InDraft(courseId, actor, false, async draft =>
        {
            var lesson = await Lesson(draft.Id, sectionId, lessonId, ct);
            return lesson is null ? Fail<List<LessonMediaResponse>>(ServiceFailure.NotFound, "Lesson not found in this draft section.")
                : ServiceResult<List<LessonMediaResponse>>.Ok(lesson.Attachments.Where(x => x.MediaAsset.OwnerUserId == actor.UserId && x.MediaAsset.MediaType == "video")
                    .OrderBy(x => x.SortOrder).Select(x => Map(courseId, sectionId, lesson, x)).ToList());
        }, ct);

    public async Task<ServiceResult<LessonMediaResponse>> UploadAsync(Guid courseId, Guid sectionId, Guid lessonId, CourseActor actor,
        VideoUploadRequest request, Stream input, CancellationToken ct = default)
    {
        var validation = await GetAsync(courseId, sectionId, lessonId, actor, ct);
        if (validation.Failure != ServiceFailure.None) return Fail<LessonMediaResponse>(validation.Failure, validation.Message!);
        var conflict = VideoConflict(validation.Value!, request);
        if (conflict != null) return Fail<LessonMediaResponse>(ServiceFailure.Conflict, conflict);
        var mime = request.ContentType.Split(';')[0].Trim().ToLowerInvariant();
        if (request.UploadId == Guid.Empty || request.SourceMediaAssetId == request.UploadId || string.IsNullOrWhiteSpace(request.FileName) || request.FileName.Length > 255
            || request.FileName.Any(char.IsControl) || request.FileName.Contains('/') || request.FileName.Contains('\\')
            || !double.IsFinite(request.DurationSeconds) || request.DurationSeconds <= 0 || request.DurationSeconds > 36000
            || mime is not ("video/mp4" or "video/webm" or "video/quicktime")
            || !new[] { ".mp4", ".webm", ".mov" }.Contains(Path.GetExtension(request.FileName).ToLowerInvariant()))
            return Fail<LessonMediaResponse>(ServiceFailure.Validation, "Provide a supported video, a safe filename, and a positive duration up to ten hours.");
        StoredMediaFile stored;
        try { stored = await storage.SaveAsync(input, mime, ct); }
        catch (InvalidDataException error) { return Fail<LessonMediaResponse>(ServiceFailure.Validation, error.Message); }
        var attachmentId = Guid.NewGuid();
        // Files are streamed before taking a SQL write lock. Revalidate the draft inside the transaction.
        var result = await curriculum.InDraft(courseId, actor, true, async draft =>
        {
            var lesson = await Lesson(draft.Id, sectionId, lessonId, ct);
            if (lesson is null) return Fail<LessonMediaResponse>(ServiceFailure.NotFound, "Lesson not found in this draft section.");
            if (lesson.ContentType != "video") return Fail<LessonMediaResponse>(ServiceFailure.Conflict, "Select and save Video content type before attaching video.");
            var videos = lesson.Attachments.Where(x => x.MediaAsset.MediaType == "video").ToList();
            if (videos.Any(x => x.MediaAsset.OwnerUserId != actor.UserId)) return Fail<LessonMediaResponse>(ServiceFailure.Forbidden, "Media ownership is invalid.");
            var stateConflict = VideoConflict(videos.Select(x => Map(courseId, sectionId, lesson, x)).ToList(), request);
            if (stateConflict != null) return Fail<LessonMediaResponse>(ServiceFailure.Conflict, stateConflict);
            if (request.SourceMediaAssetId.HasValue && !await ValidSource(lesson, actor.UserId, request.SourceMediaAssetId.Value, ct))
                return Fail<LessonMediaResponse>(ServiceFailure.Validation, "Source video must belong to this same draft lesson's owned video lineage.");
            var asset = await db.MediaAssets.SingleOrDefaultAsync(x => x.Id == request.UploadId, ct);
            if (asset != null && (asset.OwnerUserId != actor.UserId || asset.ContentHash != stored.ContentHash
                || asset.SourceMediaAssetId != request.SourceMediaAssetId || !lesson.Attachments.Any(x => x.MediaAssetId == asset.Id)))
                return Fail<LessonMediaResponse>(ServiceFailure.Conflict, "Upload identity belongs to different content or lesson. Choose the video again.");
            if (asset == null)
            {
                asset = new MediaAsset { Id = request.UploadId, OwnerUserId = actor.UserId, StorageKey = stored.Key,
                    OriginalFileName = request.FileName, MimeType = stored.ContentType, SizeBytes = stored.SizeBytes,
                    ContentHash = stored.ContentHash, DurationSeconds = request.DurationSeconds, MediaType = "video",
                    SourceMediaAssetId = request.SourceMediaAssetId };
                db.MediaAssets.Add(asset);
                // This is a pending record, never an approval copied from the browser.
                db.ScreeningResults.Add(new ScreeningResult { MediaAssetId = asset.Id, ContentHash = asset.ContentHash,
                    ModelName = "pending-server-review", ModelVersion = "none", PolicyVersion = "draft-media-v1",
                    Status = "pending", IsTrustedServerResult = false });
            }
            var attachment = lesson.Attachments.SingleOrDefault(x => x.MediaAssetId == asset.Id);
            if (attachment == null)
            {
                db.LessonAttachments.RemoveRange(videos);
                attachment = new LessonAttachment { Id = attachmentId, LessonId = lesson.Id, MediaAssetId = asset.Id,
                    MediaAsset = asset, DisplayName = asset.OriginalFileName,
                    SortOrder = lesson.Attachments.Select(x => x.SortOrder + 1).DefaultIfEmpty(0).Max() };
                lesson.Attachments.Add(attachment);
                db.LessonAttachments.Add(attachment);
            }
            lesson.PrimaryVideoMediaAssetId = asset.Id;
            lesson.UpdatedAt = DateTimeOffset.UtcNow;
            return ServiceResult<LessonMediaResponse>.Ok(Map(courseId, sectionId, lesson, attachment));
        }, ct);
        // Retried uploads reuse the same asset; discard only the unused new file, never a registered source.
        if (result.Failure != ServiceFailure.None || !await db.MediaAssets.AnyAsync(x => x.StorageKey == stored.Key, ct))
            await storage.DeleteAsync(stored.Key, CancellationToken.None);
        return result;
    }

    public Task<ServiceResult<bool>> DetachAsync(Guid courseId, Guid sectionId, Guid lessonId, Guid attachmentId, CourseActor actor, CancellationToken ct = default) =>
        curriculum.InDraft(courseId, actor, true, async draft =>
        {
            var lesson = await Lesson(draft.Id, sectionId, lessonId, ct);
            var attachment = lesson?.Attachments.SingleOrDefault(x => x.Id == attachmentId);
            if (attachment is null) return Fail<bool>(ServiceFailure.NotFound, "Attachment not found in this draft lesson.");
            if (attachment.MediaAsset.OwnerUserId != actor.UserId) return Fail<bool>(ServiceFailure.Forbidden, "Media ownership is invalid.");
            if (lesson!.PrimaryVideoMediaAssetId == attachment.MediaAssetId) lesson.PrimaryVideoMediaAssetId = null;
            db.LessonAttachments.Remove(attachment); lesson.UpdatedAt = DateTimeOffset.UtcNow;
            return ServiceResult<bool>.Ok(true);
        }, ct);

    public async Task<ServiceResult<(Stream Stream, string ContentType)>> OpenAsync(Guid courseId, Guid sectionId, Guid lessonId,
        Guid attachmentId, CourseActor actor, CancellationToken ct = default)
    {
        var result = await curriculum.InDraft(courseId, actor, false, async draft =>
        {
            var lesson = await Lesson(draft.Id, sectionId, lessonId, ct);
            var attachment = lesson?.Attachments.SingleOrDefault(x => x.Id == attachmentId && x.MediaAsset.OwnerUserId == actor.UserId && x.MediaAsset.MediaType == "video");
            return attachment is null ? Fail<MediaAsset>(ServiceFailure.NotFound, "Video not found in this draft lesson.") : ServiceResult<MediaAsset>.Ok(attachment.MediaAsset);
        }, ct);
        if (result.Failure != ServiceFailure.None) return Fail<(Stream, string)>(result.Failure, result.Message!);
        var stream = await storage.OpenAsync(result.Value!.StorageKey, ct);
        return stream == null ? Fail<(Stream, string)>(ServiceFailure.NotFound, "Video file is unavailable in this storage instance.")
            : ServiceResult<(Stream, string)>.Ok((stream, result.Value.MimeType));
    }
}
