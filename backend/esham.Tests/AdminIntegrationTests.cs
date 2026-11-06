using System.Text.Json;
using System.Security.Claims;
using esham.BLL.DTOs;
using esham.BLL.Services;
using esham.DAL.Data;
using esham.DAL.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
using static esham.Tests.AccountFinalizationTests;
using static esham.Tests.AdminUserTests;
namespace esham.Tests;
public sealed class AdminIntegrationTests
{
    private static JsonElement Json(ServiceResult<object> result){Assert.Equal(ServiceFailure.None,result.Failure);return JsonSerializer.SerializeToElement(result.Value,new JsonSerializerOptions(JsonSerializerDefaults.Web));}
    private static string Version(ServiceResult<object> result)=>Json(result).GetProperty("version").GetString()!;
    [Fact] public async Task Overview_counts_courses_once_includes_drafts_and_does_not_publish_historical_approvals()
    {
        using var p=AdminServices();using var scope=p.CreateScope();var s=scope.ServiceProvider;var d=await PlatformModerationTests.Seed(s);var db=s.GetRequiredService<AppDbContext>();var service=new AdminIntegrationService(db);
        db.CourseVersions.Add(new(){CourseId=d.Course,CategoryId=d.Category,VersionNumber=50,ReviewStatus="approved",ApprovedAt=DateTimeOffset.UtcNow});
        db.Courses.Add(new(){OwnerUserId=d.Owner});await db.SaveChangesAsync();
        var data=Json(await service.Overview(Principal(d.General)));Assert.Equal(2,data.GetProperty("totalCourses").GetInt32());Assert.Equal(1,data.GetProperty("statusCounts").GetProperty("published").GetInt32());Assert.Equal(1,data.GetProperty("statusCounts").GetProperty("draft").GetInt32());
        var course=await db.Courses.SingleAsync(x=>x.Id==d.Course);course.PublishedVersionId=null;await db.SaveChangesAsync();
        Assert.Equal(0,Json(await service.Overview(Principal(d.General))).GetProperty("statusCounts").GetProperty("published").GetInt32());
    }
    [Fact] public async Task Canonical_roles_control_overview_candidates_and_category_scopes()
    {
        using var p=AdminServices();using var scope=p.CreateScope();var s=scope.ServiceProvider;var d=await PlatformModerationTests.Seed(s);var db=s.GetRequiredService<AppDbContext>();var service=new AdminIntegrationService(db);
        Assert.Equal(ServiceFailure.Unauthenticated,(await service.Overview(new())).Failure);
        var forged=new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier,d.Learner),new Claim(ClaimTypes.Role,"GeneralAdmin")],"forged"));
        Assert.Equal(ServiceFailure.Forbidden,(await service.Overview(forged)).Failure);
        Assert.Equal(ServiceFailure.Forbidden,(await service.Administrators(Principal(d.Reviewer))).Failure);
        Assert.Equal(1,Json(await service.Categories(Principal(d.Reviewer))).GetArrayLength());Assert.Equal(0,Json(await service.Categories(Principal(d.Outsider))).GetArrayLength());
        Assert.Equal(ServiceFailure.Forbidden,(await service.Assignments(d.Category,Principal(d.Reviewer))).Failure);
        Assert.Equal(ServiceFailure.Forbidden,(await service.Categories(Principal(d.Learner))).Failure);
    }
    [Fact] public async Task Assignment_updates_are_versioned_audited_and_never_grant_or_remove_identity_roles()
    {
        using var p=AdminServices();using var scope=p.CreateScope();var s=scope.ServiceProvider;var d=await PlatformModerationTests.Seed(s);var db=s.GetRequiredService<AppDbContext>();var service=new AdminIntegrationService(db);
        var roles=await db.UserRoles.CountAsync();var state=await service.Assignments(d.Category,Principal(d.General));var version=Version(state);
        Assert.Equal(ServiceFailure.Forbidden,(await service.SetAssignments(d.Category,Principal(d.Reviewer),new([d.Outsider],version))).Failure);
        Assert.Equal(ServiceFailure.Validation,(await service.SetAssignments(d.Category,Principal(d.General),new([d.Learner],version))).Failure);
        var changed=await service.SetAssignments(d.Category,Principal(d.General),new([d.Outsider],version));Assert.Equal(ServiceFailure.None,changed.Failure);
        Assert.Equal(ServiceFailure.Conflict,(await service.SetAssignments(d.Category,Principal(d.General),new([d.Reviewer],version))).Failure);
        Assert.Equal(roles,await db.UserRoles.CountAsync());Assert.False((await db.CategoryAdminAssignments.SingleAsync(x=>x.UserId==d.Reviewer)).IsActive);Assert.True((await db.CategoryAdminAssignments.SingleAsync(x=>x.UserId==d.Outsider)).IsActive);
        Assert.Equal(1,await db.AdminActivityLogs.CountAsync(x=>x.Action=="category.assignments.updated"));
        Assert.Equal(0,Json(await service.Categories(Principal(d.Reviewer))).GetArrayLength());Assert.Equal(1,Json(await service.Categories(Principal(d.Outsider))).GetArrayLength());
        Assert.Equal(ServiceFailure.None,(await service.SetAssignments(d.Category,Principal(d.General),new([d.Outsider],Version(changed)))).Failure);Assert.Equal(1,await db.AdminActivityLogs.CountAsync(x=>x.Action=="category.assignments.updated"));
    }
    [AccountSqlServerFact] public async Task Sql_queries_and_concurrent_assignment_writes_use_explicit_isolated_database()
    {
        var cs=Environment.GetEnvironmentVariable("ESHAM_ACCOUNT_TEST_SQLSERVER");var parsed=new Microsoft.Data.SqlClient.SqlConnectionStringBuilder(cs);
        if(parsed.DataSource!=@"(localdb)\MSSQLLocalDB"||!parsed.InitialCatalog.StartsWith("Esham_AccountTests_"))throw new InvalidOperationException("Isolated LocalDB required.");
        using var p=AdminServices(o=>o.UseSqlServer(cs,x=>x.EnableRetryOnFailure()));using var scope=p.CreateScope();var s=scope.ServiceProvider;var d=await PlatformModerationTests.Seed(s);var db=s.GetRequiredService<AppDbContext>();var service=new AdminIntegrationService(db);
        Assert.Equal(await db.Courses.CountAsync(),Json(await service.Overview(Principal(d.General))).GetProperty("totalCourses").GetInt32());
        Assert.Equal(1,Json(await service.Categories(Principal(d.Reviewer))).GetArrayLength());Assert.True(Json(await service.Administrators(Principal(d.General))).GetArrayLength()>0);
        var version=Version(await service.Assignments(d.Category,Principal(d.General)));
        async Task<ServiceResult<object>> Change(string[] ids){using var independent=p.CreateScope();return await new AdminIntegrationService(independent.ServiceProvider.GetRequiredService<AppDbContext>()).SetAssignments(d.Category,Principal(d.General),new(ids,version));}
        var results=await Task.WhenAll(Change([d.Outsider]),Change([]));
        Assert.Single(results,x=>x.Failure==ServiceFailure.None);Assert.Single(results,x=>x.Failure==ServiceFailure.Conflict);
        Assert.Equal(1,await db.AdminActivityLogs.CountAsync(x=>x.CategoryId==d.Category&&x.Action=="category.assignments.updated"));
    }
}
