using System.Security.Claims;
using esham.BLL.DTOs;
using esham.BLL.DTOs.AdminUsers;

namespace esham.BLL.Interfaces;

public interface IAdminUserService
{
    Task<ServiceResult<AdminUserPage>> GetUsersAsync(ClaimsPrincipal actor, AdminUserQuery query, CancellationToken ct = default);
    Task<ServiceResult<AdminUserDto>> GetUserAsync(ClaimsPrincipal actor, string id, CancellationToken ct = default);
    Task<ServiceResult<AdminUserDto>> UpdateRolesAsync(ClaimsPrincipal actor, string id, UpdateAdminUserRolesRequest request, CancellationToken ct = default);
    Task<ServiceResult<AdminUserDto>> UpdateLockoutAsync(ClaimsPrincipal actor, string id, UpdateAdminUserLockoutRequest request, CancellationToken ct = default);
}
