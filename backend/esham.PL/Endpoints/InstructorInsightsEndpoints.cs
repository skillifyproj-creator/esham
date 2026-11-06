using esham.BLL.Services;
using esham.BLL.Interfaces;
using esham.BLL.DTOs;
namespace esham.PL.Endpoints;
public static class InstructorInsightsEndpoints
{
    public static IEndpointRouteBuilder MapInstructorInsightsEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var g=endpoints.MapGroup("/api/instructor").RequireAuthorization().WithTags("Instructor insights");
        g.MapGet("/dashboard",async(HttpContext c,InstructorInsightsService s,CancellationToken ct)=>(await s.Analytics(c.User,null,"all",ct)).ToHttp());
        g.MapGet("/performance",async(Guid? courseId,string? period,HttpContext c,InstructorInsightsService s,CancellationToken ct)=>(await s.Analytics(c.User,courseId,period??"all",ct)).ToHttp());
        g.MapGet("/reviews",async(Guid? courseId,int? page,HttpContext c,InstructorInsightsService s,CancellationToken ct)=>(await s.Reviews(c.User,courseId,page??1,ct)).ToHttp());
        g.MapGet("/submissions",async(string? status,int? page,HttpContext c,InstructorInsightsService s,CancellationToken ct)=>(await s.Submissions(c.User,status,null,page??1,ct)).ToHttp());
        g.MapGet("/submissions/{id:guid}",async(Guid id,HttpContext c,InstructorInsightsService s,CancellationToken ct)=>(await s.Submissions(c.User,null,id,1,ct)).ToHttp());
        g.MapPost("/submissions/{id:guid}/review",async(Guid id,InstructorReviewInput input,HttpContext c,InstructorInsightsService s,CancellationToken ct)=>(await s.Review(c.User,id,input,ct)).ToHttp()).AddEndpointFilter<AdminMutationFilter>();
        g.MapGet("/submissions/{id:guid}/attachments/{attachmentId:guid}",async(Guid id,Guid attachmentId,HttpContext c,InstructorInsightsService s,IMediaStorage storage,CancellationToken ct)=>{
            var result=await s.Attachment(c.User,id,attachmentId,ct);
            if(result.Failure!=ServiceFailure.None)return result.ToHttp();
            var file=result.Value!;var stream=await storage.OpenAsync(file.StorageKey,ct);
            c.Response.Headers.CacheControl="private, no-store";c.Response.Headers["X-Content-Type-Options"]="nosniff";
            return stream==null?Results.NotFound():Results.File(stream,"application/octet-stream",file.OriginalFileName);
        });
        return endpoints;
    }
}
