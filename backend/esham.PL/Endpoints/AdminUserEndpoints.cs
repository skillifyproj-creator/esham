using esham.BLL.DTOs.AdminUsers;
using esham.BLL.Interfaces;

namespace esham.PL.Endpoints;

public static class AdminUserEndpoints
{
    public static IEndpointRouteBuilder MapAdminUserEndpoints(this IEndpointRouteBuilder endpoints)
    {
        // The service independently rechecks database membership, including inside
        // write transactions. Claims/legacy personas never authorize these actions.
        var group = endpoints.MapGroup("/api/admin/users").RequireAuthorization().WithTags("Admin Users");
        group.MapGet("", async (HttpContext context, IAdminUserService service, int? page, int? pageSize,
            string? search, string? role, string? status, CancellationToken ct) =>
            (await service.GetUsersAsync(context.User, new(page ?? 1, pageSize ?? 20, search, role, status), ct)).ToHttp())
            .WithName("ListAdminUsers").Produces<AdminUserPage>().ProducesValidationProblem().Produces(401).Produces(403);
        group.MapGet("/{id}", async (string id, HttpContext context, IAdminUserService service, CancellationToken ct) =>
            (await service.GetUserAsync(context.User, id, ct)).ToHttp())
            .WithName("GetAdminUser").Produces<AdminUserDto>().ProducesValidationProblem().Produces(401).Produces(403).ProducesProblem(404);
        group.MapPut("/{id}/roles", async (string id, UpdateAdminUserRolesRequest request, HttpContext context,
            IAdminUserService service, CancellationToken ct) =>
            (await service.UpdateRolesAsync(context.User, id, request, ct)).ToHttp())
            .AddEndpointFilter<AdminMutationFilter>().WithName("UpdateAdminUserRoles")
            .Produces<AdminUserDto>().ProducesValidationProblem().Produces(401).Produces(403).ProducesProblem(404).ProducesProblem(409);
        group.MapPut("/{id}/lockout", async (string id, UpdateAdminUserLockoutRequest request, HttpContext context,
            IAdminUserService service, CancellationToken ct) =>
            (await service.UpdateLockoutAsync(context.User, id, request, ct)).ToHttp())
            .AddEndpointFilter<AdminMutationFilter>().WithName("UpdateAdminUserLockout")
            .Produces<AdminUserDto>().ProducesValidationProblem().Produces(401).Produces(403).ProducesProblem(404).ProducesProblem(409);
        return endpoints;
    }
}

public sealed class AdminMutationFilter : IEndpointFilter
{
    public ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        var request = context.HttpContext.Request;
        var origin = request.Headers.Origin.ToString();
        var allowedOrigins = context.HttpContext.RequestServices?.GetService<IConfiguration>()
            ?.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
        var ownOrigin = $"{request.Scheme}://{request.Host}";
        var validOrigin = string.IsNullOrEmpty(origin)
            ? request.Headers["Sec-Fetch-Site"].ToString() is not ("cross-site" or "same-site")
            : Uri.TryCreate(origin, UriKind.Absolute, out var parsed) && parsed.Scheme is "http" or "https"
                && string.IsNullOrEmpty(parsed.UserInfo) && parsed.AbsolutePath == "/" && string.IsNullOrEmpty(parsed.Query)
                && string.IsNullOrEmpty(parsed.Fragment)
                && (string.Equals(origin, ownOrigin, StringComparison.OrdinalIgnoreCase)
                    || allowedOrigins.Contains(origin, StringComparer.OrdinalIgnoreCase));
        return request.Headers["X-Requested-With"] == "XMLHttpRequest" && validOrigin
            ? next(context) : ValueTask.FromResult<object?>(Results.Problem(statusCode: 403, title: "A trusted authenticated application request is required."));
    }
}
