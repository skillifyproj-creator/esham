namespace esham.BLL.DTOs.Courses;
public sealed record CoverUploadRequest(Guid UploadId, string FileName, string ContentType);
public sealed record CourseCoverResponse(Guid CourseVersionId, Guid MediaAssetId, string FileName, string ContentType, long SizeBytes, string ContentUrl);
