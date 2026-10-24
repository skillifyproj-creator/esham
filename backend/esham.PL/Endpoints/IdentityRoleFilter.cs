using esham.BLL.DTOs;
using esham.DAL.Entities;
using Microsoft.AspNetCore.Identity;
namespace esham.PL.Endpoints;

internal sealed class IdentityRoleFilter(params string[] allowedRoles) : IEndpointFilter
{
    internal const string ActorKey = "Esham.VerifiedCourseActor";
    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        if (context.HttpContext.User.Identity?.IsAuthenticated != true) return Results.Unauthorized();
        var manager = context.HttpContext.RequestServices.GetRequiredService<UserManager<ApplicationUser>>();
        var user = await manager.GetUserAsync(context.HttpContext.User);
        if (user is null) return Results.Unauthorized();
        var roles = await manager.GetRolesAsync(user);
        bool HasRole(string role) => roles.Contains(role, StringComparer.OrdinalIgnoreCase);
        if (!allowedRoles.Any(HasRole)) return Results.Forbid();
        context.HttpContext.Items[ActorKey] = new CourseActor(user.Id, HasRole("Instructor"), HasRole("GeneralAdmin"));
        return await next(context);
    }
    internal static CourseActor Actor(HttpContext context) => (CourseActor)context.Items[ActorKey]!;
}
