using esham.BLL.DTOs;
using esham.BLL.DTOs.Learning;
using esham.BLL.Interfaces;
namespace esham.PL.Endpoints;
public static class LearnerLearningEndpoints
{
    public static IEndpointRouteBuilder MapLearnerLearningEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var g = endpoints.MapGroup("/me/enrollments/{enrollmentId:guid}").RequireAuthorization()
            .AddEndpointFilter<FinancialResponseFilter>().WithTags("Learner learning");
        g.MapGet("/learning", async (Guid enrollmentId, HttpContext c, ILearnerLearningService s, CancellationToken ct) => (await s.GetAsync(c.User, enrollmentId, ct)).ToHttp());
        g.MapGet("/progress", async (Guid enrollmentId, HttpContext c, ILearnerLearningService s, CancellationToken ct) => (await s.GetAsync(c.User, enrollmentId, ct)).ToHttp());
        g.MapGet("/learning/lessons/{lessonId:guid}", async (Guid enrollmentId, Guid lessonId, HttpContext c, ILearnerLearningService s, CancellationToken ct) => (await s.LessonAsync(c.User, enrollmentId, lessonId, ct)).ToHttp());
        g.MapMethods("/learning/lessons/{lessonId:guid}/video", ["GET", "HEAD"], async (Guid enrollmentId, Guid lessonId, HttpContext c, ILearnerLearningService s, CancellationToken ct) =>
            Media(await s.MediaAsync(c.User, enrollmentId, lessonId, null, ct)));
        g.MapMethods("/learning/lessons/{lessonId:guid}/attachments/{attachmentId:guid}/content", ["GET", "HEAD"], async (Guid enrollmentId, Guid lessonId, Guid attachmentId, HttpContext c, ILearnerLearningService s, CancellationToken ct) =>
            Media(await s.MediaAsync(c.User, enrollmentId, lessonId, attachmentId, ct)));
        var writes = g.MapGroup("/learning/lessons/{lessonId:guid}").AddEndpointFilter<AdminMutationFilter>().AddEndpointFilter<EnrollmentAccountFilter>();
        writes.MapPost("/open", async (Guid enrollmentId, Guid lessonId, ProgressWrite request, HttpContext c, ILessonProgressService s, CancellationToken ct) =>
            Progress(await s.WriteAsync(c.User, enrollmentId, lessonId, request, true, ct)));
        writes.MapPut("/progress", async (Guid enrollmentId, Guid lessonId, ProgressWrite request, HttpContext c, ILessonProgressService s, CancellationToken ct) =>
            Progress(await s.WriteAsync(c.User, enrollmentId, lessonId, request, ct: ct)));
        writes.MapPut("/completion", async (Guid enrollmentId, Guid lessonId, CompleteLesson request, HttpContext c, ILessonProgressService s, CancellationToken ct) =>
            Progress(await s.CompleteAsync(c.User, enrollmentId, lessonId, request, ct)));
        return endpoints;
    }
    private static IResult Progress(ServiceResult<ProgressState> result) => result.Code == "progress_conflict"
        ? Results.Problem(statusCode: 409, title: result.Message, extensions: new Dictionary<string, object?> { ["code"] = result.Code, ["canonicalState"] = result.Value }) : result.ToHttp();
    private static IResult Media(ServiceResult<LearningMedia> result) => result.Value is { } media
        ? Results.File(media.Stream, media.ContentType, fileDownloadName: media.DownloadName, enableRangeProcessing: true) : result.ToHttp();
}
