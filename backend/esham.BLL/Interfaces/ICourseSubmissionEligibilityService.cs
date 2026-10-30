using esham.BLL.DTOs;
using esham.BLL.DTOs.Courses;
namespace esham.BLL.Interfaces;
public interface ICourseSubmissionEligibilityService
{
    Task<ServiceResult<SubmissionEligibilityResponse>> GetAsync(Guid courseId, CourseActor actor, CancellationToken ct = default);
}
