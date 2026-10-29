using System.Data;
using System.Data.Common;
using esham.DAL.Data;
using esham.DAL.Entities;
using esham.BLL.DTOs;
using esham.BLL.DTOs.Notifications;
using esham.BLL.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
using static esham.Tests.AccountFinalizationTests;
using static esham.Tests.AccountFinalizationSqlServerTests;
using static esham.Tests.NotificationTests;

namespace esham.Tests;

public sealed class NotificationSqlServerTests
{
    [AccountSqlServerFact]
    public async Task Concurrent_mark_one_and_all_update_only_owned_unread_rows_without_resetting_read_times()
    {
        using var provider = DatabaseServices(); string a, b; Guid one, alreadyRead; DateTimeOffset? originalRead;
        using (var setup = provider.CreateScope())
        {
            var s = setup.ServiceProvider; a = await Seed(s); b = await Seed(s); var db = s.GetRequiredService<AppDbContext>();
            var first = Item(a); var read = Item(a, read: true); one = first.Id; alreadyRead = read.Id; originalRead = read.ReadAt;
            db.Notifications.AddRange(first, Item(a), Item(a), read, Item(b)); await db.SaveChangesAsync();
        }
        var gate = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        async Task<int> Mark(bool all)
        {
            await gate.Task; using var scope = provider.CreateScope(); var service = Service(scope.ServiceProvider);
            var result = all ? await service.MarkAllReadAsync(Principal(a)) : await service.MarkReadAsync(Principal(a), one.ToString());
            Assert.Equal(ServiceFailure.None, result.Failure); return result.Value!.UpdatedCount;
        }
        var tasks = new[] { Mark(true), Mark(false), Mark(false) }; gate.SetResult();
        Assert.Equal(3, (await Task.WhenAll(tasks)).Sum());
        using var verify = provider.CreateScope(); var v = verify.ServiceProvider; var db2 = v.GetRequiredService<AppDbContext>();
        Assert.Equal(0, (await Service(v).GetUnreadCountAsync(Principal(a))).Value!.UnreadCount);
        Assert.Equal(1, (await Service(v).GetUnreadCountAsync(Principal(b))).Value!.UnreadCount);
        Assert.Equal(originalRead, (await db2.Notifications.SingleAsync(x => x.Id == alreadyRead)).ReadAt);
    }

    [AccountSqlServerFact]
    public async Task Failure_after_read_save_rolls_back_the_read_flag_and_timestamp()
    {
        var failure = new FailAfterReadSave(); using var provider = DatabaseServices(failure);
        using var scope = provider.CreateScope(); var s = scope.ServiceProvider; var user = await Seed(s);
        var db = s.GetRequiredService<AppDbContext>(); var notification = Item(user); db.Notifications.Add(notification); await db.SaveChangesAsync();
        failure.Armed = true;
        await Assert.ThrowsAsync<InvalidOperationException>(() => Service(s).MarkReadAsync(Principal(user), notification.Id.ToString()));
        Assert.Empty(db.ChangeTracker.Entries()); var persisted = await db.Notifications.SingleAsync(x => x.Id == notification.Id);
        Assert.False(persisted.IsRead); Assert.Null(persisted.ReadAt);
    }

    [AccountSqlServerFact]
    public async Task Internal_creation_never_commits_the_callers_business_transaction()
    {
        using var provider = DatabaseServices(); using var scope = provider.CreateScope(); var s = scope.ServiceProvider;
        var user = await Seed(s); var db = s.GetRequiredService<AppDbContext>(); var id = Guid.NewGuid();
        await db.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
        {
            db.ChangeTracker.Clear(); await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
            var target = await db.Users.SingleAsync(x => x.Id == user); target.Bio = "Uncommitted business update";
            Assert.True(await new NotificationWriter(db).StageAsync(new(id, user, "test.transaction", null, "Title", null, "Message")));
            await db.SaveChangesAsync(); await transaction.RollbackAsync();
        });
        db.ChangeTracker.Clear(); Assert.False(await db.Notifications.AnyAsync(x => x.Id == id));
        Assert.Null((await db.Users.SingleAsync(x => x.Id == user)).Bio);
    }

    [AccountSqlServerFact]
    public async Task Failure_after_bulk_read_all_update_rolls_back_every_read_change()
    {
        var failure = new FailAfterBulkRead(); using var provider = DatabaseServices(failure);
        using var scope = provider.CreateScope(); var s = scope.ServiceProvider; var user = await Seed(s);
        var db = s.GetRequiredService<AppDbContext>(); db.Notifications.AddRange(Item(user), Item(user)); await db.SaveChangesAsync();
        failure.Armed = true;
        await Assert.ThrowsAsync<InvalidOperationException>(() => Service(s).MarkAllReadAsync(Principal(user)));
        Assert.Empty(db.ChangeTracker.Entries()); Assert.Equal(2, await db.Notifications.CountAsync(x => x.RecipientUserId == user && !x.IsRead && x.ReadAt == null));
    }

    private sealed class FailAfterBulkRead : DbCommandInterceptor
    {
        public bool Armed { get; set; }
        public override ValueTask<int> NonQueryExecutedAsync(DbCommand command, CommandExecutedEventData eventData,
            int result, CancellationToken cancellationToken = default)
        {
            if (Armed && command.CommandText.Contains("UPDATE", StringComparison.OrdinalIgnoreCase) && command.CommandText.Contains("Notifications", StringComparison.Ordinal))
            { Armed = false; throw new InvalidOperationException("Injected failure after bulk notification update."); }
            return ValueTask.FromResult(result);
        }
    }

    private sealed class FailAfterReadSave : SaveChangesInterceptor
    {
        public bool Armed { get; set; }
        public override ValueTask<int> SavedChangesAsync(SaveChangesCompletedEventData eventData, int result, CancellationToken cancellationToken = default)
        {
            if (Armed) { Armed = false; throw new InvalidOperationException("Injected failure after notification read save."); }
            return ValueTask.FromResult(result);
        }
    }
}
