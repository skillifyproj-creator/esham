using esham.BLL.DTOs;
using esham.BLL.DTOs.Courses;
using esham.BLL.Interfaces;
using Microsoft.AspNetCore.Http.Features;
namespace esham.PL.Endpoints;
public static class CourseCoverEndpoints
{
    public static IEndpointRouteBuilder MapCourseCoverEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/courses/{courseId:guid}/draft/cover").WithTags("Draft Course Cover")
            .RequireAuthorization().AddEndpointFilter(new IdentityRoleFilter("Instructor"));
        group.MapGet("", async (Guid courseId, HttpContext ctx, ICourseCoverService service, CancellationToken ct) =>
            (await service.GetAsync(courseId, IdentityRoleFilter.Actor(ctx), ct)).ToHttp()).Produces<CourseCoverResponse>();
        group.MapPut("", async (Guid courseId, HttpContext ctx, ICourseCoverService service, CancellationToken ct) =>
        {
            if (ctx.Request.Headers["X-Requested-With"] != "XMLHttpRequest") return Results.Problem("An application request header is required.", statusCode: 400);
            var limit = ctx.Features.Get<IHttpMaxRequestBodySizeFeature>();
            if (limit is { IsReadOnly: false }) limit.MaxRequestBodySize = 2L * 1024 * 1024;
            if (ctx.Request.ContentLength > 2L * 1024 * 1024) return Results.StatusCode(413);
            if (!Guid.TryParse(ctx.Request.Headers["X-Upload-Id"], out var uploadId)) return Results.Problem("Invalid upload identity.", statusCode: 400);
            string name;
            try { name = Uri.UnescapeDataString(ctx.Request.Headers["X-File-Name"].ToString()); }
            catch (UriFormatException) { return Results.Problem("Invalid filename.", statusCode: 400); }
            return (await service.UploadAsync(courseId, IdentityRoleFilter.Actor(ctx), new(uploadId, name, ctx.Request.ContentType ?? ""), ctx.Request.Body, ct)).ToHttp();
        }).Accepts<Stream>("image/png", "image/jpeg", "image/webp").Produces<CourseCoverResponse>();
        group.MapGet("/{assetId:guid}/content", async (Guid courseId, Guid assetId, HttpContext ctx, ICourseCoverService service, CancellationToken ct) =>
        {
            var result = await service.OpenAsync(courseId, assetId, IdentityRoleFilter.Actor(ctx), ct);
            ctx.Response.Headers.CacheControl = "private, no-store"; ctx.Response.Headers["X-Content-Type-Options"] = "nosniff";
            return result.Failure == ServiceFailure.None ? Results.File(result.Value.Stream, result.Value.ContentType) : result.ToHttp();
        });
        return endpoints;
    }
}
