using esham.BLL.Services;
namespace esham.PL.Endpoints;
public static class AnnouncementFeedEndpoints
{
    public static IEndpointRouteBuilder MapAnnouncementFeedEndpoints(this IEndpointRouteBuilder routes){
        var group=routes.MapGroup("/me/announcements").RequireAuthorization().AddEndpointFilter<FinancialResponseFilter>();
        group.MapGet("",async(HttpContext c,AnnouncementDeliveryService s,int? page,int? pageSize,CancellationToken ct)=>(await s.FeedAsync(c.User,page??1,pageSize??20,ct:ct)).ToHttp());
        group.MapGet("/{id:guid}",async(Guid id,HttpContext c,AnnouncementDeliveryService s,CancellationToken ct)=>(await s.FeedAsync(c.User,id:id,ct:ct)).ToHttp());return routes;
    }
}
