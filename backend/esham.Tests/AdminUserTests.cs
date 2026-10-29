using System.Security.Claims;
using System.Text.Json;
using esham.BLL.DTOs;
using esham.BLL.DTOs.AdminUsers;
using esham.BLL.Interfaces;
using esham.BLL.Services;
using esham.DAL.Data;
using esham.DAL.Entities;
using esham.PL.Development;
using esham.PL.Endpoints;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Net.Http.Headers;
using Xunit;
using static esham.Tests.AccountFinalizationTests;

namespace esham.Tests;

public sealed class AdminUserTests
{
    internal static ServiceProvider AdminServices(Action<DbContextOptionsBuilder>? configure = null)
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddDataProtection().UseEphemeralDataProtectionProvider();
        var database = Guid.NewGuid().ToString();
        services.AddDbContext<AppDbContext>(options =>
        {
            if (configure is null) options.UseInMemoryDatabase(database).ReplaceService<IDbContextTransactionManager, TestTransactionManager>();
            else configure(options);
        });
        services.AddIdentity<ApplicationUser, IdentityRole>().AddEntityFrameworkStores<AppDbContext>().AddDefaultTokenProviders();
        services.Configure<SecurityStampValidatorOptions>(options => options.ValidationInterval = TimeSpan.Zero);
        services.ConfigureApplicationCookie(options => { options.Cookie.Name = "Esham.Identity"; options.Events.OnValidatePrincipal = AccountCookieValidation.ValidateAsync; });
        services.AddScoped<AccountService>();
        services.AddScoped<INotificationWriter, NotificationWriter>();
        services.AddScoped<AdminUserService>();
        return services.BuildServiceProvider();
    }

    internal static async Task<string> Create(IServiceProvider services, string name, params string[] roles)
    {
        await DevelopmentIdentityRoles.SeedAsync(services.GetRequiredService<RoleManager<IdentityRole>>());
        var manager = services.GetRequiredService<UserManager<ApplicationUser>>();
        var user = new ApplicationUser { UserName = name + "_" + Guid.NewGuid().ToString("N")[..8],
            Email = name + "_" + Guid.NewGuid().ToString("N")[..8] + "@example.test", Name = name };
        Assert.True((await manager.CreateAsync(user, Password)).Succeeded);
        if (roles.Length > 0) Assert.True((await manager.AddToRolesAsync(user, roles)).Succeeded);
        return user.Id;
    }

    internal static async Task<AdminUserDto> Detail(IServiceProvider services, string actor, string target) =>
        (await services.GetRequiredService<AdminUserService>().GetUserAsync(Principal(actor), target)).Value!;

    [Theory]
    [InlineData(null, false, ServiceFailure.Unauthenticated)]
    [InlineData("Learner", true, ServiceFailure.Forbidden)]
    [InlineData("Instructor", true, ServiceFailure.Forbidden)]
    [InlineData("CategoryAdmin", true, ServiceFailure.Forbidden)]
    public async Task Every_service_action_rejects_anonymous_nonadmin_and_forged_admin_claims(string? role, bool authenticated, ServiceFailure expected)
    {
        using var provider = AdminServices(); using var scope = provider.CreateScope(); var s = scope.ServiceProvider;
        var id = await Create(s, "ordinary", role is null ? [] : [role]);
        var actor = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, id), new Claim(ClaimTypes.Role, "GeneralAdmin")], authenticated ? "test" : null));
        var service = s.GetRequiredService<AdminUserService>();
        Assert.Equal(expected, (await service.GetUsersAsync(actor, new())).Failure);
        Assert.Equal(expected, (await service.GetUserAsync(actor, id)).Failure);
        Assert.Equal(expected, (await service.UpdateRolesAsync(actor, id, new(["GeneralAdmin"], new string('A', 64)))).Failure);
        Assert.Equal(expected, (await service.UpdateLockoutAsync(actor, id, new(null, new string('A', 64)))).Failure);
    }

    [Fact]
    public async Task Directory_is_paginated_searchable_and_filters_real_memberships_and_lockout()
    {
        using var provider = AdminServices(); using var scope = provider.CreateScope(); var s = scope.ServiceProvider;
        var actor = await Create(s, "root", "GeneralAdmin");
        var a = await Create(s, "Alice", "Learner", "Instructor");
        var b = await Create(s, "Bob", "Learner");
        var users = s.GetRequiredService<UserManager<ApplicationUser>>();
        var user = (await users.FindByIdAsync(b))!; user.Role = "GeneralAdmin";
        Assert.True((await users.SetLockoutEndDateAsync(user, DateTimeOffset.UtcNow.AddHours(1))).Succeeded);
        var service = s.GetRequiredService<AdminUserService>();
        var first = (await service.GetUsersAsync(Principal(actor), new(PageSize: 1, Role: "Learner"))).Value!;
        var second = (await service.GetUsersAsync(Principal(actor), new(Page: 2, PageSize: 1, Role: "Learner"))).Value!;
        Assert.Equal(2, first.TotalCount); Assert.Single(first.Items); Assert.Single(second.Items);
        Assert.NotEqual(first.Items[0].Id, second.Items[0].Id);
        Assert.Equal(a, (await service.GetUsersAsync(Principal(actor), new(Search: "aLiCe", Role: "Instructor", Status: "unlocked"))).Value!.Items.Single().Id);
        Assert.Equal(b, (await service.GetUsersAsync(Principal(actor), new(Role: "Learner", Status: "locked"))).Value!.Items.Single().Id);
        Assert.Equal(actor, (await service.GetUsersAsync(Principal(actor), new(Role: "administrators"))).Value!.Items.Single().Id);
        Assert.Empty((await service.GetUsersAsync(Principal(actor), new(Search: "no-match"))).Value!.Items);
    }

    [Theory]
    [InlineData(0, 20, null, null)] [InlineData(1, 101, null, null)]
    [InlineData(int.MaxValue, 100, null, null)] [InlineData(1, 20, "Combined", null)] [InlineData(1, 20, null, "inactive")]
    public async Task Invalid_directory_parameters_are_rejected(int page, int size, string? role, string? status)
    {
        using var provider = AdminServices(); using var scope = provider.CreateScope(); var s = scope.ServiceProvider;
        var actor = await Create(s, "root", "GeneralAdmin");
        Assert.Equal(ServiceFailure.Validation, (await s.GetRequiredService<AdminUserService>().GetUsersAsync(Principal(actor), new(page, size, Role: role, Status: status))).Failure);
    }

    [Fact]
    public async Task Details_whitelist_account_information_and_return_real_roles_not_secrets()
    {
        using var provider = AdminServices(); using var scope = provider.CreateScope(); var s = scope.ServiceProvider;
        var actor = await Create(s, "root", "GeneralAdmin"); var target = await Create(s, "target", "Learner", "Instructor");
        var detail = await Detail(s, actor, target);
        Assert.Equal(new[] { "Instructor", "Learner" }, detail.Roles);
        var json = JsonSerializer.Serialize(detail);
        foreach (var secret in new[] { "PasswordHash", "SecurityStamp", "ConcurrencyStamp", "AuthenticatorKey", "PhoneNumber", "Token", "Bio", "Avatar" }) Assert.DoesNotContain(secret, json);
        Assert.Equal(64, detail.Version.Length);
        var service = s.GetRequiredService<AdminUserService>();
        Assert.Equal(ServiceFailure.Validation, (await service.GetUserAsync(Principal(actor), "u1")).Failure);
        Assert.Equal(ServiceFailure.NotFound, (await service.GetUserAsync(Principal(actor), Guid.NewGuid().ToString())).Failure);
    }

    [Fact]
    public async Task Role_updates_synchronize_persona_preserve_category_admin_and_rotate_security_stamp()
    {
        using var provider = AdminServices(); using var scope = provider.CreateScope(); var s = scope.ServiceProvider;
        var actor = await Create(s, "root", "GeneralAdmin"); var target = await Create(s, "target", "Learner", "CategoryAdmin");
        var db = s.GetRequiredService<AppDbContext>(); var stamp = (await db.Users.SingleAsync(x => x.Id == target)).SecurityStamp;
        var detail = await Detail(s, actor, target);
        var result = await s.GetRequiredService<AdminUserService>().UpdateRolesAsync(Principal(actor), target, new(["Learner", "Instructor", "CategoryAdmin"], detail.Version));
        Assert.Equal(ServiceFailure.None, result.Failure); Assert.Equal(3, result.Value!.Roles.Count);
        var user = await db.Users.SingleAsync(x => x.Id == target);
        Assert.Equal("both", user.Role); Assert.NotEqual(stamp, user.SecurityStamp); Assert.NotEqual(detail.Version, result.Value.Version);
        Assert.False(await db.Roles.AnyAsync(x => x.Name == "Combined"));
        Assert.Single(await db.AdminActivityLogs.ToListAsync());
        Assert.Equal(ServiceFailure.Conflict, (await s.GetRequiredService<AdminUserService>().UpdateRolesAsync(Principal(actor), target, new(["Learner"], detail.Version))).Failure);
    }

    [Theory]
    [InlineData("Combined")] [InlineData("learner")] [InlineData("Unknown")]
    public async Task Unknown_roles_and_unsupported_category_scope_changes_are_rejected(string invalid)
    {
        using var provider = AdminServices(); using var scope = provider.CreateScope(); var s = scope.ServiceProvider;
        var actor = await Create(s, "root", "GeneralAdmin"); var target = await Create(s, "target", "Learner");
        var detail = await Detail(s, actor, target); var service = s.GetRequiredService<AdminUserService>();
        Assert.Equal(ServiceFailure.Validation, (await service.UpdateRolesAsync(Principal(actor), target, new([invalid], detail.Version))).Failure);
        Assert.Equal(ServiceFailure.Validation, (await service.UpdateRolesAsync(Principal(actor), target, new(["Learner", "Learner"], detail.Version))).Failure);
        Assert.Equal(ServiceFailure.Conflict, (await service.UpdateRolesAsync(Principal(actor), target, new(["Learner", "CategoryAdmin"], detail.Version))).Failure);
        Assert.Empty(await s.GetRequiredService<AppDbContext>().AdminActivityLogs.ToListAsync());
    }

    [Fact]
    public async Task Last_administrator_and_all_other_self_modification_are_protected()
    {
        using var provider = AdminServices(); using var scope = provider.CreateScope(); var s = scope.ServiceProvider;
        var actor = await Create(s, "root", "GeneralAdmin"); var service = s.GetRequiredService<AdminUserService>();
        var detail = await Detail(s, actor, actor);
        var result = await service.UpdateRolesAsync(Principal(actor), actor, new(["Learner"], detail.Version));
        Assert.Equal(ServiceFailure.Conflict, result.Failure); Assert.Contains("last unlocked", result.Message!);
        var lockout = await service.UpdateLockoutAsync(Principal(actor), actor, new(DateTimeOffset.UtcNow.AddHours(1), detail.Version));
        Assert.Equal(ServiceFailure.Conflict, lockout.Failure); Assert.Contains("last unlocked", lockout.Message!);
        await Create(s, "other_admin", "GeneralAdmin");
        result = await service.UpdateRolesAsync(Principal(actor), actor, new(["GeneralAdmin", "Learner"], detail.Version));
        Assert.Equal(ServiceFailure.Conflict, result.Failure); Assert.Contains("self-modification", result.Message!);
        Assert.Equal(ServiceFailure.Conflict, (await service.UpdateLockoutAsync(Principal(actor), actor, new(null, detail.Version))).Failure);
        Assert.Equal(ServiceFailure.Conflict, (await service.UpdateRolesAsync(Principal(actor), actor.ToUpperInvariant(), new(["GeneralAdmin", "Learner"], detail.Version))).Failure);
    }

    [Fact]
    public async Task Invalid_lockout_disabled_lockout_missing_target_and_stale_versions_fail_closed()
    {
        using var provider = AdminServices(); using var scope = provider.CreateScope(); var s = scope.ServiceProvider;
        var actor = await Create(s, "root", "GeneralAdmin"); var target = await Create(s, "target", "Learner");
        var service = s.GetRequiredService<AdminUserService>(); var detail = await Detail(s, actor, target);
        Assert.Equal(ServiceFailure.Validation, (await service.UpdateLockoutAsync(Principal(actor), target, new(DateTimeOffset.UtcNow.AddMinutes(-1), detail.Version))).Failure);
        Assert.Equal(ServiceFailure.Validation, (await service.UpdateRolesAsync(Principal(actor), "u1", new(["Learner"], detail.Version))).Failure);
        Assert.Equal(ServiceFailure.Validation, (await service.UpdateRolesAsync(Principal(actor), target, new(["Learner"], null))).Failure);
        Assert.Equal(ServiceFailure.NotFound, (await service.UpdateLockoutAsync(Principal(actor), Guid.NewGuid().ToString(), new(null, detail.Version))).Failure);
        var manager = s.GetRequiredService<UserManager<ApplicationUser>>(); var user = (await manager.FindByIdAsync(target))!;
        Assert.True((await manager.SetLockoutEnabledAsync(user, false)).Succeeded);
        detail = await Detail(s, actor, target);
        Assert.Equal(ServiceFailure.Conflict, (await service.UpdateLockoutAsync(Principal(actor), target, new(DateTimeOffset.UtcNow.AddMinutes(5), detail.Version))).Failure);
        Assert.Empty(await s.GetRequiredService<AppDbContext>().AdminActivityLogs.ToListAsync());
    }

    [Fact]
    public async Task Locked_administrators_cannot_use_existing_principal_to_manage_other_users()
    {
        using var provider = AdminServices(); using var scope = provider.CreateScope(); var s = scope.ServiceProvider;
        var actor = await Create(s, "root", "GeneralAdmin"); var target = await Create(s, "target", "Learner");
        var detail = await Detail(s, actor, target); var manager = s.GetRequiredService<UserManager<ApplicationUser>>();
        Assert.True((await manager.SetLockoutEndDateAsync((await manager.FindByIdAsync(actor))!, DateTimeOffset.UtcNow.AddMinutes(5))).Succeeded);
        var service = s.GetRequiredService<AdminUserService>();
        Assert.Equal(ServiceFailure.Unauthenticated, (await service.GetUsersAsync(Principal(actor), new())).Failure);
        Assert.Equal(ServiceFailure.Unauthenticated, (await service.UpdateRolesAsync(Principal(actor), target, new(["GeneralAdmin"], detail.Version))).Failure);
    }

    [Fact]
    public async Task Timed_lockout_and_unlock_use_existing_fields_and_do_not_modify_other_domains()
    {
        using var provider = AdminServices(); using var scope = provider.CreateScope(); var s = scope.ServiceProvider;
        var actor = await Create(s, "root", "GeneralAdmin"); var target = await Create(s, "target", "Learner");
        var db = s.GetRequiredService<AppDbContext>();
        var category = new Category { NameAr = "تصنيف", NameEn = "Category" }; db.Categories.Add(category);
        var course = new Course { OwnerUserId = actor }; db.Courses.Add(course);
        var version = new CourseVersion { CourseId = course.Id, CategoryId = category.Id, VersionNumber = 1 }; db.CourseVersions.Add(version);
        var enrollment = new Enrollment { LearnerUserId = target, CourseId = course.Id, CourseVersionId = version.Id }; db.Enrollments.Add(enrollment);
        db.Wallets.Add(new Wallet { UserId = target, Balance = 37 });
        db.PointTransactions.Add(new PointTransaction { UserId = target, Amount = 37, TransactionType = "test", OperationKey = "sentinel" });
        db.UserCategories.Add(new UserCategory { UserId = target, CategoryId = category.Id, Kind = "learning" });
        (await db.Users.SingleAsync(x => x.Id == target)).Interests = [1];
        await db.SaveChangesAsync();
        var service = s.GetRequiredService<AdminUserService>(); var detail = await Detail(s, actor, target);
        var locked = await service.UpdateLockoutAsync(Principal(actor), target, new(DateTimeOffset.UtcNow.AddHours(1), detail.Version));
        Assert.Equal(ServiceFailure.None, locked.Failure); Assert.True(locked.Value!.IsLockedOut);
        Http(s, target);
        Assert.Equal(AccountFailure.LockedOut, (await s.GetRequiredService<AccountService>().LoginAsync(new(locked.Value.Email, Password))).Failure);
        Assert.Equal(AccountFailure.Unauthenticated, (await s.GetRequiredService<AccountService>().GetCurrentSessionAsync(Principal(target))).Failure);
        var unlocked = await service.UpdateLockoutAsync(Principal(actor), target, new(null, locked.Value.Version));
        Assert.Equal(ServiceFailure.None, unlocked.Failure); Assert.False(unlocked.Value!.IsLockedOut);
        var changed = await service.UpdateRolesAsync(Principal(actor), target, new(["Learner", "Instructor"], unlocked.Value.Version));
        Assert.Equal(ServiceFailure.None, changed.Failure);
        Assert.Equal(37, (await db.Wallets.SingleAsync()).Balance); Assert.Equal(37, (await db.PointTransactions.SingleAsync()).Amount);
        Assert.Equal(enrollment.Id, (await db.Enrollments.SingleAsync()).Id); Assert.Equal(version.Id, (await db.Enrollments.SingleAsync()).CourseVersionId);
        Assert.Equal(category.Id, (await db.UserCategories.SingleAsync()).CategoryId);
        Assert.Equal(new[] { 1 }, (await db.Users.SingleAsync(x => x.Id == target)).Interests);
    }

    [Theory]
    [InlineData(false)] [InlineData(true)]
    public async Task Old_cookies_are_rejected_on_the_next_request_after_roles_or_lockout_change(bool lockout)
    {
        using var provider = AdminServices(); string actor, target, cookie;
        using (var initial = provider.CreateScope())
        {
            var s = initial.ServiceProvider; actor = await Create(s, "root", "GeneralAdmin"); target = await Create(s, "target", "Learner");
            Http(s, target); var user = (await s.GetRequiredService<UserManager<ApplicationUser>>().FindByIdAsync(target))!;
            await s.GetRequiredService<SignInManager<ApplicationUser>>().SignInAsync(user, false);
            var header = Assert.Single(SetCookieHeaderValue.ParseList(s.GetRequiredService<SignInManager<ApplicationUser>>().Context.Response.Headers.SetCookie.Select(x => x!).ToArray()));
            cookie = $"{header.Name}={header.Value}";
        }
        using (var validation = provider.CreateScope())
        {
            Http(validation.ServiceProvider, target); var http = validation.ServiceProvider.GetRequiredService<SignInManager<ApplicationUser>>().Context;
            http.Request.Headers.Cookie = cookie;
            Assert.True((await http.AuthenticateAsync(IdentityConstants.ApplicationScheme)).Succeeded);
        }
        using (var mutation = provider.CreateScope())
        {
            var s = mutation.ServiceProvider; var detail = await Detail(s, actor, target); var service = s.GetRequiredService<AdminUserService>();
            var changed = lockout ? await service.UpdateLockoutAsync(Principal(actor), target, new(DateTimeOffset.UtcNow.AddHours(1), detail.Version))
                : await service.UpdateRolesAsync(Principal(actor), target, new(["Instructor"], detail.Version));
            Assert.Equal(ServiceFailure.None, changed.Failure);
        }
        using var after = provider.CreateScope(); Http(after.ServiceProvider, target);
        var request = after.ServiceProvider.GetRequiredService<SignInManager<ApplicationUser>>().Context;
        request.Request.Headers.Cookie = cookie;
        Assert.False((await request.AuthenticateAsync(IdentityConstants.ApplicationScheme)).Succeeded);
    }

    [Fact]
    public async Task Automatic_identity_lockout_is_also_checked_when_the_security_stamp_did_not_change()
    {
        using var provider = AdminServices(); string target, cookie;
        using (var setup = provider.CreateScope())
        {
            var s = setup.ServiceProvider; target = await Create(s, "target", "Learner"); Http(s, target);
            var manager = s.GetRequiredService<UserManager<ApplicationUser>>(); var user = (await manager.FindByIdAsync(target))!;
            await s.GetRequiredService<SignInManager<ApplicationUser>>().SignInAsync(user, false);
            var header = Assert.Single(SetCookieHeaderValue.ParseList(s.GetRequiredService<SignInManager<ApplicationUser>>().Context.Response.Headers.SetCookie.Select(x => x!).ToArray())); cookie = $"{header.Name}={header.Value}";
            Assert.True((await manager.SetLockoutEndDateAsync(user, DateTimeOffset.UtcNow.AddMinutes(5))).Succeeded);
        }
        using var after = provider.CreateScope(); Http(after.ServiceProvider, target);
        var http = after.ServiceProvider.GetRequiredService<SignInManager<ApplicationUser>>().Context; http.Request.Headers.Cookie = cookie;
        Assert.False((await http.AuthenticateAsync(IdentityConstants.ApplicationScheme)).Succeeded);
    }

    [Fact]
    public async Task Routes_require_authentication_and_mutations_require_the_application_header()
    {
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions { EnvironmentName = "Testing" });
        builder.Services.AddScoped<esham.BLL.Interfaces.IAdminUserService, AdminUserService>();
        await using var app = builder.Build(); app.MapAdminUserEndpoints();
        var endpoints = ((IEndpointRouteBuilder)app).DataSources.SelectMany(x => x.Endpoints).ToArray();
        Assert.Equal(4, endpoints.Length); Assert.All(endpoints, x => Assert.NotEmpty(x.Metadata.GetOrderedMetadata<IAuthorizeData>()));
        var http = new DefaultHttpContext(); var filter = new AdminMutationFilter(); var called = false;
        var result = await filter.InvokeAsync(new DefaultEndpointFilterInvocationContext(http), _ => { called = true; return ValueTask.FromResult<object?>(Results.Ok()); });
        Assert.Equal(403, Assert.IsAssignableFrom<IStatusCodeHttpResult>(result).StatusCode); Assert.False(called);
        http.Request.Headers["X-Requested-With"] = "XMLHttpRequest";
        await filter.InvokeAsync(new DefaultEndpointFilterInvocationContext(http), _ => { called = true; return ValueTask.FromResult<object?>(Results.Ok()); }); Assert.True(called);
        called = false; http.Request.Scheme = "https"; http.Request.Host = new HostString("api.example.test");
        http.Request.Headers.Origin = "https://evil.example";
        result = await filter.InvokeAsync(new DefaultEndpointFilterInvocationContext(http), _ => { called = true; return ValueTask.FromResult<object?>(Results.Ok()); });
        Assert.Equal(403, Assert.IsAssignableFrom<IStatusCodeHttpResult>(result).StatusCode); Assert.False(called);
        http.Request.Headers.Origin = "https://api.example.test";
        await filter.InvokeAsync(new DefaultEndpointFilterInvocationContext(http), _ => { called = true; return ValueTask.FromResult<object?>(Results.Ok()); }); Assert.True(called);
        called = false; http.Request.Headers.Remove("Origin"); http.Request.Headers["Sec-Fetch-Site"] = "cross-site";
        result = await filter.InvokeAsync(new DefaultEndpointFilterInvocationContext(http), _ => { called = true; return ValueTask.FromResult<object?>(Results.Ok()); });
        Assert.Equal(403, Assert.IsAssignableFrom<IStatusCodeHttpResult>(result).StatusCode); Assert.False(called);
    }
}
