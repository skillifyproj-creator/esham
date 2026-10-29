using esham.BLL.DTOs.UserCategories;
using esham.BLL.Interfaces;

namespace esham.PL.Endpoints;

public static class UserCategoryEndpoints
{
    public static IEndpointRouteBuilder MapUserCategoryEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/me/categories").RequireAuthorization().WithTags("User Categories");
        group.MapGet("", async (HttpContext context, IUserCategoryService service, CancellationToken ct) =>
            (await service.GetCurrentAsync(context.User, ct)).ToHttp())
            .WithName("GetCurrentUserCategories").Produces<UserCategoriesResponseDto>().Produces(401).Produces(403);
        group.MapPut("/{kind}", async (string kind, ReplaceUserCategoriesRequest request,
            HttpContext context, IUserCategoryService service, CancellationToken ct) =>
            (await service.ReplaceCurrentAsync(context.User, kind, request, ct)).ToHttp())
            .WithName("ReplaceCurrentUserCategories").Produces<UserCategoriesResponseDto>()
            .ProducesValidationProblem().Produces(401).Produces(403).ProducesProblem(409);
        return endpoints;
    }
}
