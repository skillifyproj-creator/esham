using esham.BLL.DTOs;
using esham.BLL.DTOs.Courses;
namespace esham.BLL.Interfaces;
public interface ICourseCoverService
{
    Task<ServiceResult<CourseCoverResponse?>> GetAsync(Guid courseId, CourseActor actor, CancellationToken ct = default);
    Task<ServiceResult<CourseCoverResponse>> UploadAsync(Guid courseId, CourseActor actor, CoverUploadRequest request, Stream input, CancellationToken ct = default);
    Task<ServiceResult<(Stream Stream, string ContentType)>> OpenAsync(Guid courseId, Guid assetId, CourseActor actor, CancellationToken ct = default);
}
