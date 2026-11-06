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
public sealed class InstructorInsightsTests
{
    private static JsonElement Json(ServiceResult<object> r){Assert.Equal(ServiceFailure.None,r.Failure);return JsonSerializer.SerializeToElement(r.Value,new JsonSerializerOptions(JsonSerializerDefaults.Web));}
    [AccountSqlServerFact] public async Task Sql_server_queries_and_serialized_reviews_use_only_explicit_isolated_database()
    {
        var cs=Environment.GetEnvironmentVariable("ESHAM_ACCOUNT_TEST_SQLSERVER");var parsed=new Microsoft.Data.SqlClient.SqlConnectionStringBuilder(cs);
        if(parsed.DataSource!=@"(localdb)\MSSQLLocalDB"||!parsed.InitialCatalog.StartsWith("Esham_AccountTests_"))throw new InvalidOperationException("Isolated LocalDB required.");
        using var p=AdminServices(o=>o.UseSqlServer(cs,x=>x.EnableRetryOnFailure()));using var scope=p.CreateScope();var s=scope.ServiceProvider;var d=await PlatformModerationTests.Seed(s);var db=s.GetRequiredService<AppDbContext>();var service=new InstructorInsightsService(db);
        var task=await db.CourseTasks.SingleAsync(x=>x.CourseVersionId==d.Version);var lesson=await db.Lessons.SingleAsync(x=>x.CourseSection.CourseVersionId==d.Version);
        var e=new Enrollment{LearnerUserId=d.Learner,CourseId=d.Course,CourseVersionId=d.Version};db.Enrollments.Add(e);
        db.CourseReviews.Add(new(){EnrollmentId=e.Id,CourseVersionId=d.Version,Rating=3,Comment="SQL review"});
        db.LessonProgressRecords.Add(new(){EnrollmentId=e.Id,LessonId=lesson.Id,IsCompleted=true});
        var sub=new TaskSubmission{EnrollmentId=e.Id,CourseTaskId=task.Id,Status="awaitingReview",SubmittedAt=DateTimeOffset.UtcNow};db.TaskSubmissions.Add(sub);await db.SaveChangesAsync();
        Assert.Equal(1,Json(await service.Analytics(Principal(d.Owner),d.Course)).GetProperty("learners").GetProperty("enrolled").GetInt32());
        Assert.Equal(1,Json(await service.Reviews(Principal(d.Owner),d.Course)).GetProperty("total").GetInt32());
        Assert.Equal(1,Json(await service.Submissions(Principal(d.Owner),"awaitingReview")).GetProperty("total").GetInt32());
        Assert.Equal(ServiceFailure.None,(await service.Review(Principal(d.Owner),sub.Id,new("approved",null))).Failure);
        Assert.Equal(ServiceFailure.Conflict,(await service.Review(Principal(d.Owner),sub.Id,new("approved",null))).Failure);
        var raced=new TaskSubmission{EnrollmentId=e.Id,CourseTaskId=task.Id,Status="awaitingReview",SubmittedAt=DateTimeOffset.UtcNow,AttemptNumber=2};db.TaskSubmissions.Add(raced);await db.SaveChangesAsync();
        async Task<ServiceResult<object>> Decide(string decision){using var concurrent=p.CreateScope();var independent=concurrent.ServiceProvider.GetRequiredService<AppDbContext>();return await new InstructorInsightsService(independent).Review(Principal(d.Owner),raced.Id,new(decision,"Concurrent decision"));}
        var results=await Task.WhenAll(Decide("approved"),Decide("rejected"));Assert.Single(results,x=>x.Failure==ServiceFailure.None);Assert.Single(results,x=>x.Failure==ServiceFailure.Conflict);
        Assert.Equal(1,await db.TaskSubmissionReviews.CountAsync(x=>x.TaskSubmissionId==raced.Id));
    }
    [Fact] public async Task Empty_statistics_are_real_and_watch_time_is_unavailable()
    {
        using var p=AdminServices();using var scope=p.CreateScope();var s=scope.ServiceProvider;var d=await PlatformModerationTests.Seed(s);var db=s.GetRequiredService<AppDbContext>();var service=new InstructorInsightsService(db);
        var data=Json(await service.Analytics(Principal(d.Owner),null));Assert.Equal(0,data.GetProperty("learners").GetProperty("enrolled").GetInt32());Assert.Equal(JsonValueKind.Null,data.GetProperty("stats").GetProperty("averageWatchHours").ValueKind);
        Assert.Equal(0,Json(await service.Reviews(Principal(d.Owner),null)).GetProperty("total").GetInt32());
        Assert.Equal(ServiceFailure.NotFound,(await service.Analytics(Principal(d.Owner),Guid.NewGuid())).Failure);
        Assert.Equal(ServiceFailure.Validation,(await service.Analytics(Principal(d.Owner),null,"bad")).Failure);
    }
    [Fact] public async Task Fresh_roles_and_ownership_prevent_access_to_other_instructor_data()
    {
        using var p=AdminServices();using var scope=p.CreateScope();var s=scope.ServiceProvider;var d=await PlatformModerationTests.Seed(s);var db=s.GetRequiredService<AppDbContext>();var service=new InstructorInsightsService(db);
        Assert.Equal(ServiceFailure.Unauthenticated,(await service.Analytics(new(),null)).Failure);
        var forged=new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier,d.Learner),new Claim(ClaimTypes.Role,"Instructor")],"forged"));
        Assert.Equal(ServiceFailure.Forbidden,(await service.Analytics(forged,null)).Failure);
        Assert.Equal(ServiceFailure.Forbidden,(await service.Analytics(Principal(d.General),null)).Failure);
        var other=await Create(s,"other-instructor","Instructor");
        Assert.Equal(ServiceFailure.NotFound,(await service.Reviews(Principal(other),d.Course)).Failure);
        Assert.Equal(ServiceFailure.NotFound,(await service.Analytics(Principal(other),d.Course)).Failure);
        var user=await db.Users.SingleAsync(x=>x.Id==d.Owner);user.LockoutEnabled=true;user.LockoutEnd=DateTimeOffset.UtcNow.AddDays(1);await db.SaveChangesAsync();
        Assert.Equal(ServiceFailure.Unauthenticated,(await service.Submissions(Principal(d.Owner),null)).Failure);
    }
    [Fact] public async Task Persisted_reviews_progress_and_enrollment_cohorts_feed_analytics()
    {
        using var p=AdminServices();using var scope=p.CreateScope();var s=scope.ServiceProvider;var d=await PlatformModerationTests.Seed(s);var db=s.GetRequiredService<AppDbContext>();var service=new InstructorInsightsService(db);
        var e=new Enrollment{LearnerUserId=d.Learner,CourseId=d.Course,CourseVersionId=d.Version,LastOpenedAt=DateTimeOffset.UtcNow};db.Enrollments.Add(e);
        var lesson=await db.Lessons.SingleAsync();db.LessonProgressRecords.Add(new(){EnrollmentId=e.Id,LessonId=lesson.Id,IsCompleted=true});
        db.CourseReviews.Add(new(){EnrollmentId=e.Id,CourseVersionId=d.Version,Rating=4,Comment="Actual review"});await db.SaveChangesAsync();
        var data=Json(await service.Analytics(Principal(d.Owner),d.Course));Assert.Equal(1,data.GetProperty("learners").GetProperty("started").GetInt32());Assert.Equal(4,data.GetProperty("ratings").GetProperty("average").GetDouble());Assert.Equal(100,data.GetProperty("sections")[0].GetProperty("completionRate").GetDouble());
        Assert.Equal("Actual review",Json(await service.Reviews(Principal(d.Owner),null)).GetProperty("items")[0].GetProperty("comment").GetString());
        Assert.Equal("active",(await db.Enrollments.SingleAsync()).Status);Assert.Empty(await db.TaskSubmissionReviews.ToListAsync());
    }
    [Fact] public async Task Attachments_require_owned_submitted_work_and_review_validates_version_access()
    {
        using var p=AdminServices();using var scope=p.CreateScope();var s=scope.ServiceProvider;var d=await PlatformModerationTests.Seed(s);var db=s.GetRequiredService<AppDbContext>();var service=new InstructorInsightsService(db);
        var e=new Enrollment{LearnerUserId=d.Learner,CourseId=d.Course,CourseVersionId=d.Version};db.Enrollments.Add(e);var task=await db.CourseTasks.SingleAsync();
        var sub=new TaskSubmission{EnrollmentId=e.Id,CourseTaskId=task.Id,Status="awaitingReview",SubmittedAt=DateTimeOffset.UtcNow};db.TaskSubmissions.Add(sub);
        var media=new MediaAsset{OwnerUserId=d.Learner,StorageKey="isolated-submission",OriginalFileName="work.txt",MimeType="text/plain",MediaType="attachment"};db.MediaAssets.Add(media);
        var attachment=new SubmissionAttachment{TaskSubmissionId=sub.Id,MediaAssetId=media.Id};db.SubmissionAttachments.Add(attachment);await db.SaveChangesAsync();
        Assert.Equal(ServiceFailure.None,(await service.Attachment(Principal(d.Owner),sub.Id,attachment.Id)).Failure);
        var other=await Create(s,"other-instructor","Instructor");Assert.Equal(ServiceFailure.NotFound,(await service.Attachment(Principal(other),sub.Id,attachment.Id)).Failure);
        Assert.Equal(ServiceFailure.NotFound,(await service.Attachment(Principal(d.Owner),Guid.NewGuid(),attachment.Id)).Failure);
        sub.Status="inProgress";await db.SaveChangesAsync();Assert.Equal(ServiceFailure.NotFound,(await service.Attachment(Principal(d.Owner),sub.Id,attachment.Id)).Failure);
        sub.Status="awaitingReview";e.Status="cancelled";await db.SaveChangesAsync();Assert.Equal(ServiceFailure.Conflict,(await service.Review(Principal(d.Owner),sub.Id,new("approved",null))).Failure);
        Assert.Empty(await db.TaskSubmissionReviews.ToListAsync());
    }
    [Fact] public async Task Reviews_are_append_only_reject_drafts_replays_and_foreign_owners_without_awarding_points()
    {
        using var p=AdminServices();using var scope=p.CreateScope();var s=scope.ServiceProvider;var d=await PlatformModerationTests.Seed(s);var db=s.GetRequiredService<AppDbContext>();var service=new InstructorInsightsService(db);
        var e=new Enrollment{LearnerUserId=d.Learner,CourseId=d.Course,CourseVersionId=d.Version};db.Enrollments.Add(e);var task=await db.CourseTasks.SingleAsync();
        var submitted=new TaskSubmission{EnrollmentId=e.Id,CourseTaskId=task.Id,Status="awaitingReview",SubmittedAt=DateTimeOffset.UtcNow,AnswerText="Private work"};
        var draft=new TaskSubmission{EnrollmentId=e.Id,CourseTaskId=task.Id,AttemptNumber=2};db.TaskSubmissions.AddRange(submitted,draft);await db.SaveChangesAsync();
        var other=await Create(s,"other-instructor","Instructor");
        Assert.Equal(ServiceFailure.NotFound,(await service.Submissions(Principal(other),null,submitted.Id)).Failure);
        Assert.Equal(ServiceFailure.NotFound,(await service.Review(Principal(other),submitted.Id,new("approved",null))).Failure);
        Assert.Equal(ServiceFailure.NotFound,(await service.Submissions(Principal(d.Owner),null,draft.Id)).Failure);
        Assert.Equal(ServiceFailure.Conflict,(await service.Review(Principal(d.Owner),draft.Id,new("approved",null))).Failure);
        Assert.Equal(ServiceFailure.Validation,(await service.Review(Principal(d.Owner),submitted.Id,new("rejected"," "))).Failure);
        Assert.Equal(ServiceFailure.None,(await service.Review(Principal(d.Owner),submitted.Id,new("approved","Good work"))).Failure);
        Assert.Equal(ServiceFailure.Conflict,(await service.Review(Principal(d.Owner),submitted.Id,new("rejected","Changed mind"))).Failure);
        Assert.Single(await db.TaskSubmissionReviews.ToListAsync());Assert.Empty(await db.PointTransactions.ToListAsync());Assert.Empty(await db.Certificates.ToListAsync());Assert.Equal("active",(await db.Enrollments.SingleAsync()).Status);
        var optional=new TaskSubmission{EnrollmentId=e.Id,CourseTaskId=task.Id,AttemptNumber=3,Status="awaitingReview",SubmittedAt=DateTimeOffset.UtcNow,IsOptionalAtCreation=true};db.TaskSubmissions.Add(optional);await db.SaveChangesAsync();
        Assert.Equal(ServiceFailure.None,(await service.Review(Principal(d.Owner),optional.Id,new("rejected","Please revise"))).Failure);
        Assert.Equal(1,await db.TaskSubmissionReviews.CountAsync(x=>x.Decision=="approved"));
    }
}
