using esham.BLL.DTOs.Courses;
using esham.BLL.Interfaces;
namespace esham.PL.Endpoints;

public static class CurriculumEndpoints
{
    public static IEndpointRouteBuilder MapCurriculumEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/courses/{courseId:guid}/draft/sections")
            .WithTags("Draft Curriculum").RequireAuthorization().AddEndpointFilter(new IdentityRoleFilter("Instructor"));
        group.MapGet("", async (Guid courseId, HttpContext ctx, ICurriculumService service, CancellationToken ct) =>
            (await service.GetSectionsAsync(courseId, IdentityRoleFilter.Actor(ctx), ct)).ToHttp()).Produces<List<SectionResponse>>();
        group.MapGet("/readiness", async (Guid courseId, HttpContext ctx, ICurriculumService service, CancellationToken ct) =>
            (await service.GetReadinessAsync(courseId, IdentityRoleFilter.Actor(ctx), ct)).ToHttp()).Produces<CurriculumReadinessResponse>();
        group.MapPost("/{sectionId:guid}/lessons/readiness", async (Guid courseId, Guid sectionId, LessonReadinessPreviewRequest request, HttpContext ctx, ICurriculumService service, CancellationToken ct) =>
            (await service.PreviewLessonReadinessAsync(courseId, sectionId, IdentityRoleFilter.Actor(ctx), request, ct)).ToHttp()).Produces<LessonReadinessResponse>();
        group.MapPost("/ensure-default", async (Guid courseId, HttpContext ctx, ICurriculumService service, CancellationToken ct) =>
            (await service.EnsureDefaultSectionAsync(courseId, IdentityRoleFilter.Actor(ctx), ct)).ToHttp()).Produces<List<SectionResponse>>();
        group.MapPost("", async (Guid courseId, SectionRequest request, HttpContext ctx, ICurriculumService service, CancellationToken ct) =>
        {
            var result = await service.SaveSectionAsync(courseId, null, IdentityRoleFilter.Actor(ctx), request, ct);
            return result.ToHttp(result.Value is null ? null : $"/api/courses/{courseId}/draft/sections/{result.Value.Id}");
        }).Produces<SectionResponse>(201);
        group.MapPut("/{sectionId:guid}", async (Guid courseId, Guid sectionId, SectionRequest request, HttpContext ctx, ICurriculumService service, CancellationToken ct) =>
            (await service.SaveSectionAsync(courseId, sectionId, IdentityRoleFilter.Actor(ctx), request, ct)).ToHttp()).Produces<SectionResponse>();
        group.MapDelete("/{sectionId:guid}", async (Guid courseId, Guid sectionId, HttpContext ctx, ICurriculumService service, CancellationToken ct) =>
            (await service.DeleteSectionAsync(courseId, sectionId, IdentityRoleFilter.Actor(ctx), ct)).ToHttp()).Produces<bool>();
        group.MapPut("/reorder", async (Guid courseId, ReorderRequest request, HttpContext ctx, ICurriculumService service, CancellationToken ct) =>
            (await service.ReorderAsync(courseId, null, IdentityRoleFilter.Actor(ctx), request, ct)).ToHttp()).Produces<bool>();
        group.MapGet("/{sectionId:guid}/lessons", async (Guid courseId, Guid sectionId, HttpContext ctx, ICurriculumService service, CancellationToken ct) =>
            (await service.GetLessonsAsync(courseId, sectionId, IdentityRoleFilter.Actor(ctx), ct)).ToHttp()).Produces<List<LessonResponse>>();
        group.MapPost("/{sectionId:guid}/lessons", async (Guid courseId, Guid sectionId, LessonRequest request, HttpContext ctx, ICurriculumService service, CancellationToken ct) =>
        {
            var result = await service.SaveLessonAsync(courseId, sectionId, null, IdentityRoleFilter.Actor(ctx), request, ct);
            return result.ToHttp(result.Value is null ? null : $"/api/courses/{courseId}/draft/sections/{sectionId}/lessons/{result.Value.Id}");
        }).Produces<LessonResponse>(201);
        group.MapPut("/{sectionId:guid}/lessons/{lessonId:guid}", async (Guid courseId, Guid sectionId, Guid lessonId, LessonRequest request, HttpContext ctx, ICurriculumService service, CancellationToken ct) =>
            (await service.SaveLessonAsync(courseId, sectionId, lessonId, IdentityRoleFilter.Actor(ctx), request, ct)).ToHttp()).Produces<LessonResponse>();
        group.MapDelete("/{sectionId:guid}/lessons/{lessonId:guid}", async (Guid courseId, Guid sectionId, Guid lessonId, HttpContext ctx, ICurriculumService service, CancellationToken ct) =>
            (await service.DeleteLessonAsync(courseId, sectionId, lessonId, IdentityRoleFilter.Actor(ctx), ct)).ToHttp()).Produces<bool>();
        group.MapPut("/{sectionId:guid}/lessons/reorder", async (Guid courseId, Guid sectionId, ReorderRequest request, HttpContext ctx, ICurriculumService service, CancellationToken ct) =>
            (await service.ReorderAsync(courseId, sectionId, IdentityRoleFilter.Actor(ctx), request, ct)).ToHttp()).Produces<bool>();
        ((IEndpointConventionBuilder)group).Add(builder =>
        {
            builder.Metadata.Add(new Microsoft.AspNetCore.Http.ProducesResponseTypeMetadata(400, typeof(HttpValidationProblemDetails), ["application/problem+json"]));
            foreach (var status in new[] { 401, 403, 404, 409 })
                builder.Metadata.Add(new Microsoft.AspNetCore.Http.ProducesResponseTypeMetadata(status));
        });
        return endpoints;
    }
}
