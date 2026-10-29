using System.Data;
using System.Security.Claims;
using System.Text.Json;
using esham.BLL.DTOs;
using esham.BLL.DTOs.Notifications;
using esham.BLL.Interfaces;
using esham.BLL.Services;
using esham.DAL.Data;
using esham.DAL.Entities;
using esham.PL.Endpoints;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
using static esham.Tests.AccountFinalizationTests;

namespace esham.Tests;

public sealed class NotificationTests
{
    internal static NotificationService Service(IServiceProvider s) => new(s.GetRequiredService<AppDbContext>(),
        s.GetRequiredService<Microsoft.AspNetCore.Identity.UserManager<ApplicationUser>>());
    internal static Notification Item(string recipient, Guid? id = null, DateTimeOffset? at = null, bool read = false) => new()
    {
        Id = id ?? Guid.NewGuid(), RecipientUserId = recipient, NotificationType = "test.message", TitleAr = "رسالة", TitleEn = "Message",
        MessageAr = "محتوى حقيقي", MessageEn = "Real message", CreatedAt = at ?? DateTimeOffset.UtcNow, IsRead = read,
        ReadAt = read ? DateTimeOffset.UtcNow.AddHours(-1) : null,
    };

    [Fact]
    public async Task Recipient_ownership_applies_to_list_count_mark_one_and_read_all_even_for_an_admin()
    {
        using var provider = Services(); using var scope = provider.CreateScope(); var s = scope.ServiceProvider;
        var a = await Seed(s); var b = await Seed(s, administrator: true); var db = s.GetRequiredService<AppDbContext>();
        var first = Item(a); var second = Item(b); db.Notifications.AddRange(first, second); await db.SaveChangesAsync();
        var service = Service(s);
        var inbox = (await service.GetCurrentAsync(Principal(a), new())).Value!;
        Assert.Equal(a, inbox.AccountId); Assert.Equal(first.Id, inbox.Items.Single().Id); Assert.Equal(1, inbox.TotalCount);
        Assert.Equal(1, (await service.GetUnreadCountAsync(Principal(b))).Value!.UnreadCount);
        Assert.Equal(ServiceFailure.NotFound, (await service.MarkReadAsync(Principal(b), first.Id.ToString())).Failure);
        Assert.Equal(ServiceFailure.NotFound, (await service.MarkReadAsync(Principal(a), Guid.NewGuid().ToString())).Failure);
        Assert.False((await db.Notifications.SingleAsync(x => x.Id == first.Id)).IsRead);
        Assert.Equal(1, (await service.MarkAllReadAsync(Principal(b))).Value!.UpdatedCount);
        Assert.Equal(1, (await service.GetUnreadCountAsync(Principal(a))).Value!.UnreadCount);
        Assert.False((await db.Notifications.SingleAsync(x => x.Id == first.Id)).IsRead);
        var json = JsonSerializer.Serialize(inbox.Items.Single());
        Assert.DoesNotContain("RecipientUser", json); Assert.DoesNotContain("UserId", json); Assert.DoesNotContain("CourseId", json);
    }

    [Fact]
    public async Task Pagination_read_filters_and_newest_first_order_have_a_deterministic_tie_breaker()
    {
        using var provider = Services(); using var scope = provider.CreateScope(); var s = scope.ServiceProvider;
        var user = await Seed(s); var db = s.GetRequiredService<AppDbContext>(); var now = DateTimeOffset.UtcNow;
        var older = Item(user, at: now.AddDays(-1), read: true);
        var a = Item(user, Guid.Parse("00000000-0000-0000-0000-000000000001"), now);
        var b = Item(user, Guid.Parse("00000000-0000-0000-0000-000000000002"), now);
        db.Notifications.AddRange(older, a, b); await db.SaveChangesAsync(); var service = Service(s);
        var first = (await service.GetCurrentAsync(Principal(user), new(PageSize: 1))).Value!;
        Assert.Equal(3, first.TotalCount); Assert.Equal(b.Id, first.Items.Single().Id);
        Assert.Equal(a.Id, (await service.GetCurrentAsync(Principal(user), new(Page: 2, PageSize: 1))).Value!.Items.Single().Id);
        Assert.Equal(older.Id, (await service.GetCurrentAsync(Principal(user), new(IsRead: true))).Value!.Items.Single().Id);
        Assert.Equal(2, (await service.GetCurrentAsync(Principal(user), new(IsRead: false))).Value!.TotalCount);
        Assert.Equal(2, (await service.GetUnreadCountAsync(Principal(user))).Value!.UnreadCount);
        Assert.Empty((await service.GetCurrentAsync(Principal(user), new(Page: 50))).Value!.Items);
    }

    [Fact]
    public async Task Read_updates_are_idempotent_and_preserve_the_first_read_timestamp()
    {
        using var provider = Services(); using var scope = provider.CreateScope(); var s = scope.ServiceProvider;
        var user = await Seed(s); var db = s.GetRequiredService<AppDbContext>();
        var a = Item(user); var b = Item(user); var read = Item(user, read: true); var firstRead = read.ReadAt;
        db.Notifications.AddRange(a, b, read); await db.SaveChangesAsync(); var service = Service(s);
        Assert.Equal(1, (await service.MarkReadAsync(Principal(user), a.Id.ToString())).Value!.UpdatedCount);
        var stamp = (await db.Notifications.SingleAsync(x => x.Id == a.Id)).ReadAt; Assert.NotNull(stamp);
        Assert.Equal(0, (await service.MarkReadAsync(Principal(user), a.Id.ToString())).Value!.UpdatedCount);
        Assert.Equal(stamp, (await db.Notifications.SingleAsync(x => x.Id == a.Id)).ReadAt);
        Assert.Equal(1, (await service.MarkAllReadAsync(Principal(user))).Value!.UpdatedCount);
        Assert.Equal(0, (await service.MarkAllReadAsync(Principal(user))).Value!.UpdatedCount);
        Assert.Equal(firstRead, (await db.Notifications.SingleAsync(x => x.Id == read.Id)).ReadAt);
        Assert.Equal(0, (await service.GetUnreadCountAsync(Principal(user))).Value!.UnreadCount);
    }

    [Theory]
    [InlineData("anonymous")] [InlineData("forged")] [InlineData("missing")] [InlineData("locked")]
    public async Task Personal_operations_require_a_valid_unlocked_current_account(string kind)
    {
        using var provider = Services(); using var scope = provider.CreateScope(); var s = scope.ServiceProvider;
        var id = await Seed(s); var actor = kind switch
        {
            "anonymous" => new ClaimsPrincipal(new ClaimsIdentity()),
            "forged" => new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, id)])),
            "missing" => Principal(Guid.NewGuid().ToString()), _ => Principal(id),
        };
        if (kind == "locked")
        {
            var manager = s.GetRequiredService<Microsoft.AspNetCore.Identity.UserManager<ApplicationUser>>();
            Assert.True((await manager.SetLockoutEndDateAsync((await manager.FindByIdAsync(id))!, DateTimeOffset.UtcNow.AddMinutes(5))).Succeeded);
        }
        var service = Service(s);
        Assert.Equal(ServiceFailure.Unauthenticated, (await service.GetCurrentAsync(actor, new())).Failure);
        Assert.Equal(ServiceFailure.Unauthenticated, (await service.GetUnreadCountAsync(actor)).Failure);
        Assert.Equal(ServiceFailure.Unauthenticated, (await service.MarkReadAsync(actor, Guid.NewGuid().ToString())).Failure);
        Assert.Equal(ServiceFailure.Unauthenticated, (await service.MarkAllReadAsync(actor)).Failure);
    }

    [Theory]
    [InlineData(0, 20)] [InlineData(1, 0)] [InlineData(1, 101)] [InlineData(int.MaxValue, 100)]
    public async Task Invalid_pagination_is_rejected(int page, int size)
    {
        using var provider = Services(); using var scope = provider.CreateScope(); var s = scope.ServiceProvider;
        var id = await Seed(s);
        Assert.Equal(ServiceFailure.Validation, (await Service(s).GetCurrentAsync(Principal(id), new(page, size))).Failure);
    }

    [Theory]
    [InlineData("notification-1")] [InlineData("00000000-0000-0000-0000-000000000000")]
    public async Task Invalid_notification_identifiers_are_rejected(string id)
    {
        using var provider = Services(); using var scope = provider.CreateScope(); var s = scope.ServiceProvider;
        var user = await Seed(s);
        Assert.Equal(ServiceFailure.Validation, (await Service(s).MarkReadAsync(Principal(user), id)).Failure);
    }

    [Fact]
    public async Task Internal_writer_requires_a_transaction_and_supports_stable_id_replays_without_resetting_read_state()
    {
        using var provider = Services(); using var scope = provider.CreateScope(); var s = scope.ServiceProvider;
        var user = await Seed(s); var other = await Seed(s); var db = s.GetRequiredService<AppDbContext>(); var writer = new NotificationWriter(db);
        var input = new CreateNotification(Guid.NewGuid(), user, "test.event", "عنوان", "Title", "رسالة", "Message");
        await Assert.ThrowsAsync<InvalidOperationException>(() => writer.StageAsync(input));
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        Assert.True(await writer.StageAsync(input)); Assert.False(await writer.StageAsync(input));
        Assert.Equal(EntityState.Added, db.Entry(db.Notifications.Local.Single()).State);
        await db.SaveChangesAsync(); var item = await db.Notifications.SingleAsync();
        item.IsRead = true; item.ReadAt = DateTimeOffset.UtcNow; var readAt = item.ReadAt; var created = item.CreatedAt; await db.SaveChangesAsync();
        Assert.False(await writer.StageAsync(input)); await db.SaveChangesAsync();
        Assert.Single(await db.Notifications.ToListAsync()); Assert.Equal(readAt, item.ReadAt); Assert.Equal(created, item.CreatedAt);
        await Assert.ThrowsAsync<InvalidOperationException>(() => writer.StageAsync(input with { RecipientUserId = other }));
        await Assert.ThrowsAsync<InvalidOperationException>(() => writer.StageAsync(input with { MessageEn = "Different event" }));
    }

    [Theory]
    [InlineData("recipient")] [InlineData("title")] [InlineData("message")] [InlineData("id")]
    public async Task Writer_rejects_invalid_internal_events(string invalid)
    {
        using var provider = Services(); using var scope = provider.CreateScope(); var s = scope.ServiceProvider;
        var user = await Seed(s); var db = s.GetRequiredService<AppDbContext>();
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        var input = new CreateNotification(Guid.NewGuid(), user, "event", null, "Title", null, "Message");
        input = invalid switch { "recipient" => input with { RecipientUserId = "missing" }, "title" => input with { TitleEn = new string('x', 201) },
            "message" => input with { MessageEn = null }, _ => input with { Id = Guid.Empty } };
        await Assert.ThrowsAsync<ArgumentException>(() => new NotificationWriter(db).StageAsync(input));
        Assert.Empty(db.Notifications.Local);
    }

    [Fact]
    public async Task Verified_welcome_event_is_committed_once_with_the_original_welcome_ledger_and_survives_role_changes()
    {
        using var provider = Services(); using var scope = provider.CreateScope(); var s = scope.ServiceProvider;
        var user = await Seed(s); var account = s.GetRequiredService<AccountService>(); var db = s.GetRequiredService<AppDbContext>();
        var incomplete = await account.UpdateCurrentProfileAsync(Principal(user), Profile("both") with { Goal = null });
        Assert.NotEqual(AccountFailure.None, incomplete.Failure); Assert.Empty(await db.Notifications.ToListAsync());
        foreach (var role in new[] { "learner", "instructor", "both", "learner" })
            Assert.Equal(AccountFailure.None, (await account.UpdateCurrentProfileAsync(Principal(user), Profile(role))).Failure);
        var item = await db.Notifications.SingleAsync(); Assert.Equal(NotificationWriter.WelcomeId(user), item.Id);
        Assert.Equal(user, item.RecipientUserId); Assert.Equal("account.welcome", item.NotificationType);
        Assert.Single(await db.PointTransactions.ToListAsync()); Assert.Equal(20, (await db.Wallets.SingleAsync()).Balance);
    }

    [Fact]
    public async Task Notification_routes_require_authentication_and_do_not_expose_a_client_creation_route()
    {
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions { EnvironmentName = "Testing" });
        builder.Services.AddScoped<INotificationService, NotificationService>();
        await using var app = builder.Build(); app.MapNotificationEndpoints();
        var routes = ((IEndpointRouteBuilder)app).DataSources.SelectMany(x => x.Endpoints).ToArray();
        Assert.Equal(4, routes.Length); Assert.All(routes, route => Assert.NotEmpty(route.Metadata.GetOrderedMetadata<IAuthorizeData>()));
        Assert.All(routes, route => Assert.DoesNotContain("POST", route.Metadata.GetMetadata<HttpMethodMetadata>()!.HttpMethods));
        var filter = new NotificationAccountFilter(); var http = new DefaultHttpContext { User = Principal("account-a") }; var called = false;
        http.Request.Headers["X-Esham-Account-Id"] = "account-b";
        var result = await filter.InvokeAsync(new DefaultEndpointFilterInvocationContext(http), _ => { called = true; return ValueTask.FromResult<object?>(Results.Ok()); });
        Assert.False(called); Assert.Equal(409, Assert.IsAssignableFrom<IStatusCodeHttpResult>(result).StatusCode);
        http.Request.Headers["X-Esham-Account-Id"] = "account-a";
        await filter.InvokeAsync(new DefaultEndpointFilterInvocationContext(http), _ => { called = true; return ValueTask.FromResult<object?>(Results.Ok()); }); Assert.True(called);
    }
}
