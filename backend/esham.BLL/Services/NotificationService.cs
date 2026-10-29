using System.Data;
using System.Security.Claims;
using esham.BLL.DTOs;
using esham.BLL.DTOs.Notifications;
using esham.BLL.Interfaces;
using esham.DAL.Data;
using esham.DAL.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace esham.BLL.Services;

public sealed class NotificationService(AppDbContext db, UserManager<ApplicationUser> users) : INotificationService
{
    private static ServiceResult<T> Unauthorized<T>() => ServiceResult<T>.Fail(ServiceFailure.Unauthenticated, "A valid current account session is required.");
    private async Task<ApplicationUser?> CurrentAsync(ClaimsPrincipal principal)
    {
        if (principal.Identity?.IsAuthenticated != true) return null;
        var user = await users.GetUserAsync(principal);
        return user is null || await users.IsLockedOutAsync(user) ? null : user;
    }

    public async Task<ServiceResult<NotificationPage>> GetCurrentAsync(ClaimsPrincipal principal, NotificationQuery query, CancellationToken ct = default)
    {
        var user = await CurrentAsync(principal);
        if (user is null) return Unauthorized<NotificationPage>();
        if (query.Page < 1 || query.PageSize is < 1 or > 100 || (long)(query.Page - 1) * query.PageSize > int.MaxValue)
            return ServiceResult<NotificationPage>.Fail(ServiceFailure.Validation, "Page must be positive and pageSize between 1 and 100, with a valid offset.");
        var selected = db.Notifications.AsNoTracking().Where(x => x.RecipientUserId == user.Id);
        if (query.IsRead.HasValue) selected = selected.Where(x => x.IsRead == query.IsRead.Value);
        var total = await selected.CountAsync(ct);
        var items = await selected.OrderByDescending(x => x.CreatedAt).ThenByDescending(x => x.Id)
            .Skip((query.Page - 1) * query.PageSize).Take(query.PageSize)
            .Select(x => new NotificationDto(x.Id, x.NotificationType, x.TitleAr, x.TitleEn, x.MessageAr, x.MessageEn,
                x.CreatedAt, x.IsRead, x.ReadAt)).ToListAsync(ct);
        return ServiceResult<NotificationPage>.Ok(new(user.Id, items, query.Page, query.PageSize, total));
    }

    public async Task<ServiceResult<NotificationUnreadCount>> GetUnreadCountAsync(ClaimsPrincipal principal, CancellationToken ct = default)
    {
        var user = await CurrentAsync(principal);
        return user is null ? Unauthorized<NotificationUnreadCount>() : ServiceResult<NotificationUnreadCount>.Ok(new(user.Id,
            await db.Notifications.CountAsync(x => x.RecipientUserId == user.Id && !x.IsRead, ct)));
    }

    public Task<ServiceResult<NotificationReadResult>> MarkReadAsync(ClaimsPrincipal principal, string id, CancellationToken ct = default) =>
        MarkAsync(principal, id, ct);
    public Task<ServiceResult<NotificationReadResult>> MarkAllReadAsync(ClaimsPrincipal principal, CancellationToken ct = default) =>
        MarkAsync(principal, null, ct);

    private async Task<ServiceResult<NotificationReadResult>> MarkAsync(ClaimsPrincipal principal, string? id, CancellationToken ct)
    {
        if (principal.Identity?.IsAuthenticated != true) return Unauthorized<NotificationReadResult>();
        Guid? notificationId = null;
        if (id is not null)
        {
            if (!Guid.TryParseExact(id, "D", out var parsed) || parsed == Guid.Empty)
                return ServiceResult<NotificationReadResult>.Fail(ServiceFailure.Validation, "A nonempty notification GUID is required.");
            notificationId = parsed;
        }
        var userId = users.GetUserId(principal);
        if (userId is null) return Unauthorized<NotificationReadResult>();
        try
        {
            return await db.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
            {
                db.ChangeTracker.Clear();
                await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
                var user = db.Database.IsSqlServer()
                    ? await db.Users.FromSqlInterpolated($"SELECT * FROM [AspNetUsers] WITH (UPDLOCK, HOLDLOCK) WHERE [Id] = {userId}").SingleOrDefaultAsync(ct)
                    : await db.Users.SingleOrDefaultAsync(x => x.Id == userId, ct);
                if (user is null || await users.IsLockedOutAsync(user)) return Unauthorized<NotificationReadResult>();
                var owned = db.Notifications.Where(x => x.RecipientUserId == user.Id);
                var now = DateTimeOffset.UtcNow;
                if (!notificationId.HasValue && db.Database.IsSqlServer())
                {
                    // Set-based read-all avoids loading message bodies or an unbounded
                    // tracked inbox, while retaining the same user lock/transaction.
                    var updated = await owned.Where(x => !x.IsRead).ExecuteUpdateAsync(setters => setters
                        .SetProperty(x => x.IsRead, true).SetProperty(x => x.ReadAt, (DateTimeOffset?)now), ct);
                    await transaction.CommitAsync(ct);
                    return ServiceResult<NotificationReadResult>.Ok(new(user.Id, updated));
                }
                List<Notification> selected;
                if (notificationId.HasValue)
                {
                    var item = await owned.SingleOrDefaultAsync(x => x.Id == notificationId.Value, ct);
                    if (item is null) return ServiceResult<NotificationReadResult>.Fail(ServiceFailure.NotFound, "Notification not found.");
                    selected = item.IsRead ? [] : [item];
                }
                else selected = await owned.Where(x => !x.IsRead).ToListAsync(ct);
                foreach (var item in selected) { item.IsRead = true; item.ReadAt = now; }
                if (selected.Count > 0) await db.SaveChangesAsync(ct);
                await transaction.CommitAsync(ct);
                return ServiceResult<NotificationReadResult>.Ok(new(user.Id, selected.Count));
            });
        }
        finally { db.ChangeTracker.Clear(); }
    }
}
