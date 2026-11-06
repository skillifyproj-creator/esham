using esham.BLL.DTOs.Moderation;
using esham.BLL.Services;
namespace esham.PL.Endpoints;

public static class PlatformModerationEndpoints
{
    public static IEndpointRouteBuilder MapPlatformModerationEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/announcements",async(HttpContext ctx,AnnouncementService service,CancellationToken ct)=>(await service.ListAsync(ctx.User,false,ct)).ToHttp()).AllowAnonymous().WithTags("Announcements");
        var announcements=endpoints.MapGroup("/api/admin/announcements").RequireAuthorization().WithTags("Announcements");
        announcements.MapGet("",async(HttpContext ctx,AnnouncementService service,CancellationToken ct)=>(await service.ListAsync(ctx.User,true,ct)).ToHttp());
        announcements.MapPost("",async(AnnouncementInput input,HttpContext ctx,AnnouncementService service,CancellationToken ct)=>(await service.SaveAsync(ctx.User,null,input,ct)).ToHttp()).AddEndpointFilter<AdminMutationFilter>();
        announcements.MapPut("/{id:guid}",async(Guid id,AnnouncementInput input,HttpContext ctx,AnnouncementService service,CancellationToken ct)=>(await service.SaveAsync(ctx.User,id,input,ct)).ToHttp()).AddEndpointFilter<AdminMutationFilter>();
        announcements.MapPut("/{id:guid}/status",async(Guid id,AnnouncementStateRequest input,HttpContext ctx,AnnouncementService service,CancellationToken ct)=>(await service.SetStatusAsync(ctx.User,id,input,ct)).ToHttp()).AddEndpointFilter<AdminMutationFilter>();
        endpoints.MapGet("/api/admin/activity",async(HttpContext ctx,AdminActivityService service,CancellationToken ct)=>(await service.ListAsync(ctx.User,ct)).ToHttp()).RequireAuthorization().WithTags("Admin activity");
        endpoints.MapGet("/api/course-reports",async(HttpContext ctx,CourseSafetyService service,bool? mine,CancellationToken ct)=>(await service.ListReportsAsync(ctx.User,mine==true,ct)).ToHttp()).RequireAuthorization().WithTags("Course safety");
        endpoints.MapGet("/api/course-safety",async(HttpContext ctx,CourseSafetyService service,CancellationToken ct)=>(await service.ListCasesAsync(ctx.User,ct)).ToHttp()).RequireAuthorization().WithTags("Course safety");
        var course=endpoints.MapGroup("/api/courses/{courseId:guid}").RequireAuthorization().WithTags("Course safety");
        course.MapPost("/reports",async(Guid courseId,FileCourseReportRequest input,HttpContext ctx,CourseSafetyService service,CancellationToken ct)=>(await service.FileReportAsync(courseId,ctx.User,input,ct)).ToHttp()).AddEndpointFilter<AdminMutationFilter>();
        course.MapPut("/reports/{reportId:guid}",async(Guid courseId,Guid reportId,ResolveCourseReportRequest input,HttpContext ctx,CourseSafetyService service,CancellationToken ct)=>(await service.ResolveReportAsync(courseId,reportId,ctx.User,input,ct)).ToHttp()).AddEndpointFilter<AdminMutationFilter>();
        course.MapGet("/safety",async(Guid courseId,Guid? versionId,HttpContext ctx,CourseSafetyService service,CancellationToken ct)=>(await service.GetAsync(courseId,ctx.User,versionId,ct)).ToHttp());
        course.MapPost("/warnings",async(Guid courseId,IssueCourseWarningRequest input,HttpContext ctx,CourseSafetyService service,CancellationToken ct)=>(await service.WarnAsync(courseId,ctx.User,input,ct)).ToHttp()).AddEndpointFilter<AdminMutationFilter>();
        course.MapPost("/suspend",async(Guid courseId,SuspendCourseRequest input,HttpContext ctx,CourseSafetyService service,CancellationToken ct)=>(await service.SuspendAsync(courseId,ctx.User,input,ct)).ToHttp()).AddEndpointFilter<AdminMutationFilter>();
        course.MapPost("/appeals",async(Guid courseId,SubmitCourseAppealRequest input,HttpContext ctx,CourseSafetyService service,CancellationToken ct)=>(await service.AppealAsync(courseId,ctx.User,input,ct)).ToHttp()).AddEndpointFilter<AdminMutationFilter>();
        course.MapPost("/appeals/{appealId:guid}/decision",async(Guid courseId,Guid appealId,DecideCourseAppealRequest input,HttpContext ctx,CourseSafetyService service,CancellationToken ct)=>(await service.DecideAppealAsync(courseId,appealId,ctx.User,input,ct)).ToHttp()).AddEndpointFilter<AdminMutationFilter>();
        return endpoints;
    }
}
