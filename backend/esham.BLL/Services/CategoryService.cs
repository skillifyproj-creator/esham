using System.Data;
using System.Linq.Expressions;
using esham.BLL.DTOs;
using esham.BLL.DTOs.Categories;
using esham.BLL.Interfaces;
using esham.DAL.Data;
using esham.DAL.Entities;
using Microsoft.EntityFrameworkCore;
namespace esham.BLL.Services;

public sealed class CategoryService(AppDbContext db) : ICategoryService
{
    private static readonly Expression<Func<Category, CategoryResponseDto>> Projection = x => new(
        x.Id, x.NameAr, x.NameEn, x.DescriptionAr, x.DescriptionEn, x.ParentCategoryId,
        x.DisplayOrder, x.IsActive, x.CreatedAt, x.UpdatedAt);
    private static CategoryResponseDto Map(Category x) => new(x.Id, x.NameAr, x.NameEn,
        x.DescriptionAr, x.DescriptionEn, x.ParentCategoryId, x.DisplayOrder, x.IsActive, x.CreatedAt, x.UpdatedAt);

    public async Task<IReadOnlyList<CategoryResponseDto>> GetActiveAsync(CancellationToken ct = default) =>
        await db.Categories.AsNoTracking().Where(x => x.IsActive).OrderBy(x => x.DisplayOrder)
            .ThenBy(x => x.NameAr).ThenBy(x => x.Id).Select(Projection).ToListAsync(ct);
    public async Task<ServiceResult<CategoryResponseDto>> GetAsync(Guid id, CancellationToken ct = default)
    {
        var value = await db.Categories.AsNoTracking().Where(x => x.Id == id && x.IsActive).Select(Projection).SingleOrDefaultAsync(ct);
        return value is null ? ServiceResult<CategoryResponseDto>.Fail(ServiceFailure.NotFound, "Active category not found.") : ServiceResult<CategoryResponseDto>.Ok(value);
    }
    public async Task<ServiceResult<IReadOnlyList<CategoryResponseDto>>> GetChildrenAsync(Guid id, CancellationToken ct = default)
    {
        if (!await db.Categories.AsNoTracking().AnyAsync(x => x.Id == id && x.IsActive, ct))
            return ServiceResult<IReadOnlyList<CategoryResponseDto>>.Fail(ServiceFailure.NotFound, "Active parent category not found.");
        return ServiceResult<IReadOnlyList<CategoryResponseDto>>.Ok(await db.Categories.AsNoTracking()
            .Where(x => x.ParentCategoryId == id && x.IsActive).OrderBy(x => x.DisplayOrder).ThenBy(x => x.Id).Select(Projection).ToListAsync(ct));
    }
    private static string? Validate(string? ar, string? en, string? descriptionAr, string? descriptionEn, int order)
    {
        if (string.IsNullOrWhiteSpace(ar) || string.IsNullOrWhiteSpace(en)) return "Both Arabic and English names are required by the current category model.";
        if (ar.Trim().Length > 200 || en.Trim().Length > 200) return "Category names must not exceed 200 characters.";
        if (descriptionAr?.Length > 2000 || descriptionEn?.Length > 2000) return "Descriptions must not exceed 2000 characters.";
        return order < 0 ? "DisplayOrder cannot be negative." : null;
    }
    public Task<ServiceResult<CategoryResponseDto>> CreateAsync(CreateCategoryRequest request, CancellationToken ct = default) =>
        SaveAsync(Guid.NewGuid(), request.NameAr, request.NameEn, request.DescriptionAr, request.DescriptionEn,
            request.ParentCategoryId, request.DisplayOrder, true, ct);
    public Task<ServiceResult<CategoryResponseDto>> UpdateAsync(Guid id, UpdateCategoryRequest request, CancellationToken ct = default) =>
        SaveAsync(id, request.NameAr, request.NameEn, request.DescriptionAr, request.DescriptionEn,
            request.ParentCategoryId, request.DisplayOrder, false, ct);

    private async Task<ServiceResult<CategoryResponseDto>> SaveAsync(Guid id, string? ar, string? en,
        string? descriptionAr, string? descriptionEn, Guid? parentId, int order, bool create, CancellationToken ct)
    {
        var error = Validate(ar, en, descriptionAr, descriptionEn, order);
        if (error is not null) return ServiceResult<CategoryResponseDto>.Fail(ServiceFailure.Validation, error);
        if (parentId == id) return ServiceResult<CategoryResponseDto>.Fail(ServiceFailure.Validation, "A category cannot be its own parent.");
        return await db.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
        {
            db.ChangeTracker.Clear();
            // Serialize tree edits so concurrent valid-looking reparent operations cannot introduce a cycle.
            await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
            var category = await db.Categories.SingleOrDefaultAsync(x => x.Id == id, ct);
            if (!create && category is null) return ServiceResult<CategoryResponseDto>.Fail(ServiceFailure.NotFound, "Category not found.");
            // Idempotent result when a creation commit succeeded but its acknowledgement was lost.
            if (create && category is not null) return ServiceResult<CategoryResponseDto>.Ok(Map(category));
            if (parentId.HasValue)
            {
                var parents = await db.Categories.AsNoTracking().Select(x => new { x.Id, x.ParentCategoryId }).ToDictionaryAsync(x => x.Id, x => x.ParentCategoryId, ct);
                if (!parents.ContainsKey(parentId.Value)) return ServiceResult<CategoryResponseDto>.Fail(ServiceFailure.Validation, "Parent category does not exist.");
                var seen = new HashSet<Guid>();
                Guid? cursor = parentId;
                while (cursor.HasValue)
                {
                    if (cursor == id || !seen.Add(cursor.Value)) return ServiceResult<CategoryResponseDto>.Fail(ServiceFailure.Validation, "The parent relationship would create or join a category cycle.");
                    if (!parents.TryGetValue(cursor.Value, out cursor)) return ServiceResult<CategoryResponseDto>.Fail(ServiceFailure.Conflict, "The category hierarchy is inconsistent.");
                }
            }
            var now = DateTimeOffset.UtcNow;
            category ??= new Category { Id = id, CreatedAt = now };
            category.NameAr = ar!.Trim(); category.NameEn = en!.Trim();
            category.DescriptionAr = descriptionAr?.Trim(); category.DescriptionEn = descriptionEn?.Trim();
            category.ParentCategoryId = parentId; category.DisplayOrder = order; category.UpdatedAt = now;
            if (create) db.Categories.Add(category);
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            return ServiceResult<CategoryResponseDto>.Ok(Map(category));
        });
    }
    public async Task<ServiceResult<CategoryResponseDto>> ChangeStatusAsync(Guid id, bool isActive, CancellationToken ct = default)
    {
        return await db.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
        {
            db.ChangeTracker.Clear();
            await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
            var category = await db.Categories.SingleOrDefaultAsync(x => x.Id == id, ct);
            if (category is null) return ServiceResult<CategoryResponseDto>.Fail(ServiceFailure.NotFound, "Category not found.");
            category.IsActive = isActive; category.UpdatedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(ct); await transaction.CommitAsync(ct);
            return ServiceResult<CategoryResponseDto>.Ok(Map(category));
        });
    }
}
