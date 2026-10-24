using esham.BLL.DTOs.Categories;
using esham.BLL.Interfaces;
namespace esham.PL.Endpoints;

public static class CategoryEndpoints
{
    public static IEndpointRouteBuilder MapCategoryEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/categories").WithTags("Categories");
        group.MapGet("", async (ICategoryService service, CancellationToken ct) => Results.Ok(await service.GetActiveAsync(ct)))
            .AllowAnonymous().WithSummary("List active categories").Produces<List<CategoryResponseDto>>();
        group.MapGet("/{id:guid}", async (Guid id, ICategoryService service, CancellationToken ct) => (await service.GetAsync(id, ct)).ToHttp())
            .AllowAnonymous().WithSummary("Read an active category").Produces<CategoryResponseDto>().ProducesProblem(404);
        group.MapGet("/{id:guid}/children", async (Guid id, ICategoryService service, CancellationToken ct) => (await service.GetChildrenAsync(id, ct)).ToHttp())
            .AllowAnonymous().WithSummary("List active immediate children").Produces<List<CategoryResponseDto>>().ProducesProblem(404);
        var writes = group.MapGroup("").RequireAuthorization().AddEndpointFilter(new IdentityRoleFilter("GeneralAdmin"));
        writes.MapPost("", async (CreateCategoryRequest request, ICategoryService service, CancellationToken ct) =>
        {
            var result = await service.CreateAsync(request, ct);
            return result.ToHttp(result.Value is null ? null : $"/api/categories/{result.Value.Id}");
        }).WithSummary("Create a category (GeneralAdmin)").Produces<CategoryResponseDto>(201)
            .ProducesValidationProblem().Produces(401).Produces(403).ProducesProblem(409);
        writes.MapPut("/{id:guid}", async (Guid id, UpdateCategoryRequest request, ICategoryService service, CancellationToken ct) =>
            (await service.UpdateAsync(id, request, ct)).ToHttp())
            .WithSummary("Replace category metadata (GeneralAdmin)").Produces<CategoryResponseDto>()
            .ProducesValidationProblem().Produces(401).Produces(403).ProducesProblem(404).ProducesProblem(409);
        writes.MapPatch("/{id:guid}/status", async (Guid id, ChangeCategoryStatusRequest request, ICategoryService service, CancellationToken ct) =>
            (await service.ChangeStatusAsync(id, request.IsActive, ct)).ToHttp())
            .WithSummary("Activate or deactivate a category (GeneralAdmin)").Produces<CategoryResponseDto>()
            .Produces(401).Produces(403).ProducesProblem(404).ProducesProblem(409);
        return endpoints;
    }
}
