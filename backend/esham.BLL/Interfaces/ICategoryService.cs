using esham.BLL.DTOs;
using esham.BLL.DTOs.Categories;
namespace esham.BLL.Interfaces;
public interface ICategoryService
{
    Task<IReadOnlyList<CategoryResponseDto>> GetActiveAsync(CancellationToken ct = default);
    Task<ServiceResult<CategoryResponseDto>> GetAsync(Guid id, CancellationToken ct = default);
    Task<ServiceResult<IReadOnlyList<CategoryResponseDto>>> GetChildrenAsync(Guid id, CancellationToken ct = default);
    Task<ServiceResult<CategoryResponseDto>> CreateAsync(CreateCategoryRequest request, CourseActor actor, CancellationToken ct = default);
    Task<ServiceResult<CategoryResponseDto>> UpdateAsync(Guid id, UpdateCategoryRequest request, CourseActor actor, CancellationToken ct = default);
    Task<ServiceResult<CategoryResponseDto>> ChangeStatusAsync(Guid id, bool isActive, CourseActor actor, CancellationToken ct = default);
}
