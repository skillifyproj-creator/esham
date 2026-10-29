using System.Security.Claims;
using esham.BLL.Interfaces;
using esham.BLL.Services;
using esham.DAL.Data;
using esham.DAL.Entities;
using esham.PL.Development;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Microsoft.Net.Http.Headers;
using Xunit;

namespace esham.Tests;

// Service-rule tests only: TestTransactionManager does not implement SQL rollback/locking.
// Real rollback, overlapping requests and execution retries are tested separately below.
public sealed class AccountFinalizationTests
{
    internal const string Password = "AccountRecovery123!";
    internal static ServiceProvider Services(Action<DbContextOptionsBuilder>? configure = null)
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddDataProtection();
        var database = Guid.NewGuid().ToString();
        services.AddDbContext<AppDbContext>(options =>
        {
            if (configure is null)
                options.UseInMemoryDatabase(database).ReplaceService<IDbContextTransactionManager, TestTransactionManager>();
            else configure(options);
        });
        services.AddIdentity<ApplicationUser, IdentityRole>(options => options.User.RequireUniqueEmail = true)
            .AddEntityFrameworkStores<AppDbContext>().AddDefaultTokenProviders();
        services.AddScoped<AccountService>();
        services.AddScoped<INotificationWriter, NotificationWriter>();
        return services.BuildServiceProvider();
    }

    internal static ClaimsPrincipal Principal(string id) => new(new ClaimsIdentity(
        [new Claim(ClaimTypes.NameIdentifier, id)], "test"));

    internal static void Http(IServiceProvider services, string id)
    {
        var context = new DefaultHttpContext
        {
            RequestServices = services, User = Principal(id),
        };
        services.GetRequiredService<IHttpContextAccessor>().HttpContext = context;
        services.GetRequiredService<SignInManager<ApplicationUser>>().Context = context;
    }

    internal static UpdateProfileCommand Profile(string role, string username = "recovered_user") =>
        new("Recovered User", null, username, role, null, "Profile", [0], [1], [], 0);

    internal static async Task<string> Seed(IServiceProvider services, bool administrator = false)
    {
        var roles = services.GetRequiredService<RoleManager<IdentityRole>>();
        await DevelopmentIdentityRoles.SeedAsync(roles);
        var users = services.GetRequiredService<UserManager<ApplicationUser>>();
        var user = new ApplicationUser { UserName = Guid.NewGuid().ToString("N"), Email = $"{Guid.NewGuid():N}@example.test" };
        Assert.True((await users.CreateAsync(user, Password)).Succeeded);
        if (administrator)
        {
            Assert.True((await users.AddToRoleAsync(user, "GeneralAdmin")).Succeeded);
            Assert.True((await users.AddToRoleAsync(user, "CategoryAdmin")).Succeeded);
        }
        Http(services, user.Id);
        return user.Id;
    }

    [Theory]
    [InlineData("learner", "Learner")]
    [InlineData("instructor", "Instructor")]
    [InlineData("both", "Instructor,Learner")]
    public async Task Finalization_preserves_identity_and_grants_exact_memberships_and_welcome(string persona, string expected)
    {
        using var provider = Services();
        using var scope = provider.CreateScope();
        var services = scope.ServiceProvider;
        var id = await Seed(services);
        var account = services.GetRequiredService<AccountService>();
        var result = await account.UpdateCurrentProfileAsync(Principal(id), Profile(persona));
        Assert.Equal(AccountFailure.None, result.Failure);
        Assert.Equal(id, result.Profile!.Id);
        var db = services.GetRequiredService<AppDbContext>();
        var user = await db.Users.SingleAsync();
        Assert.Equal(id, user.Id);
        Assert.Equal(persona, user.Role);
        var memberships = await services.GetRequiredService<UserManager<ApplicationUser>>().GetRolesAsync(user);
        Assert.Equal(expected, string.Join(",", memberships.Order()));
        Assert.False(await db.Roles.AnyAsync(x => x.Name == "Combined"));
        Assert.Equal(20, (await db.Wallets.SingleAsync()).Balance);
        var entry = await db.PointTransactions.SingleAsync();
        Assert.Equal(id, entry.UserId);
        Assert.Equal(20, entry.Amount);
        Assert.Equal("welcome", entry.TransactionType);
        Assert.StartsWith("welcome:", entry.OperationKey);
        Assert.False((await account.GetCurrentSessionAsync(Principal(id))).OnboardingRequired);
        Assert.Equal(AccountFailure.None, (await account.LoginAsync(new(user.Email, Password))).Failure);
        Assert.Single(await db.PointTransactions.ToListAsync());
    }

    [Fact]
    public async Task Retries_role_changes_and_logins_preserve_welcome_and_existing_balance()
    {
        using var provider = Services();
        using var scope = provider.CreateScope();
        var services = scope.ServiceProvider;
        var id = await Seed(services, administrator: true);
        var account = services.GetRequiredService<AccountService>();
        Assert.Equal(AccountFailure.None, (await account.UpdateCurrentProfileAsync(Principal(id), Profile("both"))).Failure);
        var db = services.GetRequiredService<AppDbContext>();
        var entryId = (await db.PointTransactions.SingleAsync()).Id;
        // A balance changed by later business operations must never be reset to 20.
        (await db.Wallets.SingleAsync()).Balance = 7;
        await db.SaveChangesAsync();
        foreach (var role in new[] { "both", "learner", "instructor", "both" })
        {
            Assert.Equal(AccountFailure.None, (await account.UpdateCurrentRoleAsync(Principal(id), role)).Failure);
            Assert.Equal(AccountFailure.None, (await account.UpdateCurrentProfileAsync(Principal(id), Profile(role))).Failure);
            var user = await db.Users.SingleAsync();
            Assert.Equal(AccountFailure.None, (await account.LoginAsync(new(user.Email, Password))).Failure);
            var memberships = await services.GetRequiredService<UserManager<ApplicationUser>>().GetRolesAsync(user);
            Assert.Contains("GeneralAdmin", memberships);
            Assert.Contains("CategoryAdmin", memberships);
            Assert.Equal(role == "both" ? 4 : 3, memberships.Count);
        }
        Assert.Equal(entryId, (await db.PointTransactions.SingleAsync()).Id);
        Assert.Equal(7, (await db.Wallets.SingleAsync()).Balance);
    }

    [Theory]
    [InlineData("GeneralAdmin")]
    [InlineData("CategoryAdmin")]
    [InlineData("Combined")]
    public async Task Self_service_cannot_grant_administration_or_unknown_roles(string role)
    {
        using var provider = Services();
        using var scope = provider.CreateScope();
        var services = scope.ServiceProvider;
        var id = await Seed(services);
        var account = services.GetRequiredService<AccountService>();
        Assert.Equal(AccountFailure.Validation, (await account.UpdateCurrentRoleAsync(Principal(id), role)).Failure);
        Assert.Equal(AccountFailure.Validation, (await account.UpdateCurrentProfileAsync(Principal(id), Profile(role))).Failure);
        var db = services.GetRequiredService<AppDbContext>();
        Assert.Empty(await db.UserRoles.ToListAsync());
        Assert.Empty(await db.Wallets.ToListAsync());
        Assert.Empty(await db.PointTransactions.ToListAsync());
    }

    [Theory]
    [InlineData("learner")]
    [InlineData("instructor")]
    [InlineData("both")]
    public async Task Incomplete_finalization_rejects_everything_before_any_save(string role)
    {
        using var provider = Services();
        using var scope = provider.CreateScope();
        var services = scope.ServiceProvider;
        var id = await Seed(services);
        var account = services.GetRequiredService<AccountService>();
        var command = Profile(role) with { Interests = [], TeachingAreas = [], Goal = null };
        Assert.Equal(AccountFailure.Validation, (await account.UpdateCurrentProfileAsync(Principal(id), command)).Failure);
        var db = services.GetRequiredService<AppDbContext>();
        Assert.Null((await db.Users.SingleAsync()).Role);
        Assert.Empty(await db.UserRoles.ToListAsync());
        Assert.Empty(await db.Wallets.ToListAsync());
        Assert.Empty(await db.PointTransactions.ToListAsync());
        Assert.True((await account.GetCurrentSessionAsync(Principal(id))).OnboardingRequired);
    }

    [Fact]
    public async Task Missing_provisioned_roles_fails_without_writes_or_role_creation()
    {
        using var provider = Services();
        using var scope = provider.CreateScope();
        var services = scope.ServiceProvider;
        var id = await Seed(services);
        var db = services.GetRequiredService<AppDbContext>();
        db.Roles.Remove(await db.Roles.SingleAsync(x => x.Name == "Instructor"));
        await db.SaveChangesAsync();
        var result = await services.GetRequiredService<AccountService>().UpdateCurrentProfileAsync(Principal(id), Profile("both"));
        Assert.Equal(AccountFailure.Unavailable, result.Failure);
        Assert.Null((await db.Users.SingleAsync()).Role);
        Assert.Empty(await db.UserRoles.ToListAsync());
        Assert.Empty(await db.PointTransactions.ToListAsync());
        Assert.False(await db.Roles.AnyAsync(x => x.Name == "Instructor"));
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task Inconsistent_existing_wallet_or_ledger_fails_closed(bool walletOnly)
    {
        using var provider = Services();
        using var scope = provider.CreateScope();
        var services = scope.ServiceProvider;
        var id = await Seed(services);
        var db = services.GetRequiredService<AppDbContext>();
        if (walletOnly) db.Wallets.Add(new Wallet { UserId = id, Balance = 20 });
        else db.PointTransactions.Add(new PointTransaction { UserId = id, Amount = 20, TransactionType = "legacy", OperationKey = "legacy" });
        await db.SaveChangesAsync();
        var result = await services.GetRequiredService<AccountService>().UpdateCurrentProfileAsync(Principal(id), Profile("learner"));
        Assert.Equal(AccountFailure.Conflict, result.Failure);
        Assert.Null((await db.Users.SingleAsync()).Role);
        Assert.Empty(await db.UserRoles.ToListAsync());
        Assert.Equal(walletOnly ? 0 : 1, await db.PointTransactions.CountAsync());
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Login_and_session_reject_persona_membership_mismatch_and_incomplete_profile(bool incomplete)
    {
        using var provider = Services();
        using var scope = provider.CreateScope();
        var services = scope.ServiceProvider;
        var id = await Seed(services);
        var users = services.GetRequiredService<UserManager<ApplicationUser>>();
        var user = (await users.FindByIdAsync(id))!;
        user.Role = "both"; user.Name = "Valid User"; user.Goal = incomplete ? null : 0;
        user.Interests = [0]; user.TeachingAreas = [1];
        Assert.True((await users.UpdateAsync(user)).Succeeded);
        Assert.True((await users.AddToRoleAsync(user, "Learner")).Succeeded);
        if (incomplete) Assert.True((await users.AddToRoleAsync(user, "Instructor")).Succeeded);
        var account = services.GetRequiredService<AccountService>();
        Assert.True((await account.GetCurrentSessionAsync(Principal(id))).OnboardingRequired);
        var login = await account.LoginAsync(new(user.Email, Password));
        Assert.Equal(AccountFailure.None, login.Failure);
        Assert.True(login.OnboardingRequired);
        Assert.Equal(1, services.GetRequiredService<SignInManager<ApplicationUser>>().Context.Response.Headers.SetCookie.Count);
    }

    [Fact]
    public async Task Unauthenticated_finalization_cannot_use_a_forged_identifier()
    {
        using var provider = Services();
        using var scope = provider.CreateScope();
        var id = await Seed(scope.ServiceProvider);
        var forged = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, id)]));
        Assert.Equal(AccountFailure.Unauthenticated, (await scope.ServiceProvider.GetRequiredService<AccountService>()
            .UpdateCurrentProfileAsync(forged, Profile("learner"))).Failure);
    }

    [Fact]
    public async Task Registration_cookie_is_refreshed_with_committed_memberships_after_onboarding()
    {
        using var provider = Services();
        using var scope = provider.CreateScope();
        var services = scope.ServiceProvider;
        await DevelopmentIdentityRoles.SeedAsync(services.GetRequiredService<RoleManager<IdentityRole>>());
        Http(services, "registration");
        var account = services.GetRequiredService<AccountService>();
        var result = await account.RegisterAsync(new("New User", "new@example.test", Password));
        Assert.Equal(AccountFailure.None, result.Failure);
        Assert.True(result.OnboardingRequired);
        var signIn = services.GetRequiredService<SignInManager<ApplicationUser>>();
        var cookie = Assert.Single(SetCookieHeaderValue.ParseList(signIn.Context.Response.Headers.SetCookie.Select(x => x!).ToArray()));
        var id = result.Profile!.Id;
        // A new HTTP request has a new scope/authentication handler cache.
        using var onboardingScope = provider.CreateScope();
        services = onboardingScope.ServiceProvider;
        Http(services, id);
        signIn = services.GetRequiredService<SignInManager<ApplicationUser>>();
        account = services.GetRequiredService<AccountService>();
        signIn.Context.Request.Headers.Cookie = $"{cookie.Name}={cookie.Value}";
        Assert.Equal(AccountFailure.None, (await account.UpdateCurrentProfileAsync(Principal(id), Profile("both"))).Failure);
        var refreshed = Assert.Single(SetCookieHeaderValue.ParseList(signIn.Context.Response.Headers.SetCookie.Select(x => x!).ToArray()));
        var options = services.GetRequiredService<IOptionsMonitor<CookieAuthenticationOptions>>().Get(IdentityConstants.ApplicationScheme);
        var ticket = options.TicketDataFormat.Unprotect(refreshed.Value.Value!);
        Assert.NotNull(ticket);
        Assert.Equal(id, ticket.Principal.FindFirstValue(ClaimTypes.NameIdentifier));
        Assert.True(ticket.Principal.IsInRole("Learner"));
        Assert.True(ticket.Principal.IsInRole("Instructor"));
        Assert.False(ticket.Principal.IsInRole("GeneralAdmin"));
        Assert.False(ticket.Principal.IsInRole("Combined"));
    }

    [Fact]
    public async Task Failure_before_first_identity_save_clears_tracking_and_allows_a_clean_retry()
    {
        var failure = new FirstSaveFailure();
        var database = Guid.NewGuid().ToString();
        using var provider = Services(options => options.UseInMemoryDatabase(database)
            .ReplaceService<IDbContextTransactionManager, TestTransactionManager>().AddInterceptors(failure));
        using var scope = provider.CreateScope();
        var services = scope.ServiceProvider;
        var id = await Seed(services);
        var account = services.GetRequiredService<AccountService>();
        failure.Armed = true;
        await Assert.ThrowsAsync<InvalidOperationException>(() => account.UpdateCurrentProfileAsync(Principal(id), Profile("both")));
        var db = services.GetRequiredService<AppDbContext>();
        Assert.Empty(db.ChangeTracker.Entries());
        Assert.Null((await db.Users.SingleAsync()).Role);
        Assert.Empty(await db.UserRoles.ToListAsync());
        Assert.Empty(await db.Wallets.ToListAsync());
        Assert.Empty(await db.PointTransactions.ToListAsync());
        Assert.Equal(AccountFailure.None, (await account.UpdateCurrentProfileAsync(Principal(id), Profile("both"))).Failure);
        Assert.Single(await db.PointTransactions.ToListAsync());
    }

    private sealed class FirstSaveFailure : SaveChangesInterceptor
    {
        public bool Armed { get; set; }
        public override ValueTask<InterceptionResult<int>> SavingChangesAsync(DbContextEventData eventData,
            InterceptionResult<int> result, CancellationToken cancellationToken = default)
        {
            if (Armed)
            {
                Armed = false;
                throw new InvalidOperationException("Injected failure before the first Identity save.");
            }
            return ValueTask.FromResult(result);
        }
    }
}
