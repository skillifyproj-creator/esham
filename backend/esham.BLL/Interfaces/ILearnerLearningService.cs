using System.Security.Claims;
using esham.BLL.DTOs;
using esham.BLL.DTOs.Learning;
namespace esham.BLL.Interfaces;
public interface ILearnerLearningService
{
    Task<ServiceResult<LearningCourse>> GetAsync(ClaimsPrincipal actor, Guid enrollmentId, CancellationToken ct = default);
    Task<ServiceResult<LessonContent>> LessonAsync(ClaimsPrincipal actor, Guid enrollmentId, Guid lessonId, CancellationToken ct = default);
    Task<ServiceResult<LearningMedia>> MediaAsync(ClaimsPrincipal actor, Guid enrollmentId, Guid lessonId, Guid? attachmentId, CancellationToken ct = default);
}
public interface ILessonProgressService
{
    Task<ServiceResult<ProgressState>> WriteAsync(ClaimsPrincipal actor, Guid enrollmentId, Guid lessonId, ProgressWrite request, bool open = false, CancellationToken ct = default);
    Task<ServiceResult<ProgressState>> CompleteAsync(ClaimsPrincipal actor, Guid enrollmentId, Guid lessonId, CompleteLesson request, CancellationToken ct = default);
}
public interface ILearningProgressWriteGate { Task<bool> IsEnabledAsync(CancellationToken ct = default); }
