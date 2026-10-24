using System.Security.Claims;
using esham.BLL.Interfaces;
using esham.BLL.Services;
using esham.DAL.Data;
using esham.DAL.Entities;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Microsoft.Net.Http.Headers;
using Xunit;

namespace esham.Tests;

public sealed class AccountLoginTests
{
    // Credentials exist only in each isolated in-memory test database.
    private const string TestPassword = "LoginRegression123!";

    private static ServiceProvider Services()
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddDataProtection();
        services.AddDbContext<AppDbContext>(options =>
            options.UseInMemoryDatabase(Guid.NewGuid().ToString()));
        services.AddIdentity<ApplicationUser, IdentityRole>()
            .AddEntityFrameworkStores<AppDbContext>().AddDefaultTokenProviders();
        services.ConfigureApplicationCookie(options => options.Cookie.Name = "Esham.Identity");
        services.AddScoped<AccountService>();
        return services.BuildServiceProvider();
    }

    [Theory]
    [InlineData("GeneralAdmin", null)]
    [InlineData("GeneralAdmin", "")]
    [InlineData("CategoryAdmin", null)]
    [InlineData("CategoryAdmin", "")]
    [InlineData("GeneralAdmin", "learner")]
    [InlineData("Instructor", "instructor")]
    [InlineData("Learner", "learner")]
    [InlineData("Instructor", "both")]
    public async Task Valid_login_issues_existing_nonpersistent_identity_cookie(
        string identityRole, string? persona)
    {
        using var provider = Services();
        using var scope = provider.CreateScope();
        var services = scope.ServiceProvider;
        var users = services.GetRequiredService<UserManager<ApplicationUser>>();
        var roles = services.GetRequiredService<RoleManager<IdentityRole>>();
        Assert.True((await roles.CreateAsync(new IdentityRole(identityRole))).Succeeded);
        var user = new ApplicationUser { UserName = "login_test", Email = "login@example.test", Role = persona };
        Assert.True((await users.CreateAsync(user, TestPassword)).Succeeded);
        Assert.True((await users.AddToRoleAsync(user, identityRole)).Succeeded);
        var http = new DefaultHttpContext { RequestServices = services };
        services.GetRequiredService<IHttpContextAccessor>().HttpContext = http;

        var result = await services.GetRequiredService<AccountService>()
            .LoginAsync(new(user.Email, TestPassword));

        Assert.Equal(AccountFailure.None, result.Failure);
        Assert.Equal(user.Id, result.Profile!.Id);
        Assert.Equal(persona, result.Profile.Role);
        Assert.False(result.OnboardingRequired);
        Assert.Equal(new[] { identityRole }, await users.GetRolesAsync(user));
        Assert.Equal(persona, (await users.FindByIdAsync(user.Id))!.Role);

        var cookie = Assert.Single(SetCookieHeaderValue.ParseList(http.Response.Headers.SetCookie.Select(value => value!).ToArray()));
        Assert.Equal("Esham.Identity", cookie.Name.Value);
        Assert.True(cookie.HttpOnly);
        Assert.Null(cookie.Expires);
        var cookieOptions = services.GetRequiredService<IOptionsMonitor<CookieAuthenticationOptions>>()
            .Get(IdentityConstants.ApplicationScheme);
        var ticket = cookieOptions.TicketDataFormat.Unprotect(cookie.Value.Value!);
        Assert.NotNull(ticket);
        Assert.Equal(IdentityConstants.ApplicationScheme, ticket.AuthenticationScheme);
        Assert.False(ticket.Properties.IsPersistent);
        Assert.Equal(user.Id, ticket.Principal.FindFirstValue(ClaimTypes.NameIdentifier));
        Assert.True(ticket.Principal.IsInRole(identityRole));
    }

    [Theory]
    [InlineData(null, null)]
    [InlineData(null, "")]
    [InlineData(null, "GeneralAdmin")]
    [InlineData(null, "CategoryAdmin")]
    [InlineData("Instructor", null)]
    [InlineData("Learner", "")]
    public async Task Incomplete_normal_accounts_require_onboarding_and_receive_no_cookie(
        string? identityRole, string? persona)
    {
        using var provider = Services();
        using var scope = provider.CreateScope();
        var services = scope.ServiceProvider;
        var users = services.GetRequiredService<UserManager<ApplicationUser>>();
        var user = new ApplicationUser { UserName = "incomplete", Email = "incomplete@example.test", Role = persona };
        Assert.True((await users.CreateAsync(user, TestPassword)).Succeeded);
        if (identityRole is not null)
        {
            var roles = services.GetRequiredService<RoleManager<IdentityRole>>();
            Assert.True((await roles.CreateAsync(new IdentityRole(identityRole))).Succeeded);
            Assert.True((await users.AddToRoleAsync(user, identityRole)).Succeeded);
        }
        var http = new DefaultHttpContext { RequestServices = services };
        services.GetRequiredService<IHttpContextAccessor>().HttpContext = http;

        var result = await services.GetRequiredService<AccountService>()
            .LoginAsync(new(user.Email, TestPassword));

        Assert.Equal(AccountFailure.OnboardingRequired, result.Failure);
        Assert.Null(result.Profile);
        Assert.Equal(0, http.Response.Headers.SetCookie.Count);
    }

    [Theory]
    [InlineData("GeneralAdmin", null)]
    [InlineData("CategoryAdmin", "")]
    [InlineData("Instructor", "instructor")]
    public async Task Invalid_password_is_rejected_even_for_administrators(
        string identityRole, string? persona)
    {
        using var provider = Services();
        using var scope = provider.CreateScope();
        var services = scope.ServiceProvider;
        var users = services.GetRequiredService<UserManager<ApplicationUser>>();
        var roles = services.GetRequiredService<RoleManager<IdentityRole>>();
        Assert.True((await roles.CreateAsync(new IdentityRole(identityRole))).Succeeded);
        var user = new ApplicationUser { UserName = "invalid_password", Email = "invalid@example.test", Role = persona };
        Assert.True((await users.CreateAsync(user, TestPassword)).Succeeded);
        Assert.True((await users.AddToRoleAsync(user, identityRole)).Succeeded);
        var http = new DefaultHttpContext { RequestServices = services };
        services.GetRequiredService<IHttpContextAccessor>().HttpContext = http;

        var result = await services.GetRequiredService<AccountService>()
            .LoginAsync(new(user.Email, "IncorrectPassword123!"));

        Assert.Equal(AccountFailure.InvalidCredentials, result.Failure);
        Assert.Null(result.Profile);
        Assert.Equal(0, http.Response.Headers.SetCookie.Count);
        Assert.Equal(1, await users.GetAccessFailedCountAsync(user));
    }
}
