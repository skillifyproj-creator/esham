using esham.BLL.DTOs;
using esham.BLL.DTOs.Courses;
namespace esham.BLL.Interfaces;
public interface ICourseReviewService
{
    Task<ServiceResult<CourseReviewSnapshot>> GetAsync(Guid courseId, Guid? versionId, CourseActor actor, CancellationToken ct = default);
    Task<ServiceResult<List<ReviewQueueItem>>> ListAsync(CourseActor actor, string? status, CancellationToken ct = default);
    Task<ServiceResult<Guid>> SubmitAsync(Guid courseId, CourseActor actor, VersionActionRequest request, CancellationToken ct = default);
    Task<ServiceResult<Guid>> ReviseAsync(Guid courseId, CourseActor actor, VersionActionRequest request, CancellationToken ct = default);
    Task<ServiceResult<Guid>> DecideAsync(Guid courseId, Guid versionId, CourseActor actor, ReviewDecisionRequest request, CancellationToken ct = default);
    Task<ServiceResult<(Stream Stream, string ContentType)>> OpenMediaAsync(Guid courseId, Guid versionId, Guid assetId, CourseActor actor, CancellationToken ct = default);
}
