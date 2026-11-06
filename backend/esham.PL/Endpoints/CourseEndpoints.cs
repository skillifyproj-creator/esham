using esham.BLL.DTOs.Courses;
using esham.BLL.Interfaces;
namespace esham.PL.Endpoints;

public static class CourseEndpoints
{
    public static IEndpointRouteBuilder MapCourseEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/courses").WithTags("Courses");
        group.MapGet("/public", async (ICourseService service, CancellationToken ct) => Results.Ok(await service.GetPublicAsync(ct)))
            .AllowAnonymous().WithSummary("List eligible approved public course cards").Produces<List<PublicCourseResponseDto>>();
        group.MapGet("/public/{id:guid}", async (Guid id, ICourseService service, CancellationToken ct) => (await service.GetPublicAsync(id, ct)).ToHttp())
            .AllowAnonymous().WithSummary("Read approved published course metadata; never returns a draft")
            .Produces<PublicCourseResponseDto>().ProducesProblem(404);
        group.MapGet("/public/{id:guid}/cover", async (Guid id, ICourseService service, esham.DAL.Data.AppDbContext db,
            esham.BLL.Interfaces.IMediaStorage storage, HttpContext context, CancellationToken ct) =>
        {
            // Authorize only the currently visible published cover; no generic public media route.
            context.Response.Headers.CacheControl = "no-store";
            context.Response.Headers["X-Content-Type-Options"] = "nosniff";
            var course = await service.GetPublicAsync(id, ct);
            if (course.Failure != esham.BLL.DTOs.ServiceFailure.None) return course.ToHttp();
            var coverId = course.Value!.CoverMedia?.Id;
            var asset = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.SingleOrDefaultAsync(
                db.MediaAssets.Where(x => x.Id == coverId), ct);
            if (asset == null || asset.MediaType != "image" || asset.MimeType is not ("image/png" or "image/jpeg" or "image/webp")) return Results.NotFound();
            var stream = await storage.OpenAsync(asset.StorageKey, ct);
            return stream == null ? Results.NotFound() : Results.Stream(stream, asset.MimeType);
        }).AllowAnonymous().WithSummary("Read only an eligible published course cover image");
        var instructor = group.MapGroup("").RequireAuthorization().AddEndpointFilter(new IdentityRoleFilter("Instructor"));
        instructor.MapGet("/{id:guid}/draft/submission-eligibility", async (Guid id, HttpContext context, ICourseSubmissionEligibilityService service, CancellationToken ct) =>
            (await service.GetAsync(id, IdentityRoleFilter.Actor(context), ct)).ToHttp()).Produces<SubmissionEligibilityResponse>();
        instructor.MapPost("", async (CreateCourseRequest request, HttpContext context, ICourseService service, CancellationToken ct) =>
        {
            var result = await service.CreateAsync(IdentityRoleFilter.Actor(context), request, ct);
            return result.ToHttp(result.Value is null ? null : $"/api/courses/{result.Value.CourseId}");
        }).WithSummary("Create a course and version 1 draft atomically (Instructor)").Produces<CourseDetailResponseDto>(201)
            .ProducesValidationProblem().Produces(401).Produces(403).ProducesProblem(409);
        instructor.MapGet("/mine", async (HttpContext context, ICourseService service, CancellationToken ct) =>
            (await service.GetMineAsync(IdentityRoleFilter.Actor(context), ct)).ToHttp())
            .WithSummary("List only the current instructor's courses").Produces<List<InstructorCourseSummaryDto>>()
            .Produces(401).Produces(403);
        instructor.MapGet("/{id:guid}/draft", async (Guid id, HttpContext context, ICourseService service, CancellationToken ct) =>
            (await service.GetDraftAsync(id, IdentityRoleFilter.Actor(context), ct)).ToHttp())
            .WithSummary("Read the owner's current draft").Produces<CourseVersionResponseDto>()
            .Produces(401).Produces(403).ProducesProblem(404);
        instructor.MapPatch("/{id:guid}/draft", async (Guid id, UpdateCourseDraftRequest request, HttpContext context, ICourseService service, CancellationToken ct) =>
            (await service.UpdateDraftAsync(id, IdentityRoleFilter.Actor(context), request, ct)).ToHttp())
            .WithSummary("Patch supplied draft fields; explicit null clears optional text or cover")
            .Produces<CourseVersionResponseDto>().ProducesValidationProblem().Produces(401).Produces(403).ProducesProblem(404).ProducesProblem(409);
        group.MapGet("/{id:guid}", async (Guid id, HttpContext context, ICourseService service, CancellationToken ct) =>
            (await service.GetAsync(id, IdentityRoleFilter.Actor(context), ct)).ToHttp())
            .RequireAuthorization().AddEndpointFilter(new IdentityRoleFilter("Instructor", "GeneralAdmin"))
            .WithSummary("Read private course summaries (owner instructor or GeneralAdmin)")
            .Produces<CourseDetailResponseDto>().Produces(401).Produces(403).ProducesProblem(404);
        return endpoints;
    }
}
