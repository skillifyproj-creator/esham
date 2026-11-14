using System.Security.Claims;
using esham.BLL.DTOs;
using esham.BLL.DTOs.Enrollments;
using esham.BLL.Interfaces;
using esham.BLL.Services;
using esham.DAL.Data;
using esham.DAL.Entities;
using esham.PL.Endpoints;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Xunit;
using static esham.Tests.AccountFinalizationTests;
namespace esham.Tests;

public sealed class EnrollmentTests
{
    internal sealed record Fixture(string Learner, string Owner, Guid Course, Guid Version)
    {
        public PurchaseEnrollmentRequest Request(Guid? id = null) => new(Course, Version, id ?? Guid.NewGuid());
    }
    // Only service-rule tests use the fake gate. SQL tests use the actual identity-verifying gate.
    private sealed class MemoryGate(AppDbContext db, bool enabled) : IEnrollmentPurchaseGate
    {
        public Task<bool> IsEnabledAsync(CancellationToken ct = default)
        {
            if (!db.Database.IsInMemory()) throw new InvalidOperationException("Test gate is restricted to InMemory.");
            return Task.FromResult(enabled);
        }
    }
    internal static EnrollmentService Service(IServiceProvider s, IEnrollmentPurchaseGate? gate = null) => new(s.GetRequiredService<AppDbContext>(),
        s.GetRequiredService<UserManager<ApplicationUser>>(), s.GetRequiredService<AccountService>(),
        new CourseVersionUpdates(s.GetRequiredService<AppDbContext>(), new NotificationWriter(s.GetRequiredService<AppDbContext>())),
        gate ?? new MemoryGate(s.GetRequiredService<AppDbContext>(), true));
    internal static async Task<Fixture> Setup(IServiceProvider s, string persona = "learner")
    {
        var owner = await Seed(s);
        Assert.Equal(AccountFailure.None, (await s.GetRequiredService<AccountService>().UpdateCurrentProfileAsync(Principal(owner), Profile("instructor", "o_" + owner.Replace("-", "")[..12]))).Failure);
        var learner = await Seed(s);
        Assert.Equal(AccountFailure.None, (await s.GetRequiredService<AccountService>().UpdateCurrentProfileAsync(Principal(learner), Profile(persona, "l_" + learner.Replace("-", "")[..12]))).Failure);
        var db = s.GetRequiredService<AppDbContext>();
        var category = new Category { NameAr = "تعليم", NameEn = "Learning", IsActive = true };
        var course = new Course { OwnerUserId = owner };
        db.AddRange(category, course); await db.SaveChangesAsync();
        var version = new CourseVersion { CourseId = course.Id, CategoryId = category.Id, VersionNumber = 1, TitleEn = "A persisted course", ReviewStatus = "approved", ApprovedAt = DateTimeOffset.UtcNow };
        db.Add(version); await db.SaveChangesAsync(); course.PublishedVersionId = version.Id; course.DraftVersionId = version.Id; await db.SaveChangesAsync();
        return new(learner, owner, course.Id, version.Id);
    }

    [Theory] [InlineData("learner")] [InlineData("both")]
    public async Task Purchase_preserves_welcome_and_stages_both_sides_and_version_receipt_once(string persona)
    {
        using var p = Services(); using var scope = p.CreateScope(); var s = scope.ServiceProvider; var d = await Setup(s, persona); var db = s.GetRequiredService<AppDbContext>();
        var request = d.Request(); var service = Service(s);
        var first = await service.PurchaseAsync(Principal(d.Learner), request);
        Assert.Equal(ServiceFailure.None, first.Failure); Assert.False(first.Value!.Replayed); Assert.Equal(d.Version, first.Value.Enrollment.CourseVersionId);
        var second = await service.PurchaseAsync(Principal(d.Learner), request);
        Assert.Equal(ServiceFailure.None, second.Failure); Assert.True(second.Value!.Replayed); Assert.Equal(first.Value.Enrollment.Id, second.Value.Enrollment.Id);
        Assert.Equal(0, (await db.Wallets.SingleAsync(x => x.UserId == d.Learner)).Balance); Assert.Equal(40, (await db.Wallets.SingleAsync(x => x.UserId == d.Owner)).Balance);
        Assert.Equal(2, await db.PointTransactions.CountAsync(x => x.TransactionType == "welcome"));
        var transfer = await db.PointTransactions.Where(x => x.EnrollmentId == first.Value.Enrollment.Id).ToListAsync();
        Assert.Equal(2, transfer.Count); Assert.Equal(0, transfer.Sum(x => x.Amount));
        Assert.Contains(transfer, x => x.UserId == d.Learner && x.Amount == -20 && x.TransactionType == "enrollment");
        Assert.Contains(transfer, x => x.UserId == d.Owner && x.Amount == 20 && x.TransactionType == "teaching");
        Assert.Single(await db.Enrollments.ToListAsync()); Assert.Equal("enrolled", (await db.EnrollmentVersionAccess.SingleAsync()).Reason);
        Assert.Equal("already_enrolled", (await service.PurchaseAsync(Principal(d.Learner), d.Request())).Code);
    }

    [Fact] public async Task Request_identity_is_account_wide_and_payload_reuse_cannot_charge_another_course()
    {
        using var p = Services(); using var scope = p.CreateScope(); var s = scope.ServiceProvider; var d = await Setup(s); var db = s.GetRequiredService<AppDbContext>(); var service = Service(s); var request = d.Request();
        Assert.Equal(ServiceFailure.None, (await service.PurchaseAsync(Principal(d.Learner), request)).Failure);
        var other = new Course { OwnerUserId = d.Owner }; db.Courses.Add(other); await db.SaveChangesAsync();
        Assert.Equal("request_conflict", (await service.PurchaseAsync(Principal(d.Learner), request with { CourseId = other.Id })).Code);
        Assert.Equal("request_conflict", (await service.PurchaseAsync(Principal(d.Learner), request with { ExpectedPublishedVersionId = Guid.NewGuid() })).Code);
        Assert.Single(await db.Enrollments.ToListAsync()); Assert.Equal(2, await db.PointTransactions.CountAsync(x => x.EnrollmentId != null));
        // Replay still works after present-day eligibility changes.
        (await db.Courses.SingleAsync(x => x.Id == d.Course)).EnrollmentPaused = true; await db.SaveChangesAsync();
        Assert.True((await service.PurchaseAsync(Principal(d.Learner), request)).Value!.Replayed);
    }

    [Theory] [InlineData("paused")] [InlineData("suspended")] [InlineData("draft")] [InlineData("category")] [InlineData("hidden")]
    [InlineData("stale")] [InlineData("self")] [InlineData("balance")] [InlineData("missing-wallet")] [InlineData("missing-welcome")] [InlineData("overflow")]
    public async Task Invalid_purchases_do_not_write_enrollment_or_transfer(string condition)
    {
        using var p = Services(); using var scope = p.CreateScope(); var s = scope.ServiceProvider; var d = await Setup(s, "both"); var db = s.GetRequiredService<AppDbContext>(); var request = d.Request();
        var course = await db.Courses.SingleAsync(); var version = await db.CourseVersions.SingleAsync();
        switch (condition)
        {
            case "paused": course.EnrollmentPaused = true; break;
            case "suspended": course.SafetyStatus = "suspended"; break;
            case "draft": version.ReviewStatus = "draft"; break;
            case "category": (await db.Categories.SingleAsync()).IsActive = false; break;
            case "hidden":
                var fixture = new Category { Id = Guid.Parse("e13348fe-e351-4ff2-95de-f2c67e5dc53c"), NameEn = "Hidden", IsActive = true }; db.Categories.Add(fixture); version.CategoryId = fixture.Id; break;
            case "stale": request = request with { ExpectedPublishedVersionId = Guid.NewGuid() }; break;
            case "self": course.OwnerUserId = d.Learner; break;
            case "balance": (await db.Wallets.SingleAsync(x => x.UserId == d.Learner)).Balance = 19; break;
            case "missing-wallet": db.Wallets.Remove(await db.Wallets.SingleAsync(x => x.UserId == d.Owner)); break;
            case "missing-welcome": db.PointTransactions.Remove(await db.PointTransactions.SingleAsync(x => x.UserId == d.Owner)); break;
            case "overflow": (await db.Wallets.SingleAsync(x => x.UserId == d.Owner)).Balance = int.MaxValue; break;
        }
        await db.SaveChangesAsync();
        var before = await db.Wallets.AsNoTracking().Select(x => x.Balance).ToListAsync();
        Assert.NotEqual(ServiceFailure.None, (await Service(s).PurchaseAsync(Principal(d.Learner), request)).Failure);
        Assert.Empty(await db.Enrollments.ToListAsync()); Assert.Empty(await db.EnrollmentVersionAccess.ToListAsync()); Assert.False(await db.PointTransactions.AnyAsync(x => x.EnrollmentId != null));
        Assert.Equal(before, await db.Wallets.AsNoTracking().Select(x => x.Balance).ToListAsync());
    }

    [Fact] public async Task Membership_ownership_pagination_and_gate_are_enforced_without_trusting_claims()
    {
        using var p = Services(); using var scope = p.CreateScope(); var s = scope.ServiceProvider; var d = await Setup(s); var db = s.GetRequiredService<AppDbContext>(); var service = Service(s);
        Assert.Equal(ServiceFailure.Unauthenticated, (await service.PurchaseAsync(new ClaimsPrincipal(), d.Request())).Failure);
        var forged = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, d.Owner), new Claim(ClaimTypes.Role, "Learner")], "forged"));
        Assert.Equal(ServiceFailure.Forbidden, (await service.PurchaseAsync(forged, d.Request())).Failure);
        Assert.Equal("purchase_disabled", (await Service(s, new MemoryGate(db, false)).PurchaseAsync(Principal(d.Learner), d.Request())).Code);
        Assert.False(await new EnrollmentPurchaseGate(db, Options.Create(new EnrollmentPurchaseOptions())).IsEnabledAsync());
        Assert.False(await new EnrollmentPurchaseGate(db, Options.Create(new EnrollmentPurchaseOptions { Enabled = true, ApprovedIsolatedDatabase = "db75401" })).IsEnabledAsync());
        Assert.False(await new EnrollmentPurchaseGate(db, Options.Create(new EnrollmentPurchaseOptions { Enabled = true, ApprovedIsolatedDatabase = "Esham_AccountTests_fake" })).IsEnabledAsync());
        using (var hosted = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlServer("Server=hosted.example.invalid;Database=Esham_AccountTests_fake;Integrated Security=True").Options))
            Assert.False(await new EnrollmentPurchaseGate(hosted, Options.Create(new EnrollmentPurchaseOptions { Enabled = true, ApprovedIsolatedDatabase = "Esham_AccountTests_fake" })).IsEnabledAsync());
        Assert.Equal(ServiceFailure.Validation, (await service.PurchaseAsync(Principal(d.Learner), d.Request() with { RequestId = Guid.Empty })).Failure);
        var result = await service.PurchaseAsync(Principal(d.Learner), d.Request());
        Assert.Equal(ServiceFailure.None, result.Failure);
        Assert.Equal(1, (await service.ListAsync(Principal(d.Learner))).Value!.TotalCount);
        var other = await Setup(s);
        Assert.Equal(ServiceFailure.NotFound, (await service.GetAsync(Principal(other.Learner), result.Value!.Enrollment.Id)).Failure);
        Assert.Empty((await service.ListAsync(Principal(other.Learner))).Value!.Items);
        Assert.Equal(ServiceFailure.Validation, (await service.ListAsync(Principal(d.Learner), int.MaxValue, 100)).Failure);
        var manager = s.GetRequiredService<UserManager<ApplicationUser>>(); var user = await manager.FindByIdAsync(d.Learner);
        await manager.SetLockoutEnabledAsync(user!, true); await manager.SetLockoutEndDateAsync(user!, DateTimeOffset.UtcNow.AddDays(1));
        Assert.Equal(ServiceFailure.Unauthenticated, (await service.GetAsync(Principal(d.Learner), result.Value.Enrollment.Id)).Failure);
    }

    [Fact] public async Task Wallet_reads_are_owned_paginated_and_totals_do_not_depend_on_history_page()
    {
        using var p = Services(); using var scope = p.CreateScope(); var s = scope.ServiceProvider; var d = await Setup(s);
        await Service(s).PurchaseAsync(Principal(d.Learner), d.Request());
        var wallet = new WalletService(s.GetRequiredService<AppDbContext>(), s.GetRequiredService<UserManager<ApplicationUser>>());
        var summary = (await wallet.SummaryAsync(Principal(d.Learner))).Value!;
        Assert.Equal(0, summary.Balance); Assert.Equal(20, summary.Spent); Assert.Equal(0, summary.Earned);
        var history = (await wallet.HistoryAsync(Principal(d.Learner), 1, 1)).Value!;
        Assert.Equal(2, history.TotalCount); Assert.Single(history.Items); Assert.Equal(d.Learner, history.AccountId);
        Assert.Equal(20, (await wallet.SummaryAsync(Principal(d.Owner))).Value!.Earned);
        var totals = (await wallet.TeachingAsync(Principal(d.Owner))).Value!; Assert.Equal(20, totals.TotalEarned); Assert.Equal(d.Course, Assert.Single(totals.Items).CourseId);
        Assert.Equal(ServiceFailure.Forbidden, (await wallet.TeachingAsync(Principal(d.Learner))).Failure);
        Assert.Equal(ServiceFailure.Validation, (await wallet.HistoryAsync(Principal(d.Owner), type: "operation-key")).Failure);
        Assert.Equal(ServiceFailure.Unauthenticated, (await wallet.SummaryAsync(new ClaimsPrincipal())).Failure);
        Assert.DoesNotContain(typeof(esham.BLL.DTOs.Wallets.WalletEntry).GetProperties(), x => x.Name == "OperationKey");
    }

    [Fact] public async Task Endpoints_require_authentication_and_reject_stale_account_preconditions()
    {
        var builder = WebApplication.CreateBuilder(); builder.Services.AddAuthorization();
        builder.Services.AddScoped<IEnrollmentService, EnrollmentService>(); builder.Services.AddScoped<IWalletService, WalletService>();
        await using var app = builder.Build(); app.MapEnrollmentEndpoints(); app.MapWalletEndpoints();
        var endpoints = ((IEndpointRouteBuilder)app).DataSources.SelectMany(x => x.Endpoints).OfType<RouteEndpoint>().ToArray();
        Assert.Equal(7, endpoints.Length);
        Assert.All(endpoints, x => Assert.NotNull(x.Metadata.GetMetadata<Microsoft.AspNetCore.Authorization.IAuthorizeData>()));
        var http = new DefaultHttpContext { User = Principal("account-b") }; http.Request.Headers["X-Esham-Account-Id"] = "account-a";
        var invocation = new DefaultEndpointFilterInvocationContext(http);
        var called = false;
        var result = await new EnrollmentAccountFilter().InvokeAsync(invocation, _ => { called = true; return ValueTask.FromResult<object?>(Results.Ok()); });
        Assert.False(called); Assert.Equal(409, Assert.IsAssignableFrom<IStatusCodeHttpResult>(result).StatusCode);
    }

    [Fact] public void Owned_enrollment_projection_translates_to_sql_server_without_opening_a_database()
    {
        using var p = Services(); using var scope = p.CreateScope(); var s = scope.ServiceProvider;
        using var sql = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlServer("Server=offline.invalid;Database=Offline;Integrated Security=True").Options);
        var service = new EnrollmentService(sql, s.GetRequiredService<UserManager<ApplicationUser>>(), s.GetRequiredService<AccountService>(),
            new CourseVersionUpdates(sql, new NotificationWriter(sql)), new EnrollmentPurchaseGate(sql, Options.Create(new EnrollmentPurchaseOptions())));
        // Exercise the production projection, not a separately reimplemented test query.
        var method = typeof(EnrollmentService).GetMethod("Project", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance)!;
        var query = (IQueryable<esham.BLL.DTOs.Enrollments.EnrollmentDto>)method.Invoke(service, [sql.Enrollments.Where(x => x.LearnerUserId == "owned-learner")])!;
        var command = query.ToQueryString();
        Assert.Contains("EnrollmentVersionAccess", command); Assert.Contains("PublishedVersionId", command); Assert.Contains("owned-learner", command);
        Assert.DoesNotContain("PasswordHash", command); Assert.DoesNotContain("StorageKey", command); Assert.DoesNotContain("OperationKey", command);
    }

    [Fact] public async Task Incomplete_accounts_and_missing_wallet_reads_never_initialize_or_repair_finances()
    {
        using var p = Services(); using var scope = p.CreateScope(); var s = scope.ServiceProvider; var d = await Setup(s);
        var db = s.GetRequiredService<AppDbContext>(); var id = await Seed(s);
        await s.GetRequiredService<UserManager<ApplicationUser>>().AddToRoleAsync((await db.Users.SingleAsync(x => x.Id == id)), "Learner");
        Assert.Equal("onboarding_required", (await Service(s).PurchaseAsync(Principal(id), d.Request())).Code);
        var wallet = new WalletService(db, s.GetRequiredService<UserManager<ApplicationUser>>());
        Assert.Equal("wallet_unavailable", (await wallet.SummaryAsync(Principal(id))).Code);
        Assert.False(await db.Wallets.AnyAsync(x => x.UserId == id)); Assert.False(await db.PointTransactions.AnyAsync(x => x.UserId == id));
        Assert.Empty(await db.Enrollments.ToListAsync());
    }
}
