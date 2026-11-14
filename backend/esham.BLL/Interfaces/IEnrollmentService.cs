using System.Security.Claims;
using esham.BLL.DTOs;
using esham.BLL.DTOs.Enrollments;
namespace esham.BLL.Interfaces;

public interface IEnrollmentService
{
    Task<ServiceResult<EnrollmentPurchase>> PurchaseAsync(ClaimsPrincipal actor, PurchaseEnrollmentRequest request, CancellationToken ct = default);
    Task<ServiceResult<EnrollmentPage>> ListAsync(ClaimsPrincipal actor, int page = 1, int pageSize = 20, CancellationToken ct = default);
    Task<ServiceResult<EnrollmentDetail>> GetAsync(ClaimsPrincipal actor, Guid id, CancellationToken ct = default);
    Task<ServiceResult<PurchaseAvailability>> AvailabilityAsync(ClaimsPrincipal actor, CancellationToken ct = default);
}
public interface IEnrollmentPurchaseGate
{
    Task<bool> IsEnabledAsync(CancellationToken ct = default);
}
