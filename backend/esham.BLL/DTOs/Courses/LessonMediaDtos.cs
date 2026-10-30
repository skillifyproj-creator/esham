namespace esham.BLL.DTOs.Courses;

public sealed record VideoUploadRequest(Guid UploadId, string FileName, string ContentType,
    double DurationSeconds, Guid? SourceMediaAssetId = null, Guid? ReplaceAttachmentId = null);
public sealed record StoredMediaFile(string Key, string ContentHash, long SizeBytes, string ContentType);
public sealed record LessonMediaResponse(Guid AttachmentId, Guid MediaAssetId, string FileName,
    string ContentType, long SizeBytes, double? DurationSeconds, Guid? SourceMediaAssetId,
    bool IsPrimary, string ContentUrl, string ScreeningStatus);
