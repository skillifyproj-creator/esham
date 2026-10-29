using esham.BLL.DTOs;
using esham.BLL.DTOs.AdminUsers;
using esham.BLL.Services;
using esham.DAL.Data;
using esham.DAL.Entities;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
using static esham.Tests.AccountFinalizationTests;
using static esham.Tests.AdminUserTests;

namespace esham.Tests;

public sealed class AdminUserSqlServerTests
{
    private static ServiceProvider Database(params IInterceptor[] interceptors)
    {
        var connection = Environment.GetEnvironmentVariable("ESHAM_ACCOUNT_TEST_SQLSERVER");
        if (string.IsNullOrWhiteSpace(connection) || !new SqlConnectionStringBuilder(connection).InitialCatalog.StartsWith("Esham_AccountTests_", StringComparison.Ordinal))
            throw new InvalidOperationException("Only a separately provisioned Esham_AccountTests_* database may run these tests.");
        return AdminServices(options => options.UseSqlServer(connection, sql => sql.EnableRetryOnFailure(3, TimeSpan.Zero, null)).AddInterceptors(interceptors));
    }

    [AccountSqlServerFact]
    public async Task Cross_demotions_cannot_remove_both_administrators()
    {
        using var provider = Database(); string a, b; AdminUserDto first, second;
        using (var setup = provider.CreateScope())
        {
            var s = setup.ServiceProvider; a = await Create(s, "admin_a", "GeneralAdmin"); b = await Create(s, "admin_b", "GeneralAdmin");
            first = await Detail(s, a, a); second = await Detail(s, b, b);
        }
        var gate = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        async Task<ServiceResult<AdminUserDto>> Demote(string actor, AdminUserDto target)
        {
            await gate.Task; using var scope = provider.CreateScope();
            return await scope.ServiceProvider.GetRequiredService<AdminUserService>().UpdateRolesAsync(Principal(actor), target.Id, new(["Learner"], target.Version));
        }
        var tasks = new[] { Demote(a, second), Demote(b, first) }; gate.SetResult();
        var results = await Task.WhenAll(tasks);
        Assert.Single(results, x => x.Failure == ServiceFailure.None);
        Assert.Single(results, x => x.Failure == ServiceFailure.Forbidden);
        using var verify = provider.CreateScope(); var s2 = verify.ServiceProvider;
        var selected = await s2.GetRequiredService<AppDbContext>().Users.Where(x => x.Id == a || x.Id == b).ToListAsync();
        var manager = s2.GetRequiredService<Microsoft.AspNetCore.Identity.UserManager<ApplicationUser>>();
        var remaining = 0; foreach (var user in selected) if (await manager.IsInRoleAsync(user, "GeneralAdmin")) remaining++;
        Assert.Equal(1, remaining);
    }

    [AccountSqlServerFact]
    public async Task Conflicting_updates_with_the_same_version_commit_only_one_action()
    {
        using var provider = Database(); string actor, target; AdminUserDto original;
        using (var setup = provider.CreateScope())
        {
            var s = setup.ServiceProvider; actor = await Create(s, "root", "GeneralAdmin"); target = await Create(s, "target", "Learner"); original = await Detail(s, actor, target);
        }
        var gate = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        async Task<ServiceResult<AdminUserDto>> Update(bool lockout)
        {
            await gate.Task; using var scope = provider.CreateScope(); var service = scope.ServiceProvider.GetRequiredService<AdminUserService>();
            return lockout ? await service.UpdateLockoutAsync(Principal(actor), target, new(DateTimeOffset.UtcNow.AddHours(1), original.Version))
                : await service.UpdateRolesAsync(Principal(actor), target, new(["Instructor"], original.Version));
        }
        var tasks = new[] { Update(true), Update(false) }; gate.SetResult();
        var results = await Task.WhenAll(tasks);
        Assert.Single(results, x => x.Failure == ServiceFailure.None); Assert.Single(results, x => x.Failure == ServiceFailure.Conflict);
        using var verify = provider.CreateScope();
        Assert.Equal(1, await verify.ServiceProvider.GetRequiredService<AppDbContext>().AdminActivityLogs.CountAsync(x => x.TargetId == target));
    }

    [AccountSqlServerFact]
    public async Task Failure_after_identity_saves_rolls_back_memberships_persona_security_stamp_and_audit()
    {
        var interceptor = new RejectAuditSave(); using var provider = Database(interceptor);
        using var scope = provider.CreateScope(); var s = scope.ServiceProvider;
        var actor = await Create(s, "root", "GeneralAdmin"); var target = await Create(s, "target", "Learner");
        var detail = await Detail(s, actor, target); var db = s.GetRequiredService<AppDbContext>();
        var stamp = (await db.Users.SingleAsync(x => x.Id == target)).SecurityStamp;
        interceptor.Armed = true;
        await Assert.ThrowsAsync<InvalidOperationException>(() => s.GetRequiredService<AdminUserService>()
            .UpdateRolesAsync(Principal(actor), target, new(["GeneralAdmin", "Instructor"], detail.Version)));
        Assert.Empty(db.ChangeTracker.Entries());
        var after = await Detail(s, actor, target);
        Assert.Equal(detail.Version, after.Version); Assert.Equal(new[] { "Learner" }, after.Roles);
        Assert.Equal(stamp, (await db.Users.SingleAsync(x => x.Id == target)).SecurityStamp);
        Assert.False(await db.AdminActivityLogs.AnyAsync(x => x.TargetId == target));
    }

    [AccountSqlServerFact]
    public async Task Actual_sql_directory_queries_support_search_roles_status_and_pagination()
    {
        using var provider = Database(); using var scope = provider.CreateScope(); var s = scope.ServiceProvider;
        var actor = await Create(s, "root", "GeneralAdmin"); var term = "query_" + Guid.NewGuid().ToString("N")[..8];
        var target = await Create(s, term, "Learner", "Instructor");
        var result = await s.GetRequiredService<AdminUserService>().GetUsersAsync(Principal(actor), new(PageSize: 1, Search: term, Role: "Instructor", Status: "unlocked"));
        Assert.Equal(ServiceFailure.None, result.Failure); Assert.Equal(1, result.Value!.TotalCount); Assert.Equal(target, result.Value.Items.Single().Id);
    }

    private sealed class RejectAuditSave : SaveChangesInterceptor
    {
        public bool Armed { get; set; }
        public override ValueTask<InterceptionResult<int>> SavingChangesAsync(DbContextEventData eventData,
            InterceptionResult<int> result, CancellationToken cancellationToken = default)
        {
            if (Armed && eventData.Context!.ChangeTracker.Entries<AdminActivityLog>().Any(x => x.State == EntityState.Added))
            { Armed = false; throw new InvalidOperationException("Injected administrative audit save failure."); }
            return ValueTask.FromResult(result);
        }
    }
}
