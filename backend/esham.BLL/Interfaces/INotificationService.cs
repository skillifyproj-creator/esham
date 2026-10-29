using System.Security.Claims;
using esham.BLL.DTOs;
using esham.BLL.DTOs.Notifications;

namespace esham.BLL.Interfaces;

public interface INotificationService
{
    Task<ServiceResult<NotificationPage>> GetCurrentAsync(ClaimsPrincipal principal, NotificationQuery query, CancellationToken ct = default);
    Task<ServiceResult<NotificationUnreadCount>> GetUnreadCountAsync(ClaimsPrincipal principal, CancellationToken ct = default);
    Task<ServiceResult<NotificationReadResult>> MarkReadAsync(ClaimsPrincipal principal, string id, CancellationToken ct = default);
    Task<ServiceResult<NotificationReadResult>> MarkAllReadAsync(ClaimsPrincipal principal, CancellationToken ct = default);
}

public interface INotificationWriter
{
    // Stages in the caller's existing transaction; never saves or commits it.
    Task<bool> StageAsync(CreateNotification notification, CancellationToken ct = default);
}
