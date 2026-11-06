using esham.BLL.Services;
namespace esham.PL.Endpoints;
public static class AdminIntegrationEndpoints
{
    public static IEndpointRouteBuilder MapAdminIntegrationEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var g=endpoints.MapGroup("/api/admin").RequireAuthorization().WithTags("Admin integration");
        g.MapGet("/overview",async(HttpContext c,AdminIntegrationService s,CancellationToken ct)=>(await s.Overview(c.User,ct)).ToHttp());
        g.MapGet("/categories",async(HttpContext c,AdminIntegrationService s,CancellationToken ct)=>(await s.Categories(c.User,ct)).ToHttp());
        g.MapGet("/category-admins",async(HttpContext c,AdminIntegrationService s,CancellationToken ct)=>(await s.Administrators(c.User,ct)).ToHttp());
        g.MapGet("/categories/{id:guid}/assignments",async(Guid id,HttpContext c,AdminIntegrationService s,CancellationToken ct)=>(await s.Assignments(id,c.User,ct)).ToHttp());
        g.MapPut("/categories/{id:guid}/assignments",async(Guid id,AssignmentInput input,HttpContext c,AdminIntegrationService s,CancellationToken ct)=>(await s.SetAssignments(id,c.User,input,ct)).ToHttp()).AddEndpointFilter<AdminMutationFilter>();
        return endpoints;
    }
}
