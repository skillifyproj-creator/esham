using esham.BLL.DTOs;
using esham.BLL.DTOs.Categories;
namespace esham.BLL.Interfaces;
public interface ICategoryService
{
    Task<IReadOnlyList<CategoryResponseDto>> GetActiveAsync(CancellationToken ct = default);
    Task<ServiceResult<CategoryResponseDto>> GetAsync(Guid id, CancellationToken ct = default);
    Task<ServiceResult<IReadOnlyList<CategoryResponseDto>>> GetChildrenAsync(Guid id, CancellationToken ct = default);
    Task<ServiceResult<CategoryResponseDto>> CreateAsync(CreateCategoryRequest request, CancellationToken ct = default);
    Task<ServiceResult<CategoryResponseDto>> UpdateAsync(Guid id, UpdateCategoryRequest request, CancellationToken ct = default);
    Task<ServiceResult<CategoryResponseDto>> ChangeStatusAsync(Guid id, bool isActive, CancellationToken ct = default);
}
