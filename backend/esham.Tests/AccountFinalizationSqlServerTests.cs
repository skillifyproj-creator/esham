using System.Data.Common;
using esham.BLL.Interfaces;
using esham.BLL.Services;
using esham.DAL.Data;
using esham.DAL.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
using static esham.Tests.AccountFinalizationTests;

namespace esham.Tests;

// Explicit opt-in only. Never reads appsettings/User Secrets, creates schema, or uses
// the application database. An existing isolated database must be provisioned separately.
public sealed class AccountSqlServerFactAttribute : FactAttribute
{
    public AccountSqlServerFactAttribute()
    {
        if (Environment.GetEnvironmentVariable("ESHAM_RUN_ISOLATED_SQL_TESTS") != "1")
            Skip = "Requires explicit opt-in and a separately provisioned Esham_AccountTests_* SQL Server database.";
    }
}

public sealed class AccountFinalizationSqlServerTests
{
    internal static ServiceProvider DatabaseServices(params IInterceptor[] interceptors)
    {
        var connection = Environment.GetEnvironmentVariable("ESHAM_ACCOUNT_TEST_SQLSERVER");
        if (string.IsNullOrWhiteSpace(connection)) throw new InvalidOperationException("Isolated account test database is not configured.");
        var parsed = new SqlConnectionStringBuilder(connection);
        if (!parsed.InitialCatalog.StartsWith("Esham_AccountTests_", StringComparison.Ordinal))
            throw new InvalidOperationException("Refusing a database without the isolated account-test name prefix.");
        return Services(options => options.UseSqlServer(connection, sql => sql.EnableRetryOnFailure(3, TimeSpan.Zero, null))
            .AddInterceptors(interceptors));
    }

    private static async Task<string> CreateUser(ServiceProvider provider)
    {
        using var scope = provider.CreateScope();
        return await Seed(scope.ServiceProvider, administrator: true);
    }

    private static async Task<AccountResult> Finalize(ServiceProvider provider, string id)
    {
        using var scope = provider.CreateScope();
        Http(scope.ServiceProvider, id);
        return await scope.ServiceProvider.GetRequiredService<AccountService>()
            .UpdateCurrentProfileAsync(Principal(id), Profile("both", "u_" + id.Replace("-", "")[..20]));
    }

    private static async Task AssertFinalized(ServiceProvider provider, string id)
    {
        using var scope = provider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(20, (await db.Wallets.SingleAsync(x => x.UserId == id)).Balance);
        var entry = Assert.Single(await db.PointTransactions.Where(x => x.UserId == id).ToListAsync());
        Assert.Equal(20, entry.Amount);
        Assert.Equal("welcome", entry.TransactionType);
        Assert.Equal(NotificationWriter.WelcomeId(id), (await db.Notifications.SingleAsync(x => x.RecipientUserId == id)).Id);
        var user = await db.Users.SingleAsync(x => x.Id == id);
        Assert.Equal("both", user.Role);
        Assert.Equal(new[] { "CategoryAdmin", "GeneralAdmin", "Instructor", "Learner" },
            (await scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>().GetRolesAsync(user)).Order());
    }

    [AccountSqlServerFact]
    public async Task Concurrent_initialization_from_independent_scopes_grants_welcome_once()
    {
        using var provider = DatabaseServices();
        var id = await CreateUser(provider);
        var gate = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var tasks = Enumerable.Range(0, 8).Select(async _ =>
        {
            await gate.Task;
            return await Finalize(provider, id);
        }).ToArray();
        gate.SetResult();
        Assert.All(await Task.WhenAll(tasks), x => Assert.Equal(AccountFailure.None, x.Failure));
        await AssertFinalized(provider, id);
    }

    [AccountSqlServerFact]
    public async Task Failure_after_identity_writes_rolls_back_profile_memberships_wallet_and_ledger()
    {
        var failure = new WalletSaveFailure(transient: false);
        using var provider = DatabaseServices(failure);
        var id = await CreateUser(provider);
        string? originalStamp;
        using (var before = provider.CreateScope())
            originalStamp = (await before.ServiceProvider.GetRequiredService<AppDbContext>().Users.SingleAsync(x => x.Id == id)).SecurityStamp;
        failure.Armed = true;
        await Assert.ThrowsAsync<InvalidOperationException>(() => Finalize(provider, id));
        using (var scope = provider.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var user = await db.Users.SingleAsync(x => x.Id == id);
            Assert.Null(user.Role);
            Assert.Null(user.Name);
            Assert.Null(user.Goal);
            Assert.Empty(user.Interests);
            Assert.Empty(user.TeachingAreas);
            Assert.Equal(originalStamp, user.SecurityStamp);
            Assert.Equal(new[] { "CategoryAdmin", "GeneralAdmin" },
                (await scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>().GetRolesAsync(user)).Order());
            Assert.False(await db.Wallets.AnyAsync(x => x.UserId == id));
            Assert.False(await db.PointTransactions.AnyAsync(x => x.UserId == id));
            Assert.False(await db.Notifications.AnyAsync(x => x.RecipientUserId == id));
        }
        Assert.Equal(AccountFailure.None, (await Finalize(provider, id)).Failure);
        await AssertFinalized(provider, id);
    }

    [AccountSqlServerFact]
    public async Task Execution_strategy_retries_from_fresh_state_after_partial_identity_writes()
    {
        var failure = new WalletSaveFailure(transient: true);
        using var provider = DatabaseServices(failure);
        var id = await CreateUser(provider);
        failure.Armed = true;
        Assert.Equal(AccountFailure.None, (await Finalize(provider, id)).Failure);
        Assert.Equal(2, failure.WalletSaveAttempts);
        await AssertFinalized(provider, id);
    }

    [AccountSqlServerFact]
    public async Task Lost_commit_acknowledgement_replays_without_a_second_welcome()
    {
        var failure = new LostCommitAcknowledgement();
        using var provider = DatabaseServices(failure);
        var id = await CreateUser(provider);
        failure.Armed = true;
        Assert.Equal(AccountFailure.None, (await Finalize(provider, id)).Failure);
        Assert.True(failure.Injected);
        await AssertFinalized(provider, id);
    }

    [AccountSqlServerFact]
    public async Task Existing_identity_validation_failure_rolls_back_without_welcome()
    {
        using var provider = DatabaseServices();
        var id = await CreateUser(provider);
        var otherId = await CreateUser(provider);
        using var scope = provider.CreateScope();
        var services = scope.ServiceProvider;
        var db = services.GetRequiredService<AppDbContext>();
        var other = await db.Users.SingleAsync(x => x.Id == otherId);
        var collision = "u_" + otherId.Replace("-", "")[..20];
        Assert.True((await services.GetRequiredService<UserManager<ApplicationUser>>().SetUserNameAsync(other, collision)).Succeeded);
        Http(services, id);
        var result = await services.GetRequiredService<AccountService>()
            .UpdateCurrentProfileAsync(Principal(id), Profile("learner", collision));
        Assert.Equal(AccountFailure.UsernameAlreadyExists, result.Failure);
        Assert.Null((await db.Users.SingleAsync(x => x.Id == id)).Role);
        Assert.False(await db.Wallets.AnyAsync(x => x.UserId == id));
        Assert.False(await db.PointTransactions.AnyAsync(x => x.UserId == id));
    }

    private sealed class WalletSaveFailure(bool transient) : SaveChangesInterceptor
    {
        public bool Armed { get; set; }
        public int WalletSaveAttempts { get; private set; }
        public override ValueTask<InterceptionResult<int>> SavingChangesAsync(DbContextEventData eventData,
            InterceptionResult<int> result, CancellationToken cancellationToken = default)
        {
            if (eventData.Context!.ChangeTracker.Entries<Wallet>().Any(x => x.State == EntityState.Added))
            {
                WalletSaveAttempts++;
                if (Armed)
                {
                    Armed = false;
                    if (transient) throw new TimeoutException("Injected account test transient failure.");
                    throw new InvalidOperationException("Injected account test save failure.");
                }
            }
            return ValueTask.FromResult(result);
        }
    }

    private sealed class LostCommitAcknowledgement : DbTransactionInterceptor
    {
        public bool Armed { get; set; }
        public bool Injected { get; private set; }
        public override Task TransactionCommittedAsync(DbTransaction transaction, TransactionEndEventData eventData,
            CancellationToken cancellationToken = default)
        {
            if (Armed)
            {
                Armed = false;
                Injected = true;
                throw new TimeoutException("Injected loss of commit acknowledgement.");
            }
            return Task.CompletedTask;
        }
    }
}
