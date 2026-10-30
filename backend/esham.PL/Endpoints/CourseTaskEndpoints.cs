using esham.BLL.DTOs.Courses;
using esham.BLL.Interfaces;
namespace esham.PL.Endpoints;

public static class CourseTaskEndpoints
{
    public static IEndpointRouteBuilder MapCourseTaskEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/courses/{courseId:guid}/draft/tasks").WithTags("Draft Course Tasks")
            .RequireAuthorization().AddEndpointFilter(new IdentityRoleFilter("Instructor"));
        group.MapGet("", async (Guid courseId, HttpContext ctx, ICourseTaskService service, CancellationToken ct) =>
            (await service.GetAllAsync(courseId, IdentityRoleFilter.Actor(ctx), ct)).ToHttp()).Produces<List<CourseTaskResponse>>();
        group.MapGet("/{taskId:guid}", async (Guid courseId, Guid taskId, HttpContext ctx, ICourseTaskService service, CancellationToken ct) =>
            (await service.GetAsync(courseId, taskId, IdentityRoleFilter.Actor(ctx), ct)).ToHttp()).Produces<CourseTaskResponse>();
        group.MapPost("", async (Guid courseId, CourseTaskRequest request, HttpContext ctx, ICourseTaskService service, CancellationToken ct) =>
        {
            var result = await service.SaveAsync(courseId, null, IdentityRoleFilter.Actor(ctx), request, ct);
            return result.ToHttp(result.Value is null ? null : $"/api/courses/{courseId}/draft/tasks/{result.Value.Id}");
        }).Produces<CourseTaskResponse>(201);
        group.MapPut("/{taskId:guid}", async (Guid courseId, Guid taskId, CourseTaskRequest request, HttpContext ctx, ICourseTaskService service, CancellationToken ct) =>
            (await service.SaveAsync(courseId, taskId, IdentityRoleFilter.Actor(ctx), request, ct)).ToHttp()).Produces<CourseTaskResponse>();
        group.MapDelete("/{taskId:guid}", async (Guid courseId, Guid taskId, HttpContext ctx, ICourseTaskService service, CancellationToken ct) =>
            (await service.DeleteAsync(courseId, taskId, IdentityRoleFilter.Actor(ctx), ct)).ToHttp()).Produces<bool>();
        group.MapPut("/reorder", async (Guid courseId, ReorderRequest request, HttpContext ctx, ICourseTaskService service, CancellationToken ct) =>
            (await service.ReorderAsync(courseId, IdentityRoleFilter.Actor(ctx), request, ct)).ToHttp()).Produces<bool>();
        group.MapGet("/readiness", async (Guid courseId, HttpContext ctx, ICourseTaskService service, CancellationToken ct) =>
            (await service.GetReadinessAsync(courseId, IdentityRoleFilter.Actor(ctx), ct)).ToHttp())
            .WithSummary("Task count readiness only; full submission validation is a later feature").Produces<TaskReadinessResponse>();
        ((IEndpointConventionBuilder)group).Add(builder =>
        {
            builder.Metadata.Add(new Microsoft.AspNetCore.Http.ProducesResponseTypeMetadata(400, typeof(HttpValidationProblemDetails), ["application/problem+json"]));
            foreach (var status in new[] { 401, 403, 404, 409 }) builder.Metadata.Add(new Microsoft.AspNetCore.Http.ProducesResponseTypeMetadata(status));
        });
        return endpoints;
    }
}
