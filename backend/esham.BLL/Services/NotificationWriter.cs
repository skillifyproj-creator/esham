using System.Security.Cryptography;
using System.Text;
using esham.BLL.DTOs.Notifications;
using esham.BLL.Interfaces;
using esham.DAL.Data;
using esham.DAL.Entities;
using Microsoft.EntityFrameworkCore;

namespace esham.BLL.Services;

public sealed class NotificationWriter(AppDbContext db) : INotificationWriter
{
    public static Guid WelcomeId(string accountId) => new(SHA256.HashData(
        Encoding.UTF8.GetBytes("esham:welcome-notification:v1:" + accountId)).AsSpan(0, 16));

    public async Task<bool> StageAsync(CreateNotification notification, CancellationToken ct = default)
    {
        if (db.Database.CurrentTransaction is null)
            throw new InvalidOperationException("Notification creation requires the business caller's transaction.");
        if (notification.Id == Guid.Empty || string.IsNullOrWhiteSpace(notification.RecipientUserId) || notification.RecipientUserId.Length > 450
            || string.IsNullOrWhiteSpace(notification.NotificationType) || notification.NotificationType.Length > 64
            || notification.TitleAr?.Length > 200 || notification.TitleEn?.Length > 200
            || notification.MessageAr?.Length > 2000 || notification.MessageEn?.Length > 2000
            || (string.IsNullOrWhiteSpace(notification.TitleAr) && string.IsNullOrWhiteSpace(notification.TitleEn))
            || (string.IsNullOrWhiteSpace(notification.MessageAr) && string.IsNullOrWhiteSpace(notification.MessageEn)))
            throw new ArgumentException("Provide a stable notification GUID, recipient, type and valid localized content.");
        if (!await db.Users.AnyAsync(x => x.Id == notification.RecipientUserId, ct))
            throw new ArgumentException("The notification recipient must already exist.");
        var existing = db.Notifications.Local.SingleOrDefault(x => x.Id == notification.Id)
            ?? await db.Notifications.AsNoTracking().SingleOrDefaultAsync(x => x.Id == notification.Id, ct);
        if (existing is not null)
        {
            if (existing.RecipientUserId != notification.RecipientUserId || existing.NotificationType != notification.NotificationType
                || existing.TitleAr != notification.TitleAr || existing.TitleEn != notification.TitleEn
                || existing.MessageAr != notification.MessageAr || existing.MessageEn != notification.MessageEn)
                throw new InvalidOperationException("A notification ID cannot be reused for a different event payload or recipient.");
            return false; // Do not reset read state or timestamps on replay.
        }
        db.Notifications.Add(new Notification { Id = notification.Id, RecipientUserId = notification.RecipientUserId,
            NotificationType = notification.NotificationType, TitleAr = notification.TitleAr, TitleEn = notification.TitleEn,
            MessageAr = notification.MessageAr, MessageEn = notification.MessageEn });
        return true;
    }
}
