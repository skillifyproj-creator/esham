using esham.BLL.DTOs.Completion;
using esham.BLL.Services;
namespace esham.PL.Endpoints;
public static class CompletionEndpoints
{
    public static IEndpointRouteBuilder MapCompletionEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var g=endpoints.MapGroup("/me/enrollments/{enrollmentId:guid}/completion").RequireAuthorization().AddEndpointFilter<FinancialResponseFilter>().WithTags("Completion");
        g.MapGet("",async(Guid enrollmentId,HttpContext c,EnrollmentCompletionService s,CancellationToken ct)=>(await s.GetAsync(c.User,enrollmentId,ct)).ToHttp());
        g.MapPost("/reconcile",async(Guid enrollmentId,ReconcileCompletion request,HttpContext c,EnrollmentCompletionService s,CancellationToken ct)=>(await s.ReconcileAsync(c.User,enrollmentId,request.ExpectedCourseVersionId,ct)).ToHttp())
            .AddEndpointFilter<AdminMutationFilter>().AddEndpointFilter<EnrollmentAccountFilter>();
        var cert=endpoints.MapGroup("/me/certificates").RequireAuthorization().AddEndpointFilter<FinancialResponseFilter>().WithTags("Certificates");
        cert.MapGet("",async(int? page,int? pageSize,HttpContext c,CertificateService s,CancellationToken ct)=>(await s.ListAsync(c.User,page??1,pageSize??20,ct)).ToHttp());
        cert.MapGet("/{id:guid}",async(Guid id,HttpContext c,CertificateService s,CancellationToken ct)=>(await s.GetAsync(c.User,id,ct)).ToHttp());
        endpoints.MapGet("/certificates/verify/{code}",async(string code,HttpContext c,CertificateService s,CancellationToken ct)=>{
            c.Response.Headers.CacheControl="no-store";c.Response.Headers["X-Robots-Tag"]="noindex, nofollow";c.Response.Headers["Referrer-Policy"]="no-referrer";
            return (await s.VerifyAsync(code,ct)).ToHttp();
        }).RequireRateLimiting("certificate-verification");
        endpoints.MapPost("/admin/certificates/{id:guid}/revoke",async(Guid id,RevokeCertificate request,HttpContext c,CertificateService s,CancellationToken ct)=>(await s.RevokeAsync(c.User,id,request.Reason,ct)).ToHttp())
            .RequireAuthorization().AddEndpointFilter<AdminMutationFilter>().AddEndpointFilter<EnrollmentAccountFilter>().AddEndpointFilter<FinancialResponseFilter>();
        return endpoints;
    }
}
