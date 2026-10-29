namespace esham.BLL.DTOs.Notifications;

public sealed record NotificationQuery(int Page = 1, int PageSize = 20, bool? IsRead = null);
public sealed record NotificationDto(Guid Id, string NotificationType, string? TitleAr, string? TitleEn,
    string? MessageAr, string? MessageEn, DateTimeOffset CreatedAt, bool IsRead, DateTimeOffset? ReadAt);
public sealed record NotificationPage(string AccountId, IReadOnlyList<NotificationDto> Items, int Page, int PageSize, int TotalCount);
public sealed record NotificationUnreadCount(string AccountId, int UnreadCount);
public sealed record NotificationReadResult(string AccountId, int UpdatedCount);

// Internal business-event input only. There is intentionally no HTTP creation route.
public sealed record CreateNotification(Guid Id, string RecipientUserId, string NotificationType,
    string? TitleAr, string? TitleEn, string? MessageAr, string? MessageEn);
