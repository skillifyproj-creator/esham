using System.Security.Claims;
using esham.BLL.DTOs;
using esham.BLL.DTOs.Moderation;
using esham.BLL.Services;
using esham.DAL.Data;
using esham.DAL.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
using static esham.Tests.AccountFinalizationTests;
using static esham.Tests.AdminUserTests;
namespace esham.Tests;

public sealed class PlatformModerationTests
{
    internal sealed record Fixture(string Owner,string Reviewer,string General,string Learner,string Outsider,Guid Course,Guid Version,Guid Category);
    internal static CourseSafetyService Safety(AppDbContext db)=>new(db,new NotificationWriter(db));
    internal static async Task<Fixture> Seed(IServiceProvider s)
    {
        var owner=await Create(s,"owner","Instructor");var reviewer=await Create(s,"reviewer","CategoryAdmin");
        var general=await Create(s,"general","GeneralAdmin");var learner=await Create(s,"learner","Learner");var outsider=await Create(s,"outsider","CategoryAdmin");
        var db=s.GetRequiredService<AppDbContext>();var d=await CourseReviewWorkflowTests.Seed(db,owner,reviewer);
        var review=new CourseReviewService(db,new CourseReviewWorkflowTests.Store());
        Assert.Equal(ServiceFailure.None,(await review.SubmitAsync(d.CourseId,new(owner,true,false),new(d.VersionId))).Failure);
        Assert.Equal(ServiceFailure.None,(await review.DecideAsync(d.CourseId,d.VersionId,new(reviewer,false,false,true),new("approved",null))).Failure);
        return new(owner,reviewer,general,learner,outsider,d.CourseId,d.VersionId,d.CategoryId);
    }
    internal static IssueCourseWarningRequest Warning(Fixture d,string incident)=>new(d.Version,incident,"Verified dangerous instruction","Replace the unsafe demonstration",DateTimeOffset.UtcNow.AddDays(3),true);
    [Fact] public async Task Announcements_persist_drafts_filter_audiences_and_require_fresh_general_membership()
    {
        using var p=AdminServices();using var scope=p.CreateScope();var s=scope.ServiceProvider;var db=s.GetRequiredService<AppDbContext>();var d=await Seed(s);var service=new AnnouncementService(db);
        var fake=new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier,d.Learner),new Claim(ClaimTypes.Role,"GeneralAdmin")],"forged"));
        Assert.Equal(ServiceFailure.Forbidden,(await service.SaveAsync(fake,null,new(null,"Title",null,"Content","all"))).Failure);
        Assert.Equal(ServiceFailure.Unauthenticated,(await service.SaveAsync(new(),null,new(null,"Title",null,"Content","all"))).Failure);
        var draft=(await service.SaveAsync(Principal(d.General),null,new(null,"A real announcement",null,"A persisted message","learners"))).Value!;
        Assert.Empty((await service.ListAsync(new(),false)).Value!);
        Assert.Equal(ServiceFailure.Forbidden,(await service.ListAsync(Principal(d.Reviewer),true)).Failure);
        var published=(await service.SetStatusAsync(Principal(d.General),draft.Id,new("published",draft.Version))).Value!;
        Assert.Empty((await service.ListAsync(new(),false)).Value!);Assert.Empty((await service.ListAsync(Principal(d.Owner),false)).Value!);
        Assert.Single((await service.ListAsync(Principal(d.Learner),false)).Value!);
        Assert.Equal(ServiceFailure.Conflict,(await service.SetStatusAsync(Principal(d.General),draft.Id,new("draft",draft.Version))).Failure);
        Assert.Equal(ServiceFailure.Conflict,(await service.SaveAsync(Principal(d.General),draft.Id,new(null,"Edited",null,"Message","learners",published.Version))).Failure);
        var archived=await service.SetStatusAsync(Principal(d.General),draft.Id,new("archived",published.Version));Assert.Equal("archived",archived.Value!.Status);
        Assert.Single(await db.Announcements.ToListAsync());Assert.Empty((await service.ListAsync(Principal(d.Learner),false)).Value!);
        Assert.Equal(ServiceFailure.Conflict,(await service.SetStatusAsync(Principal(d.General),draft.Id,new("published",archived.Value.Version))).Failure);
        Assert.Equal(3,await db.AdminActivityLogs.CountAsync(x=>x.TargetType=="Announcement"));
    }
    [Fact] public async Task Reports_are_real_version_bound_scoped_and_do_not_automatically_warn()
    {
        using var p=AdminServices();using var scope=p.CreateScope();var s=scope.ServiceProvider;var db=s.GetRequiredService<AppDbContext>();var d=await Seed(s);var service=Safety(db);
        var input=new FileCourseReportRequest(d.Version,"harmful","This educational instruction may be unsafe.");
        var filed=(await service.FileReportAsync(d.Course,Principal(d.Learner),input)).Value!;
        Assert.Equal(ServiceFailure.Conflict,(await service.FileReportAsync(d.Course,Principal(d.Learner),input)).Failure);
        Assert.Equal(ServiceFailure.Forbidden,(await service.FileReportAsync(d.Course,Principal(d.Learner),input with{CourseVersionId=Guid.NewGuid()})).Failure);
        Assert.Empty((await service.ListReportsAsync(Principal(d.Outsider),false)).Value!);
        Assert.Single((await service.ListReportsAsync(Principal(d.Reviewer),false)).Value!);
        Assert.Single((await service.ListReportsAsync(Principal(d.Learner),true)).Value!);
        Assert.Equal(ServiceFailure.Forbidden,(await service.ListReportsAsync(Principal(d.Learner),false)).Failure);
        Assert.Equal(ServiceFailure.Forbidden,(await service.ResolveReportAsync(d.Course,filed.Id,Principal(d.Outsider),new("resolved","Reviewed evidence carefully","pending"))).Failure);
        Assert.Equal(ServiceFailure.Validation,(await service.ResolveReportAsync(d.Course,filed.Id,Principal(d.Reviewer),new("resolved","short","pending"))).Failure);
        Assert.Equal(ServiceFailure.None,(await service.ResolveReportAsync(d.Course,filed.Id,Principal(d.Reviewer),new("reviewing",null,"pending"))).Failure);
        Assert.Equal(ServiceFailure.Conflict,(await service.ResolveReportAsync(d.Course,filed.Id,Principal(d.Reviewer),new("resolved","Reviewed evidence carefully","pending"))).Failure);
        Assert.Equal(ServiceFailure.None,(await service.ResolveReportAsync(d.Course,filed.Id,Principal(d.Reviewer),new("resolved","Reviewed evidence carefully","reviewing"))).Failure);
        Assert.Empty(await db.CourseWarnings.ToListAsync());Assert.Equal("active",(await db.Courses.SingleAsync()).SafetyStatus);
        Assert.False((await db.Courses.SingleAsync()).EnrollmentPaused);Assert.Equal(d.Version,(await db.Courses.SingleAsync()).PublishedVersionId);
    }
    [Fact] public async Task Warnings_require_verified_distinct_incidents_and_escalate_without_deleting_content()
    {
        using var p=AdminServices();using var scope=p.CreateScope();var s=scope.ServiceProvider;var db=s.GetRequiredService<AppDbContext>();var d=await Seed(s);var service=Safety(db);
        Assert.Equal(ServiceFailure.Forbidden,(await service.WarnAsync(d.Course,Principal(d.Outsider),Warning(d,"one"))).Failure);
        Assert.Equal(ServiceFailure.Forbidden,(await service.WarnAsync(d.Course,Principal(d.Owner),Warning(d,"one"))).Failure);
        Assert.Equal(ServiceFailure.Validation,(await service.WarnAsync(d.Course,Principal(d.Reviewer),Warning(d,"one") with{Verified=false})).Failure);
        var one=await service.WarnAsync(d.Course,Principal(d.Reviewer),Warning(d,"one"));Assert.Equal(1,one.Value!.WarningNumber);
        Assert.Equal(ServiceFailure.Conflict,(await service.WarnAsync(d.Course,Principal(d.Reviewer),Warning(d,"one"))).Failure);
        Assert.Equal(1,await db.Notifications.Where(x=>x.NotificationType!="course.published").CountAsync());Assert.False((await db.Courses.SingleAsync()).EnrollmentPaused);
        Assert.Equal(2,(await service.WarnAsync(d.Course,Principal(d.Reviewer),Warning(d,"two"))).Value!.WarningNumber);
        Assert.True((await db.Courses.SingleAsync()).EnrollmentPaused);Assert.Equal("active",(await db.Courses.SingleAsync()).SafetyStatus);
        Assert.Equal(3,(await service.WarnAsync(d.Course,Principal(d.General),Warning(d,"three"))).Value!.WarningNumber);
        Assert.Equal("archived",(await db.Courses.SingleAsync()).SafetyStatus);Assert.Empty(await new CourseService(db).GetPublicAsync());
        Assert.Equal(ServiceFailure.Conflict,(await service.WarnAsync(d.Course,Principal(d.General),Warning(d,"four"))).Failure);
        Assert.Equal(3,await db.CourseWarnings.CountAsync());Assert.Equal(3,await db.Notifications.Where(x=>x.NotificationType!="course.published").CountAsync());
        Assert.Equal(d.Version,(await db.Courses.SingleAsync()).PublishedVersionId);Assert.Single(await db.Lessons.ToListAsync());Assert.Empty(await db.PointTransactions.ToListAsync());
    }
    [Fact] public async Task Only_owner_appeals_and_only_general_admin_decides_without_rewriting_safety_or_evidence()
    {
        using var p=AdminServices();using var scope=p.CreateScope();var s=scope.ServiceProvider;var db=s.GetRequiredService<AppDbContext>();var d=await Seed(s);var service=Safety(db);
        var warning=(await service.WarnAsync(d.Course,Principal(d.Reviewer),Warning(d,"one"))).Value!;
        Assert.Equal(ServiceFailure.Forbidden,(await service.AppealAsync(d.Course,Principal(d.Learner),new(warning.Id,"The demonstration is safe with the documented precautions."))).Failure);
        var appeal=(await service.AppealAsync(d.Course,Principal(d.Owner),new(warning.Id,"The demonstration is safe with the documented precautions."))).Value!;
        Assert.Equal(ServiceFailure.Conflict,(await service.AppealAsync(d.Course,Principal(d.Owner),new(warning.Id,"Additional duplicate explanation for the same warning."))).Failure);
        Assert.Equal(ServiceFailure.Forbidden,(await service.DecideAppealAsync(d.Course,appeal.Id,Principal(d.Reviewer),new("accepted","The evidence was reviewed independently."))).Failure);
        Assert.Equal(ServiceFailure.None,(await service.DecideAppealAsync(d.Course,appeal.Id,Principal(d.General),new("accepted","The evidence was reviewed independently."))).Failure);
        Assert.Equal(ServiceFailure.Conflict,(await service.DecideAppealAsync(d.Course,appeal.Id,Principal(d.General),new("rejected","Attempt to override the existing final decision."))).Failure);
        var snapshot=(await service.GetAsync(d.Course,Principal(d.Owner))).Value!;Assert.Single(snapshot.Warnings);Assert.Equal("accepted",Assert.Single(snapshot.Appeals).Status);
        Assert.Equal(warning.Reason,snapshot.Warnings[0].Reason);Assert.Equal(2,await db.Notifications.Where(x=>x.NotificationType!="course.published").CountAsync());
        Assert.Single((await service.ListCasesAsync(Principal(d.General))).Value!);Assert.Empty((await service.ListCasesAsync(Principal(d.Outsider))).Value!);
        Assert.Equal("active",snapshot.SafetyStatus);Assert.Equal(0,(await service.ListCasesAsync(Principal(d.General))).Value![0].PendingAppeals);
    }
    [Fact] public async Task Suspension_is_explicit_and_preserves_versions_wallets_and_warning_count()
    {
        using var p=AdminServices();using var scope=p.CreateScope();var s=scope.ServiceProvider;var db=s.GetRequiredService<AppDbContext>();var d=await Seed(s);var service=Safety(db);
        Assert.Equal(ServiceFailure.None,(await service.SuspendAsync(d.Course,Principal(d.Reviewer),new(d.Version,"A verified dangerous demonstration needs immediate review.",true))).Failure);
        Assert.Equal("suspended",(await db.Courses.SingleAsync()).SafetyStatus);Assert.Empty(await db.CourseWarnings.ToListAsync());Assert.Equal(d.Version,(await db.Courses.SingleAsync()).PublishedVersionId);
        Assert.Equal(ServiceFailure.Conflict,(await service.SuspendAsync(d.Course,Principal(d.General),new(d.Version,"Another suspension must not duplicate the same state change.",true))).Failure);
        Assert.Single(await db.Notifications.Where(x=>x.NotificationType!="course.published").ToListAsync());Assert.Empty(await db.PointTransactions.ToListAsync());
    }
    [Fact] public async Task Revoked_scope_and_locked_or_forged_accounts_cannot_mutate_and_activity_is_scoped()
    {
        using var p=AdminServices();using var scope=p.CreateScope();var s=scope.ServiceProvider;var db=s.GetRequiredService<AppDbContext>();var d=await Seed(s);var service=Safety(db);
        await service.WarnAsync(d.Course,Principal(d.Reviewer),Warning(d,"one"));
        await new AnnouncementService(db).SaveAsync(Principal(d.General),null,new(null,"General news",null,"Server-backed content","all"));
        var activity=new AdminActivityService(db);Assert.DoesNotContain((await activity.ListAsync(Principal(d.Reviewer))).Value!,x=>x.TargetType=="Announcement");
        Assert.Contains((await activity.ListAsync(Principal(d.General))).Value!,x=>x.TargetType=="Announcement");
        var assignment=await db.CategoryAdminAssignments.SingleAsync();assignment.IsActive=false;await db.SaveChangesAsync();
        Assert.Equal(ServiceFailure.Forbidden,(await service.WarnAsync(d.Course,Principal(d.Reviewer),Warning(d,"two"))).Failure);
        Assert.Empty((await service.ListCasesAsync(Principal(d.Reviewer))).Value!);
        var user=await db.Users.SingleAsync(x=>x.Id==d.General);user.LockoutEnabled=true;user.LockoutEnd=DateTimeOffset.UtcNow.AddDays(1);await db.SaveChangesAsync();
        Assert.Equal(ServiceFailure.Unauthenticated,(await service.WarnAsync(d.Course,Principal(d.General),Warning(d,"two"))).Failure);
        Assert.Equal(ServiceFailure.Unauthenticated,(await activity.ListAsync(Principal(d.General))).Failure);
    }
}
