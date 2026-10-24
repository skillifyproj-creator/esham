using esham.BLL.DTOs;
using esham.BLL.DTOs.Courses;
namespace esham.BLL.Interfaces;
public interface ICourseService
{
    Task<ServiceResult<CourseDetailResponseDto>> CreateAsync(CourseActor actor, CreateCourseRequest request, CancellationToken ct = default);
    Task<ServiceResult<IReadOnlyList<InstructorCourseSummaryDto>>> GetMineAsync(CourseActor actor, CancellationToken ct = default);
    Task<ServiceResult<CourseVersionResponseDto>> GetDraftAsync(Guid id, CourseActor actor, CancellationToken ct = default);
    Task<ServiceResult<CourseVersionResponseDto>> UpdateDraftAsync(Guid id, CourseActor actor, UpdateCourseDraftRequest request, CancellationToken ct = default);
    Task<ServiceResult<CourseDetailResponseDto>> GetAsync(Guid id, CourseActor actor, CancellationToken ct = default);
    Task<IReadOnlyList<PublicCourseResponseDto>> GetPublicAsync(CancellationToken ct = default);
    Task<ServiceResult<PublicCourseResponseDto>> GetPublicAsync(Guid id, CancellationToken ct = default);
}
