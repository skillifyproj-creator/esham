using System.Globalization;
using esham.BLL.DTOs;
using esham.BLL.DTOs.Courses;
using esham.BLL.Interfaces;
using Microsoft.AspNetCore.Http.Features;
namespace esham.PL.Endpoints;

public static class LessonMediaEndpoints
{
    public static IEndpointRouteBuilder MapLessonMediaEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/courses/{courseId:guid}/draft/sections/{sectionId:guid}/lessons/{lessonId:guid}/media")
            .WithTags("Draft Lesson Media").RequireAuthorization().AddEndpointFilter(new IdentityRoleFilter("Instructor"));
        group.AddEndpointFilter(async (context, next) =>
        {
            var request = context.HttpContext.Request;
            if (request.Method is "POST" or "DELETE" && request.Headers["X-Requested-With"] != "XMLHttpRequest")
                return Results.Problem("An application request header is required.", statusCode: 400);
            return await next(context);
        });
        group.MapGet("", async (Guid courseId, Guid sectionId, Guid lessonId, HttpContext ctx, ILessonMediaService service, CancellationToken ct) =>
            (await service.GetAsync(courseId, sectionId, lessonId, IdentityRoleFilter.Actor(ctx), ct)).ToHttp()).Produces<List<LessonMediaResponse>>();
        group.MapPost("/normalize", async (Guid courseId, Guid sectionId, Guid lessonId, HttpContext ctx, ILessonMediaService service, CancellationToken ct) =>
            (await service.NormalizeAsync(courseId, sectionId, lessonId, IdentityRoleFilter.Actor(ctx), ct)).ToHttp()).Produces<List<LessonMediaResponse>>();
        group.MapPost("", async (Guid courseId, Guid sectionId, Guid lessonId, HttpContext ctx, ILessonMediaService service, CancellationToken ct) =>
        {
            var limit = ctx.Features.Get<IHttpMaxRequestBodySizeFeature>();
            if (limit is { IsReadOnly: false }) limit.MaxRequestBodySize = 2L * 1024 * 1024 * 1024;
            if (ctx.Request.ContentLength > 2L * 1024 * 1024 * 1024) return Results.StatusCode(413);
            if (!Guid.TryParse(ctx.Request.Headers["X-Upload-Id"], out var uploadId)
                || !double.TryParse(ctx.Request.Headers["X-Video-Duration"], NumberStyles.Float, CultureInfo.InvariantCulture, out var duration)
                || (ctx.Request.Headers.ContainsKey("X-Source-Media-Id") && !Guid.TryParse(ctx.Request.Headers["X-Source-Media-Id"], out _))
                || (ctx.Request.Headers.ContainsKey("X-Replace-Attachment-Id") && !Guid.TryParse(ctx.Request.Headers["X-Replace-Attachment-Id"], out _)))
                return Results.Problem("Invalid upload metadata.", statusCode: 400);
            Guid? source = Guid.TryParse(ctx.Request.Headers["X-Source-Media-Id"], out var sourceId) ? sourceId : null;
            Guid? replace = Guid.TryParse(ctx.Request.Headers["X-Replace-Attachment-Id"], out var replaceId) ? replaceId : null;
            string name;
            try { name = Uri.UnescapeDataString(ctx.Request.Headers["X-File-Name"].ToString()); }
            catch (UriFormatException) { return Results.Problem("Invalid filename.", statusCode: 400); }
            return (await service.UploadAsync(courseId, sectionId, lessonId, IdentityRoleFilter.Actor(ctx),
                new(uploadId, name, ctx.Request.ContentType ?? "", duration, source, replace), ctx.Request.Body, ct)).ToHttp();
        }).Accepts<Stream>("video/mp4", "video/webm", "video/quicktime").Produces<LessonMediaResponse>();
        group.MapDelete("/{attachmentId:guid}", async (Guid courseId, Guid sectionId, Guid lessonId, Guid attachmentId, HttpContext ctx, ILessonMediaService service, CancellationToken ct) =>
            (await service.DetachAsync(courseId, sectionId, lessonId, attachmentId, IdentityRoleFilter.Actor(ctx), ct)).ToHttp()).Produces<bool>();
        group.MapGet("/{attachmentId:guid}/content", async (Guid courseId, Guid sectionId, Guid lessonId, Guid attachmentId, HttpContext ctx, ILessonMediaService service, CancellationToken ct) =>
        {
            var result = await service.OpenAsync(courseId, sectionId, lessonId, attachmentId, IdentityRoleFilter.Actor(ctx), ct);
            ctx.Response.Headers.CacheControl = "private, no-store";
            ctx.Response.Headers["X-Content-Type-Options"] = "nosniff";
            return result.Failure != ServiceFailure.None ? result.ToHttp()
                : Results.File(result.Value.Stream, result.Value.ContentType, enableRangeProcessing: true);
        }).Produces(200).Produces(206).Produces(404);
        return endpoints;
    }
}
