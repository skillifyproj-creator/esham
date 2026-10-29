using System.Security.Claims;
using esham.BLL.DTOs.Notifications;
using esham.BLL.Interfaces;

namespace esham.PL.Endpoints;

public static class NotificationEndpoints
{
    public static IEndpointRouteBuilder MapNotificationEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/me/notifications").RequireAuthorization().WithTags("Notifications");
        group.MapGet("", async (HttpContext context, INotificationService service, int? page, int? pageSize, bool? isRead, CancellationToken ct) =>
            (await service.GetCurrentAsync(context.User, new(page ?? 1, pageSize ?? 20, isRead), ct)).ToHttp())
            .WithName("GetCurrentNotifications").Produces<NotificationPage>().ProducesValidationProblem().Produces(401);
        group.MapGet("/unread-count", async (HttpContext context, INotificationService service, CancellationToken ct) =>
            (await service.GetUnreadCountAsync(context.User, ct)).ToHttp())
            .WithName("GetCurrentUnreadNotificationCount").Produces<NotificationUnreadCount>().Produces(401);
        var writes = group.MapGroup("").AddEndpointFilter<AdminMutationFilter>().AddEndpointFilter<NotificationAccountFilter>();
        writes.MapPatch("/{id}/read", async (string id, HttpContext context, INotificationService service, CancellationToken ct) =>
            (await service.MarkReadAsync(context.User, id, ct)).ToHttp())
            .WithName("MarkCurrentNotificationRead").Produces<NotificationReadResult>().ProducesValidationProblem().Produces(401).Produces(403).ProducesProblem(404).ProducesProblem(409);
        writes.MapPatch("/read-all", async (HttpContext context, INotificationService service, CancellationToken ct) =>
            (await service.MarkAllReadAsync(context.User, ct)).ToHttp())
            .WithName("MarkAllCurrentNotificationsRead").Produces<NotificationReadResult>().Produces(401).Produces(403).ProducesProblem(409);
        return endpoints;
    }
}

// This header is only a session precondition, never the recipient query source.
// It prevents stale account A UI from issuing read-all against a newly switched B cookie.
public sealed class NotificationAccountFilter : IEndpointFilter
{
    public ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        var expected = context.HttpContext.Request.Headers["X-Esham-Account-Id"].ToString();
        var actual = context.HttpContext.User.FindFirstValue(ClaimTypes.NameIdentifier);
        return !string.IsNullOrEmpty(actual) && expected == actual ? next(context)
            : ValueTask.FromResult<object?>(Results.Problem(statusCode: 409, title: "The account session changed. Refresh before marking notifications."));
    }
}
