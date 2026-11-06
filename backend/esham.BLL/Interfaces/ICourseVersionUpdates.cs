using esham.BLL.DTOs;
using esham.BLL.DTOs.Courses;
using esham.DAL.Entities;
namespace esham.BLL.Interfaces;
public interface ICourseVersionUpdates
{
    // Internal business integration only: caller owns the serializable transaction.
    // Lock course first, then enrollment/wallet resources in the same order in future enrollment writes.
    Task StageEnrollmentAsync(Enrollment enrollment, CancellationToken ct = default);
    Task StagePublicationAsync(Course course, CourseVersion approvedVersion, Guid? previousPublishedVersionId, CancellationToken ct = default);
    Task<ServiceResult<EnrollmentVersionState>> GetStateAsync(Guid enrollmentId, string learnerUserId, CancellationToken ct = default);
}
