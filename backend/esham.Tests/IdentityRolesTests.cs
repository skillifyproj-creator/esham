using System.Security.Claims;
using esham.DAL.Data;
using esham.DAL.Entities;
using esham.PL.Development;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace esham.Tests;

public sealed class IdentityRolesTests
{
    private static ServiceProvider Services()
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddDbContext<AppDbContext>(options => options.UseInMemoryDatabase(Guid.NewGuid().ToString()));
        services.AddIdentity<ApplicationUser, IdentityRole>()
            .AddEntityFrameworkStores<AppDbContext>().AddDefaultTokenProviders();
        return services.BuildServiceProvider();
    }

    [Fact]
    public async Task Seeding_twice_creates_only_four_roles_and_no_users()
    {
        using var provider = Services();
        using var scope = provider.CreateScope();
        var roles = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
        await DevelopmentIdentityRoles.SeedAsync(roles);
        await DevelopmentIdentityRoles.SeedAsync(roles);
        Assert.Equal(4, await roles.Roles.CountAsync());
        Assert.Equal(DevelopmentIdentityRoles.KnownRoles.Order(), (await roles.Roles.Select(r => r.Name!).ToListAsync()).Order());
        Assert.Empty(await scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>().Users.ToListAsync());
    }

    [Fact]
    public async Task Explicit_assignment_is_idempotent_and_both_is_two_memberships()
    {
        using var provider = Services();
        using var scope = provider.CreateScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var roles = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
        await DevelopmentIdentityRoles.SeedAsync(roles);
        var user = new ApplicationUser { Email = "selected@example.test", UserName = "selected" };
        var other = new ApplicationUser { Email = "other@example.test", UserName = "other" };
        Assert.True((await users.CreateAsync(user)).Succeeded);
        Assert.True((await users.CreateAsync(other)).Succeeded);
        await DevelopmentIdentityRoles.AssignAsync(users, user.Email, "Learner");
        await DevelopmentIdentityRoles.AssignAsync(users, user.Email, "Instructor");
        await DevelopmentIdentityRoles.AssignAsync(users, user.Email, "Instructor");
        Assert.Equal(2, (await users.GetRolesAsync(user)).Count);
        Assert.Equal("both", user.Role);
        await DevelopmentIdentityRoles.AssignAsync(users, user.Email, "GeneralAdmin");
        Assert.Equal("both", user.Role);
        Assert.True(await users.IsInRoleAsync(user, "GeneralAdmin"));
        Assert.Empty(await users.GetRolesAsync(other));
        await Assert.ThrowsAsync<ArgumentException>(() => DevelopmentIdentityRoles.AssignAsync(users, user.Email, "Combined"));
        await Assert.ThrowsAsync<ArgumentException>(() => DevelopmentIdentityRoles.AssignAsync(users, user.Email, "Guest"));
        await Assert.ThrowsAsync<ArgumentException>(() => DevelopmentIdentityRoles.AssignAsync(users, "missing@example.test", "GeneralAdmin"));
        Assert.Equal(2, await users.Users.CountAsync());
    }

    [Theory]
    [InlineData(false, null, "Instructor", 401)]
    [InlineData(true, null, "Instructor", 403)]
    [InlineData(true, "GeneralAdmin", "Instructor", 403)]
    [InlineData(true, "Instructor", "Instructor", 200)]
    [InlineData(true, "GeneralAdmin", "GeneralAdmin", 200)]
    public async Task Api_filter_uses_memberships_not_legacy_or_forged_role_claims(
        bool authenticated, string? membership, string required, int expected)
    {
        using var provider = Services();
        using var scope = provider.CreateScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var roles = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
        await DevelopmentIdentityRoles.SeedAsync(roles);
        var user = new ApplicationUser { UserName = "actor", Role = "instructor" };
        Assert.True((await users.CreateAsync(user)).Succeeded);
        if (membership is not null) Assert.True((await users.AddToRoleAsync(user, membership)).Succeeded);
        var http = new DefaultHttpContext { RequestServices = scope.ServiceProvider };
        http.User = new ClaimsPrincipal(new ClaimsIdentity(
            new[] { new Claim(ClaimTypes.NameIdentifier, user.Id), new Claim(ClaimTypes.Role, required) },
            authenticated ? "test" : null));
        var filterType = typeof(esham.PL.Endpoints.CourseEndpoints).Assembly
            .GetType("esham.PL.Endpoints.IdentityRoleFilter")!;
        var filter = (IEndpointFilter)Activator.CreateInstance(filterType, new object[] { new[] { required } })!;
        var result = await filter.InvokeAsync(
            new DefaultEndpointFilterInvocationContext(http),
            _ => ValueTask.FromResult<object?>(Results.Ok()));
        if (expected == 403)
            Assert.IsType<Microsoft.AspNetCore.Http.HttpResults.ForbidHttpResult>(result);
        else
            Assert.Equal(expected, Assert.IsAssignableFrom<IStatusCodeHttpResult>(result).StatusCode);
    }

    [Fact]
    public async Task Commands_are_rejected_in_production_before_database_access()
    {
        await using var app = WebApplication.CreateBuilder(new WebApplicationOptions { EnvironmentName = "Production" }).Build();
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            DevelopmentIdentityRoles.RunCommandAsync(app, ["--identity-roles", "audit"]));
    }
}
