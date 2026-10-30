using esham.BLL.DTOs;
using esham.BLL.DTOs.Courses;
using esham.BLL.Interfaces;
using esham.DAL.Data;
using esham.DAL.Entities;
using Microsoft.EntityFrameworkCore;
namespace esham.BLL.Services;

public sealed class CourseCoverService(AppDbContext db, IMediaStorage storage) : ICourseCoverService
{
    private readonly CurriculumService curriculum = new(db);
    private static ServiceResult<T> Fail<T>(ServiceFailure failure, string message) => ServiceResult<T>.Fail(failure, message);
    private static CourseCoverResponse Map(Guid courseId, Guid versionId, MediaAsset asset) => new(versionId, asset.Id,
        asset.OriginalFileName, asset.MimeType, asset.SizeBytes, $"/api/courses/{courseId}/draft/cover/{asset.Id}/content");
    private Task<MediaAsset?> Asset(Guid? id, string ownerId, CancellationToken ct) => db.MediaAssets.SingleOrDefaultAsync(x =>
        x.Id == id && x.OwnerUserId == ownerId && x.MediaType == "image" && (x.MimeType == "image/png" || x.MimeType == "image/jpeg" || x.MimeType == "image/webp"), ct);

    public Task<ServiceResult<CourseCoverResponse?>> GetAsync(Guid courseId, CourseActor actor, CancellationToken ct = default) =>
        curriculum.InDraft(courseId, actor, false, async draft =>
        {
            if (!draft.CoverMediaAssetId.HasValue) return ServiceResult<CourseCoverResponse?>.Ok(null);
            var asset = await Asset(draft.CoverMediaAssetId, actor.UserId, ct);
            return asset == null ? Fail<CourseCoverResponse?>(ServiceFailure.NotFound, "The saved cover asset is unavailable.")
                : ServiceResult<CourseCoverResponse?>.Ok(Map(courseId, draft.Id, asset));
        }, ct);

    public async Task<ServiceResult<CourseCoverResponse>> UploadAsync(Guid courseId, CourseActor actor, CoverUploadRequest request, Stream input, CancellationToken ct = default)
    {
        var guard = await curriculum.InDraft(courseId, actor, false, draft => Task.FromResult(ServiceResult<Guid>.Ok(draft.Id)), ct);
        if (guard.Failure != ServiceFailure.None) return Fail<CourseCoverResponse>(guard.Failure, guard.Message!);
        var mime = request.ContentType.Split(';')[0].Trim().ToLowerInvariant();
        if (request.UploadId == Guid.Empty || string.IsNullOrWhiteSpace(request.FileName) || request.FileName.Length > 255
            || request.FileName.Any(char.IsControl) || request.FileName.Contains('/') || request.FileName.Contains('\\')
            || mime is not ("image/jpeg" or "image/png" or "image/webp"))
            return Fail<CourseCoverResponse>(ServiceFailure.Validation, "Choose a JPG, PNG or WEBP cover with a safe filename.");
        StoredMediaFile file;
        try { file = await storage.SaveAsync(input, mime, ct); }
        catch (InvalidDataException error) { return Fail<CourseCoverResponse>(ServiceFailure.Validation, error.Message); }
        if (file.SizeBytes <= 0 || file.SizeBytes > 2L * 1024 * 1024)
        {
            await storage.DeleteAsync(file.Key, CancellationToken.None);
            return Fail<CourseCoverResponse>(ServiceFailure.Validation, "Choose a nonempty cover image up to 2MB.");
        }
        var result = await curriculum.InDraft(courseId, actor, true, async draft =>
        {
            if (draft.Id != guard.Value) return Fail<CourseCoverResponse>(ServiceFailure.Conflict, "The current draft changed. Reload before uploading the cover.");
            var asset = await db.MediaAssets.SingleOrDefaultAsync(x => x.Id == request.UploadId, ct);
            if (asset != null && (asset.OwnerUserId != actor.UserId || asset.ContentHash != file.ContentHash
                || asset.MediaType != "image" || asset.MimeType != mime || draft.CoverMediaAssetId != asset.Id))
                return Fail<CourseCoverResponse>(ServiceFailure.Conflict, "Upload identity belongs to another asset or cover. Select the image again.");
            if (asset == null)
            {
                asset = new MediaAsset { Id = request.UploadId, OwnerUserId = actor.UserId, StorageKey = file.Key,
                    OriginalFileName = request.FileName, MimeType = mime, MediaType = "image", SizeBytes = file.SizeBytes, ContentHash = file.ContentHash };
                db.MediaAssets.Add(asset);
            }
            draft.CoverMediaAssetId = asset.Id;
            return ServiceResult<CourseCoverResponse>.Ok(Map(courseId, draft.Id, asset));
        }, ct);
        // Only delete unused newly streamed bytes, never prior cover/source assets.
        if (result.Failure != ServiceFailure.None || !await db.MediaAssets.AnyAsync(x => x.StorageKey == file.Key, ct))
            await storage.DeleteAsync(file.Key, CancellationToken.None);
        return result;
    }

    public async Task<ServiceResult<(Stream Stream, string ContentType)>> OpenAsync(Guid courseId, Guid assetId, CourseActor actor, CancellationToken ct = default)
    {
        var result = await GetAsync(courseId, actor, ct);
        if (result.Failure != ServiceFailure.None) return Fail<(Stream, string)>(result.Failure, result.Message!);
        if (result.Value?.MediaAssetId != assetId) return Fail<(Stream, string)>(ServiceFailure.NotFound, "Cover not found in the current draft.");
        var asset = await Asset(assetId, actor.UserId, ct);
        var stream = await storage.OpenAsync(asset!.StorageKey, ct);
        return stream == null ? Fail<(Stream, string)>(ServiceFailure.NotFound, "The cover file is unavailable in this storage instance.")
            : ServiceResult<(Stream, string)>.Ok((stream, asset.MimeType));
    }
}
