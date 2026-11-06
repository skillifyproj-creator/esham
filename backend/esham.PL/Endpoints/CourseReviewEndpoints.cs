using esham.DAL.Data;
using Microsoft.EntityFrameworkCore;
using esham.BLL.DTOs;
using esham.BLL.DTOs.Courses;
using esham.BLL.Interfaces;
namespace esham.PL.Endpoints;
public static class CourseReviewEndpoints
{
    public static IEndpointRouteBuilder MapCourseReviewEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/courses/{courseId:guid}/review").WithTags("Course review").RequireAuthorization()
            .AddEndpointFilter(new IdentityRoleFilter("Instructor", "CategoryAdmin", "GeneralAdmin"));
        group.AddEndpointFilter(async (context, next) =>
        {
            if (context.HttpContext.Request.Method == "POST" && context.HttpContext.Request.Headers["X-Requested-With"] != "XMLHttpRequest")
                return Results.Problem("An application request header is required.", statusCode: 400);
            return await next(context);
        });
        group.MapGet("", async (Guid courseId, HttpContext ctx, ICourseReviewService service, CancellationToken ct) =>
            (await service.GetAsync(courseId, null, IdentityRoleFilter.Actor(ctx), ct)).ToHttp());
        group.MapGet("/versions/{versionId:guid}", async (Guid courseId, Guid versionId, HttpContext ctx, ICourseReviewService service, CancellationToken ct) =>
            (await service.GetAsync(courseId, versionId, IdentityRoleFilter.Actor(ctx), ct)).ToHttp());
        group.MapPost("/submit", async (Guid courseId, VersionActionRequest request, HttpContext ctx, ICourseReviewService service, CancellationToken ct) =>
            (await service.SubmitAsync(courseId, IdentityRoleFilter.Actor(ctx), request, ct)).ToHttp());
        group.MapPost("/revision", async (Guid courseId, VersionActionRequest request, HttpContext ctx, ICourseReviewService service, CancellationToken ct) =>
            (await service.ReviseAsync(courseId, IdentityRoleFilter.Actor(ctx), request, ct)).ToHttp());
        group.MapPost("/versions/{versionId:guid}/decision", async (Guid courseId, Guid versionId, ReviewDecisionRequest request, HttpContext ctx, ICourseReviewService service, CancellationToken ct) =>
            (await service.DecideAsync(courseId, versionId, IdentityRoleFilter.Actor(ctx), request, ct)).ToHttp());
        group.MapGet("/versions/{versionId:guid}/media/{assetId:guid}", async (Guid courseId, Guid versionId, Guid assetId, HttpContext ctx, ICourseReviewService service, CancellationToken ct) =>
        {
            var result = await service.OpenMediaAsync(courseId, versionId, assetId, IdentityRoleFilter.Actor(ctx), ct);
            ctx.Response.Headers.CacheControl = "private, no-store";
            ctx.Response.Headers["X-Content-Type-Options"] = "nosniff";
            return result.Failure == ServiceFailure.None ? Results.Stream(result.Value.Stream, result.Value.ContentType, enableRangeProcessing: true) : result.ToHttp();
        });
        endpoints.MapGet("/api/course-reviews", async (HttpContext ctx, ICourseReviewService service, string? status, CancellationToken ct) =>
            (await service.ListAsync(IdentityRoleFilter.Actor(ctx), status, ct)).ToHttp()).RequireAuthorization()
            .AddEndpointFilter(new IdentityRoleFilter("CategoryAdmin", "GeneralAdmin")).WithTags("Course review");
        endpoints.MapGet("/api/course-reviews/activity", async (HttpContext ctx, AppDbContext db, CancellationToken ct) =>
        {
            var actor = IdentityRoleFilter.Actor(ctx);
            var query = db.AdminActivityLogs.AsNoTracking().Where(x => x.TargetType == "CourseVersion" && x.CourseVersionId != null);
            if (!actor.IsGeneralAdmin) query = query.Where(x => db.CategoryAdminAssignments.Any(a => a.UserId == actor.UserId && a.CategoryId == x.CategoryId && a.IsActive));
            return Results.Ok(await query.OrderByDescending(x => x.CreatedAt).Take(200).Select(x => new { x.Id, x.CourseId, x.CourseVersionId, x.TargetName, x.Action, x.PreviousState, x.NewState, x.Details, x.CreatedAt }).ToListAsync(ct));
        }).RequireAuthorization().AddEndpointFilter(new IdentityRoleFilter("CategoryAdmin", "GeneralAdmin")).WithTags("Course review");
        return endpoints;
    }
}
