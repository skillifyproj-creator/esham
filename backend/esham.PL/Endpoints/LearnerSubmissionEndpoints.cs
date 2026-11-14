using esham.BLL.DTOs;
using esham.BLL.DTOs.Learning;
using esham.BLL.DTOs.Submissions;
using esham.BLL.Interfaces;
using Microsoft.AspNetCore.Http.Features;
namespace esham.PL.Endpoints;
public static class LearnerSubmissionEndpoints
{
    public static IEndpointRouteBuilder MapLearnerSubmissionEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var g = endpoints.MapGroup("/me/enrollments/{enrollmentId:guid}").RequireAuthorization().AddEndpointFilter<FinancialResponseFilter>().WithTags("Learner tasks and submissions");
        g.MapGet("/tasks", async(Guid enrollmentId,HttpContext c,ILearnerSubmissionService s,CancellationToken ct) => (await s.TasksAsync(c.User,enrollmentId,ct)).ToHttp());
        g.MapGet("/tasks/{taskId:guid}", async(Guid enrollmentId,Guid taskId,HttpContext c,ILearnerSubmissionService s,CancellationToken ct) => (await s.TaskAsync(c.User,enrollmentId,taskId,ct)).ToHttp());
        g.MapGet("/submissions", async(Guid enrollmentId,Guid? taskId,int? page,HttpContext c,ILearnerSubmissionService s,CancellationToken ct) => (await s.HistoryAsync(c.User,enrollmentId,taskId,page ?? 1,ct)).ToHttp());
        g.MapGet("/submissions/{id:guid}", async(Guid enrollmentId,Guid id,HttpContext c,ILearnerSubmissionService s,CancellationToken ct) => (await s.DetailAsync(c.User,enrollmentId,id,ct)).ToHttp());
        g.MapMethods("/tasks/{taskId:guid}/attachments/{attachmentId:guid}/content", ["GET","HEAD"], async(Guid enrollmentId,Guid taskId,Guid attachmentId,HttpContext c,ILearnerSubmissionService s,CancellationToken ct) => Media(await s.FileAsync(c.User,enrollmentId,taskId,attachmentId,true,ct)));
        g.MapMethods("/submissions/{id:guid}/attachments/{attachmentId:guid}/content", ["GET","HEAD"], async(Guid enrollmentId,Guid id,Guid attachmentId,HttpContext c,ILearnerSubmissionService s,CancellationToken ct) => Media(await s.FileAsync(c.User,enrollmentId,id,attachmentId,false,ct)));
        var w = g.MapGroup("").AddEndpointFilter<AdminMutationFilter>().AddEndpointFilter<EnrollmentAccountFilter>();
        w.MapPost("/tasks/{taskId:guid}/submissions", async(Guid enrollmentId,Guid taskId,CreateAttempt request,HttpContext c,ILearnerSubmissionService s,CancellationToken ct) => Result(await s.CreateAsync(c.User,enrollmentId,taskId,request,ct)));
        w.MapPut("/submissions/{id:guid}/draft", async(Guid enrollmentId,Guid id,SaveDraft request,HttpContext c,ILearnerSubmissionService s,CancellationToken ct) => Result(await s.SaveAsync(c.User,enrollmentId,id,request,ct)));
        w.MapPost("/submissions/{id:guid}/submit", async(Guid enrollmentId,Guid id,FinalizeAttempt request,HttpContext c,ILearnerSubmissionService s,CancellationToken ct) => Result(await s.SubmitAsync(c.User,enrollmentId,id,request,ct)));
        w.MapDelete("/submissions/{id:guid}/attachments/{attachmentId:guid}", async(Guid enrollmentId,Guid id,Guid attachmentId,HttpContext c,ILearnerSubmissionService s,CancellationToken ct) => {
            var request = await c.Request.ReadFromJsonAsync<AttachmentMutation>(ct);
            return request == null ? Results.BadRequest() : Result(await s.RemoveAsync(c.User,enrollmentId,id,attachmentId,request,ct));
        });
        w.MapPost("/submissions/{id:guid}/attachments", async(Guid enrollmentId,Guid id,HttpContext c,ILearnerSubmissionService s,ISubmissionMutationGate gate,CancellationToken ct) => {
            if (!await gate.IsEnabledAsync(ct)) return Results.Problem(statusCode:403,title:"Submission mutations disabled.",extensions:new Dictionary<string,object?> { ["code"]="submission_disabled" });
            const long limit = 10 * 1024 * 1024 + 65536;
            var feature = c.Features.Get<IHttpMaxRequestBodySizeFeature>(); if (feature is { IsReadOnly:false }) feature.MaxRequestBodySize = limit;
            if (c.Request.ContentLength > limit) return Results.StatusCode(413);
            if (!c.Request.HasFormContentType) return Results.StatusCode(415);
            try {
                var form = await c.Request.ReadFormAsync(new FormOptions { MultipartBodyLengthLimit=limit, ValueCountLimit=8, ValueLengthLimit=4096 },ct);
                if (form.Files.Count != 1 || !Guid.TryParse(form["uploadId"],out var upload) || !Guid.TryParse(form["expectedTaskVersionId"],out var version)) return Results.BadRequest();
                var file = form.Files[0]; await using var content = file.OpenReadStream();
                return Result(await s.UploadAsync(c.User,enrollmentId,id,new(upload,version,form["expectedDraftToken"],file.FileName,file.ContentType,content),ct));
            } catch (InvalidDataException) { return Results.BadRequest(new { code="invalid_attachment" }); }
        }).DisableAntiforgery(); // Explicit trusted-origin + account filters protect multipart writes.
        return endpoints;
    }
    private static IResult Result(ServiceResult<SubmissionDetail> result) => result.Code == "draft_conflict" ? Results.Problem(statusCode:409,title:result.Message,
        extensions:new Dictionary<string,object?> { ["code"]=result.Code,["canonicalState"]=result.Value }) : result.ToHttp();
    private static IResult Media(ServiceResult<LearningMedia> result) => result.Value is { } f ? Results.File(f.Stream,f.ContentType,f.DownloadName,enableRangeProcessing:true) : result.ToHttp();
}
