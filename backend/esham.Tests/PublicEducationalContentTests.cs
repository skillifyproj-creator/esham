using System.Text.Json;
using esham.BLL.DTOs;
using esham.BLL.Services;
using esham.DAL.Data;
using esham.DAL.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
using static esham.Tests.CourseReviewWorkflowTests;

namespace esham.Tests;
public sealed class PublicEducationalContentTests
{
    private static readonly Guid Fixture=Guid.Parse("714e3f73-8302-45cf-a75f-fa0c0f21d0aa");
    [Fact] public async Task Exact_fixture_ids_are_hidden_without_name_guessing_or_deleting_admin_records()
    {
        using var provider=AdminUserTests.AdminServices();using var scope=provider.CreateScope();var services=scope.ServiceProvider;
        var db=services.GetRequiredService<AppDbContext>();var general=await AdminUserTests.Create(services,"visibilityadmin","GeneralAdmin");
        var ids=new[]{Fixture,Guid.Parse("e13348fe-e351-4ff2-95de-f2c67e5dc53c"),Guid.Parse("2d66aa09-8eed-45bf-b244-475a12194dac"),Guid.Parse("be9caba1-86cc-4d55-97c5-cbac48dfdd02")};
        foreach(var id in ids)db.Categories.Add(new(){Id=id,NameAr="Confirmed fixture",NameEn="Confirmed fixture",IsActive=true});
        var legitimate=new Category{NameAr="Review category",NameEn="Software Testing rva legitimate",IsActive=true};db.Categories.Add(legitimate);
        await db.SaveChangesAsync();var service=new CategoryService(db);
        Assert.Equal(legitimate.Id,Assert.Single(await service.GetActiveAsync()).Id);
        foreach(var id in ids){Assert.Equal(ServiceFailure.NotFound,(await service.GetAsync(id)).Failure);Assert.Equal(ServiceFailure.NotFound,(await service.GetChildrenAsync(id)).Failure);}
        var admin=await new AdminIntegrationService(db).Categories(AccountFinalizationTests.Principal(general));Assert.Equal(ServiceFailure.None,admin.Failure);
        Assert.Equal(5,await db.Categories.CountAsync());Assert.Equal(5,await db.Categories.CountAsync(x=>x.IsActive));
    }
    [Theory] [InlineData("learning","Learner")] [InlineData("teaching","Instructor")]
    public async Task Self_service_cannot_select_confirmed_fixtures_or_change_admin_assignments(string kind,string role)
    {
        using var provider=AccountFinalizationTests.Services();using var scope=provider.CreateScope();var services=scope.ServiceProvider;
        var id=await AccountFinalizationTests.Seed(services);await UserCategoryServiceTests.Grant(services,id,role);
        var db=services.GetRequiredService<AppDbContext>();db.Categories.Add(new(){Id=Fixture,NameAr="Fixture",NameEn="Fixture"});
        db.CategoryAdminAssignments.Add(new(){CategoryId=Fixture,UserId=id,IsActive=true});await db.SaveChangesAsync();
        var result=await UserCategoryServiceTests.Service(services).ReplaceCurrentAsync(AccountFinalizationTests.Principal(id),kind,new([Fixture]));
        Assert.Equal(ServiceFailure.Validation,result.Failure);Assert.Empty(await db.UserCategories.ToListAsync());
        Assert.True((await db.CategoryAdminAssignments.SingleAsync()).IsActive);
    }
    [Fact] public async Task Public_outline_uses_only_published_snapshot_and_omits_private_content_and_task_details()
    {
        await using var db=Context();await VerifyOutline(db);
    }
    [AccountSqlServerFact] public async Task Sql_public_outline_and_visibility_queries_execute_against_isolated_database()
    {
        using var provider=AccountFinalizationSqlServerTests.DatabaseServices();using var scope=provider.CreateScope();await VerifyOutline(scope.ServiceProvider.GetRequiredService<AppDbContext>());
    }
    private static async Task VerifyOutline(AppDbContext db)
    {
        var owner=Guid.NewGuid().ToString();var reviewer=Guid.NewGuid().ToString();var d=await Seed(db,owner,reviewer);
        var lesson=await db.Lessons.SingleAsync(x=>x.CourseSection.CourseVersionId==d.VersionId);lesson.DescriptionEn="PRIVATE_LESSON_BODY with sufficient educational explanation";
        var task=await db.CourseTasks.SingleAsync(x=>x.CourseVersionId==d.VersionId);task.Instructions=new(null,"PRIVATE_TASK_INSTRUCTIONS");await db.SaveChangesAsync();
        var reviews=new CourseReviewService(db,new Store());var actor=new CourseActor(owner,true,false);
        Assert.Equal(ServiceFailure.None,(await reviews.SubmitAsync(d.CourseId,actor,new(d.VersionId))).Failure);
        Assert.Equal(ServiceFailure.None,(await reviews.DecideAsync(d.CourseId,d.VersionId,new(reviewer,false,false,true),new("approved",null))).Failure);
        var publicService=new CourseService(db);var result=(await publicService.GetPublicAsync(d.CourseId)).Value!;
        Assert.Equal(d.VersionId,result.PublishedVersionId);Assert.Single(result.Sections!);Assert.Equal("Reading lesson",result.Sections![0].Lessons[0].TitleEn);Assert.Equal(1,result.TaskCount);
        var json=JsonSerializer.Serialize(result);foreach(var secret in new[]{"PRIVATE_LESSON_BODY","PRIVATE_TASK_INSTRUCTIONS","StorageKey","PrimaryVideoMediaAssetId","Attachments"})Assert.DoesNotContain(secret,json);
        var next=(await reviews.ReviseAsync(d.CourseId,actor,new(d.VersionId))).Value;var newLesson=await db.Lessons.SingleAsync(x=>x.CourseSection.CourseVersionId==next);newLesson.TitleEn="PRIVATE DRAFT TITLE";await db.SaveChangesAsync();
        Assert.Equal("Reading lesson",(await publicService.GetPublicAsync(d.CourseId)).Value!.Sections![0].Lessons[0].TitleEn);
        var course=await db.Courses.SingleAsync(x=>x.Id==d.CourseId);course.SafetyStatus="archived";await db.SaveChangesAsync();Assert.Equal(ServiceFailure.NotFound,(await publicService.GetPublicAsync(d.CourseId)).Failure);
    }
    [Fact] public async Task Published_courses_in_confirmed_fixture_categories_are_not_educational_catalog_content()
    {
        await using var db=Context();var d=await Seed(db);db.Categories.Add(new(){Id=Fixture,NameAr="Fixture",NameEn="Fixture"});await db.SaveChangesAsync();
        var v=await db.CourseVersions.SingleAsync();v.CategoryId=Fixture;v.ReviewStatus="approved";var course=await db.Courses.SingleAsync();course.PublishedVersionId=v.Id;await db.SaveChangesAsync();
        Assert.Empty(await new CourseService(db).GetPublicAsync());Assert.Equal(ServiceFailure.NotFound,(await new CourseService(db).GetPublicAsync(d.CourseId)).Failure);
        Assert.Equal(ServiceFailure.Validation,(await new CourseService(db).CreateAsync(new("owner",true,false),new(Fixture,null,"Blocked fixture category",null,null,[]))).Failure);
        Assert.False((await new CourseSubmissionEligibilityService(db).GetAsync(d.CourseId,new("owner",true,false))).Value!.Checks.Single(x=>x.Code=="category").IsMet);
    }
}
