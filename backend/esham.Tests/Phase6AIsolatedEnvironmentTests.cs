using System.Text.Json;
using esham.BLL.DTOs;
using esham.BLL.Services;
using esham.DAL.Data;
using esham.DAL.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
using static esham.Tests.AccountFinalizationTests;
namespace esham.Tests;

public sealed class Phase6ASetupFact : FactAttribute
{
    public Phase6ASetupFact() { if(Environment.GetEnvironmentVariable("ESHAM_PHASE6A_SETUP")!="fixtures" || !EnrollmentSqlServerTests.Configured())Skip="Explicit guarded Phase6A synthetic fixture action only."; }
}
public sealed class Phase6AIsolatedEnvironmentTests
{
    [Phase6ASetupFact] public async Task Fresh_separate_admin_roles_and_trusted_public_recommendation_course()
    {
        using var provider=await CompletionSqlServerTests.Provider();using var scope=provider.CreateScope();var s=scope.ServiceProvider;
        var db=s.GetRequiredService<AppDbContext>();Assert.True(await CompletionSqlServerTests.Gate(db).IsEnabledAsync());
        var users=s.GetRequiredService<UserManager<ApplicationUser>>();
        var general=await Seed(s);var categoryAdmin=await Seed(s);var instructor=await Seed(s);
        Assert.True((await users.AddToRoleAsync((await users.FindByIdAsync(general))!,"GeneralAdmin")).Succeeded);
        Assert.True((await users.AddToRoleAsync((await users.FindByIdAsync(categoryAdmin))!,"CategoryAdmin")).Succeeded);
        Assert.Equal(esham.BLL.Interfaces.AccountFailure.None,(await s.GetRequiredService<AccountService>().UpdateCurrentProfileAsync(Principal(instructor),Profile("instructor","p6afi_"+Guid.NewGuid().ToString("N")[..12]))).Failure);
        var fixture=await CourseReviewWorkflowTests.Seed(db,instructor,categoryAdmin);
        var reviews=new CourseReviewService(db,new CourseReviewWorkflowTests.Store());
        Assert.Equal(ServiceFailure.None,(await reviews.SubmitAsync(fixture.CourseId,new(instructor,true,false),new(fixture.VersionId))).Failure);
        Assert.Equal(ServiceFailure.None,(await reviews.DecideAsync(fixture.CourseId,fixture.VersionId,new(categoryAdmin,false,false,true),new("approved",null))).Failure);
        // A second recommendation in the learner's existing synthetic enrollment category.
        var phase5=Path.GetFullPath(Path.Combine(Phase5SqlTests.Artifacts(),"../phase5-isolated"));
        using var previous=JsonDocument.Parse(await File.ReadAllTextAsync((await File.ReadAllTextAsync(Path.Combine(phase5,"current-fixture-path.txt"))).Trim()));
        var original=previous.RootElement.GetProperty("versionId").GetGuid();var category=await db.CourseVersions.Where(x=>x.Id==original).Select(x=>x.CategoryId).SingleAsync();
        var recommendation=new Course{OwnerUserId=instructor};db.Courses.Add(recommendation);await db.SaveChangesAsync();
        var version=new CourseVersion{CourseId=recommendation.Id,CategoryId=category,TitleEn="Synthetic Phase6A next learning course",TitleAr="دورة اختبار للخطوة التالية",DescriptionEn="Synthetic recommendation course for isolated testing",ReviewStatus="approved",ApprovedAt=DateTimeOffset.UtcNow,VersionNumber=1};db.CourseVersions.Add(version);await db.SaveChangesAsync();recommendation.PublishedVersionId=version.Id;await db.SaveChangesAsync();
        var draft=await CourseReviewWorkflowTests.Seed(db,instructor,categoryAdmin);
        async Task<object> Account(string id){var user=(await users.FindByIdAsync(id))!;return new{id,email=user.Email,password=Password};}
        var path=Path.GetFullPath(Path.Combine(Phase5SqlTests.Artifacts(),"../phase6a-results"));Directory.CreateDirectory(path);
        await File.WriteAllTextAsync(Path.Combine(path,"browser-fixtures.json"),JsonSerializer.Serialize(new{general=await Account(general),categoryAdmin=await Account(categoryAdmin),instructor=await Account(instructor),courseId=fixture.CourseId,versionId=fixture.VersionId,recommendationId=recommendation.Id,categoryId=fixture.CategoryId,draftCourseId=draft.CourseId,draftVersionId=draft.VersionId}));
    }
}
