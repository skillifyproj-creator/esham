using System.Security.Claims;
using esham.BLL.DTOs;
using esham.BLL.DTOs.UserCategories;

namespace esham.BLL.Interfaces;

public interface IUserCategoryService
{
    Task<ServiceResult<UserCategoriesResponseDto>> GetCurrentAsync(ClaimsPrincipal principal, CancellationToken ct = default);
    Task<ServiceResult<UserCategoriesResponseDto>> ReplaceCurrentAsync(ClaimsPrincipal principal,
        string kind, ReplaceUserCategoriesRequest request, CancellationToken ct = default);
}
