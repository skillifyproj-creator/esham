using esham.BLL.DTOs;
using esham.BLL.DTOs.Courses;
namespace esham.BLL.Interfaces;

public interface ICourseTaskService
{
    Task<ServiceResult<List<CourseTaskResponse>>> GetAllAsync(Guid courseId, CourseActor actor, CancellationToken ct = default);
    Task<ServiceResult<CourseTaskResponse>> GetAsync(Guid courseId, Guid taskId, CourseActor actor, CancellationToken ct = default);
    Task<ServiceResult<CourseTaskResponse>> SaveAsync(Guid courseId, Guid? taskId, CourseActor actor, CourseTaskRequest request, CancellationToken ct = default);
    Task<ServiceResult<bool>> DeleteAsync(Guid courseId, Guid taskId, CourseActor actor, CancellationToken ct = default);
    Task<ServiceResult<bool>> ReorderAsync(Guid courseId, CourseActor actor, ReorderRequest request, CancellationToken ct = default);
    Task<ServiceResult<TaskReadinessResponse>> GetReadinessAsync(Guid courseId, CourseActor actor, CancellationToken ct = default);
}
