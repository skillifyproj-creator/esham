using esham.BLL.Interfaces;
namespace esham.PL.Endpoints;
public static class EnrollmentVersionEndpoints
{
    public static IEndpointRouteBuilder MapEnrollmentVersionEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/me/enrollments/{enrollmentId:guid}/version-state", async (Guid enrollmentId, HttpContext ctx, ICourseVersionUpdates service, CancellationToken ct) =>
            (await service.GetStateAsync(enrollmentId, IdentityRoleFilter.Actor(ctx).UserId, ct)).ToHttp())
            .RequireAuthorization().AddEndpointFilter(new IdentityRoleFilter("Learner")).WithTags("Enrollment version availability");
        return endpoints;
    }
}
