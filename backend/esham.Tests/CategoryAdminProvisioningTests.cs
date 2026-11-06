using System.Security.Claims;
using System.Text.Json;
using esham.BLL.DTOs;
using esham.BLL.Services;
using esham.DAL.Data;
using esham.DAL.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
using static esham.Tests.AdminUserTests;
using static esham.Tests.AccountFinalizationTests;
namespace esham.Tests;
public sealed class CategoryAdminProvisioningTests
{
    [Fact] public async Task Creation_uses_identity_fixed_role_assignments_and_audit_without_wallet_or_general_grant()
    {
        using var p=AdminServices();using var scope=p.CreateScope();var s=scope.ServiceProvider;var d=await PlatformModerationTests.Seed(s);
        var db=s.GetRequiredService<AppDbContext>();var users=s.GetRequiredService<UserManager<ApplicationUser>>();var service=new CategoryAdminProvisioningService(db,users);
        var before=await db.Users.CountAsync();var wallets=await db.Wallets.CountAsync();var email=$"category-{Guid.NewGuid():N}@test.invalid";
        Assert.Equal(ServiceFailure.Forbidden,(await service.Create(Principal(d.Reviewer),new("Test",email,Password,[d.Category]))).Failure);
        var forged=new ClaimsPrincipal(new ClaimsIdentity([new(ClaimTypes.NameIdentifier,d.Learner),new(ClaimTypes.Role,"GeneralAdmin")],"test"));
        Assert.Equal(ServiceFailure.Forbidden,(await service.Create(forged,new("Test",email,Password,[]))).Failure);
        Assert.Equal(ServiceFailure.Unauthenticated,(await service.Create(new(),new("Test",email,Password,[]))).Failure);
        Assert.Equal(ServiceFailure.Validation,(await service.Create(Principal(d.General),new("Test",email,Password,[Guid.NewGuid()]))).Failure);
        Assert.Equal(ServiceFailure.Validation,(await service.Create(Principal(d.General),new("Test",email,"weak",[]))).Failure);
        Assert.Equal(before,await db.Users.CountAsync());
        Assert.Equal(ServiceFailure.None,(await service.Create(Principal(d.General),new("Temporary Admin",email,Password,[d.Category]))).Failure);
        var created=(await users.FindByEmailAsync(email))!;Assert.True(await users.CheckPasswordAsync(created,Password));Assert.Equal(new[]{"CategoryAdmin"},await users.GetRolesAsync(created));
        Assert.True(await db.CategoryAdminAssignments.AnyAsync(x=>x.UserId==created.Id&&x.CategoryId==d.Category&&x.IsActive));
        Assert.Equal(1,await db.AdminActivityLogs.CountAsync(x=>x.TargetId==created.Id&&x.Action=="category-admin.created"));Assert.Equal(wallets,await db.Wallets.CountAsync());Assert.False(created.EmailConfirmed);
        Assert.Equal(ServiceFailure.Conflict,(await service.Create(Principal(d.General),new("Duplicate",email,Password,[]))).Failure);
        Assert.Equal(before+1,await db.Users.CountAsync());
        Assert.Throws<JsonException>(()=>JsonSerializer.Deserialize<CreateCategoryAdminRequest>("{\"Name\":\"Test\",\"Email\":\"a@test.invalid\",\"Password\":\"test\",\"CategoryIds\":[],\"Roles\":[\"GeneralAdmin\"]}"));
    }
    [AccountSqlServerFact] public async Task Sql_creation_persists_and_rejects_invalid_scope_without_partial_account()
    {
        var cs=Environment.GetEnvironmentVariable("ESHAM_ACCOUNT_TEST_SQLSERVER");var parsed=new Microsoft.Data.SqlClient.SqlConnectionStringBuilder(cs);
        if(parsed.DataSource!=@"(localdb)\MSSQLLocalDB"||!parsed.InitialCatalog.StartsWith("Esham_AccountTests_"))throw new InvalidOperationException("Isolated LocalDB required.");
        using var p=AdminServices(o=>o.UseSqlServer(cs,x=>x.EnableRetryOnFailure()));using var scope=p.CreateScope();var s=scope.ServiceProvider;var d=await PlatformModerationTests.Seed(s);
        var db=s.GetRequiredService<AppDbContext>();var service=new CategoryAdminProvisioningService(db,s.GetRequiredService<UserManager<ApplicationUser>>());var email=$"sql-category-{Guid.NewGuid():N}@test.invalid";
        Assert.Equal(ServiceFailure.None,(await service.Create(Principal(d.General),new("SQL Admin",email,Password,[d.Category]))).Failure);
        using var fresh=p.CreateScope();var freshDb=fresh.ServiceProvider.GetRequiredService<AppDbContext>();var user=await freshDb.Users.SingleAsync(x=>x.Email==email);
        Assert.True(await freshDb.CategoryAdminAssignments.AnyAsync(x=>x.UserId==user.Id&&x.CategoryId==d.Category&&x.IsActive));
        var bad=$"bad-{Guid.NewGuid():N}@test.invalid";Assert.Equal(ServiceFailure.Validation,(await service.Create(Principal(d.General),new("Invalid",bad,Password,[Guid.NewGuid()]))).Failure);Assert.False(await freshDb.Users.AnyAsync(x=>x.Email==bad));
    }
    private sealed class RejectProvisioningAudit : Microsoft.EntityFrameworkCore.Diagnostics.SaveChangesInterceptor
    {
        public override ValueTask<Microsoft.EntityFrameworkCore.Diagnostics.InterceptionResult<int>> SavingChangesAsync(
            Microsoft.EntityFrameworkCore.Diagnostics.DbContextEventData data, Microsoft.EntityFrameworkCore.Diagnostics.InterceptionResult<int> result, CancellationToken ct=default)
        {
            if(data.Context!.ChangeTracker.Entries<AdminActivityLog>().Any(x=>x.State==EntityState.Added&&x.Entity.Action=="category-admin.created"))
                throw new DbUpdateException("Injected isolated audit failure");
            return ValueTask.FromResult(result);
        }
    }
    [AccountSqlServerFact] public async Task Sql_audit_failure_rolls_back_identity_user_role_and_scope()
    {
        var cs=Environment.GetEnvironmentVariable("ESHAM_ACCOUNT_TEST_SQLSERVER");var parsed=new Microsoft.Data.SqlClient.SqlConnectionStringBuilder(cs);
        if(parsed.DataSource!=@"(localdb)\MSSQLLocalDB"||!parsed.InitialCatalog.StartsWith("Esham_AccountTests_"))throw new InvalidOperationException("Isolated LocalDB required.");
        using var p=AdminServices(o=>o.UseSqlServer(cs,x=>x.EnableRetryOnFailure()).AddInterceptors(new RejectProvisioningAudit()));
        using var scope=p.CreateScope();var s=scope.ServiceProvider;var d=await PlatformModerationTests.Seed(s);var db=s.GetRequiredService<AppDbContext>();
        var beforeUsers=await db.Users.CountAsync();var beforeRoles=await db.UserRoles.CountAsync();var beforeAssignments=await db.CategoryAdminAssignments.CountAsync();
        var result=await new CategoryAdminProvisioningService(db,s.GetRequiredService<UserManager<ApplicationUser>>()).Create(Principal(d.General),new("Rollback Test",$"rollback-{Guid.NewGuid():N}@test.invalid",Password,[d.Category]));
        Assert.Equal(ServiceFailure.Conflict,result.Failure);
        using var fresh=p.CreateScope();var check=fresh.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(beforeUsers,await check.Users.CountAsync());Assert.Equal(beforeRoles,await check.UserRoles.CountAsync());Assert.Equal(beforeAssignments,await check.CategoryAdminAssignments.CountAsync());
    }

    [AccountSqlServerFact] public async Task Sql_duplicate_creation_race_commits_exactly_one_account_and_audit()
    {
        var cs=Environment.GetEnvironmentVariable("ESHAM_ACCOUNT_TEST_SQLSERVER");var parsed=new Microsoft.Data.SqlClient.SqlConnectionStringBuilder(cs);
        if(parsed.DataSource!=@"(localdb)\MSSQLLocalDB"||!parsed.InitialCatalog.StartsWith("Esham_AccountTests_"))throw new InvalidOperationException("Isolated LocalDB required.");
        using var p=AdminServices(o=>o.UseSqlServer(cs,x=>x.EnableRetryOnFailure()));string general;Guid category;
        using(var setup=p.CreateScope()){var d=await PlatformModerationTests.Seed(setup.ServiceProvider);general=d.General;category=d.Category;}
        var email=$"concurrent-{Guid.NewGuid():N}@test.invalid";
        async Task<ServiceResult<object>> Run(){using var scope=p.CreateScope();var s=scope.ServiceProvider;return await new CategoryAdminProvisioningService(s.GetRequiredService<AppDbContext>(),s.GetRequiredService<UserManager<ApplicationUser>>()).Create(Principal(general),new("Concurrent Admin",email,Password,[category]));}
        var results=await Task.WhenAll(Run(),Run());Assert.Single(results,x=>x.Failure==ServiceFailure.None);Assert.Single(results,x=>x.Failure==ServiceFailure.Conflict);
        using var verify=p.CreateScope();var db=verify.ServiceProvider.GetRequiredService<AppDbContext>();var user=await db.Users.SingleAsync(x=>x.Email==email);
        Assert.Equal(1,await db.AdminActivityLogs.CountAsync(x=>x.TargetId==user.Id&&x.Action=="category-admin.created"));Assert.Equal(1,await db.CategoryAdminAssignments.CountAsync(x=>x.UserId==user.Id));
    }

}
