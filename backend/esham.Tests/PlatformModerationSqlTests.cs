using esham.BLL.DTOs;
using esham.BLL.Services;
using esham.DAL.Data;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
using static esham.Tests.AccountFinalizationTests;
using static esham.Tests.AdminUserTests;
using static esham.Tests.PlatformModerationTests;
namespace esham.Tests;

public sealed class PlatformModerationSqlTests
{
    private static ServiceProvider Isolated(params IInterceptor[] interceptors)
    {
        var cs=Environment.GetEnvironmentVariable("ESHAM_ACCOUNT_TEST_SQLSERVER");
        if(string.IsNullOrWhiteSpace(cs)||!new SqlConnectionStringBuilder(cs).InitialCatalog.StartsWith("Esham_AccountTests_",StringComparison.Ordinal))throw new InvalidOperationException("Only an explicitly isolated test database is allowed.");
        return AdminServices(o=>o.UseSqlServer(cs,s=>s.EnableRetryOnFailure(3,TimeSpan.Zero,null)).AddInterceptors(interceptors));
    }
    [AccountSqlServerFact] public async Task Duplicate_warning_race_creates_one_immutable_warning_and_notification()
    {
        using var provider=Isolated();Fixture d;using(var setup=provider.CreateScope())d=await Seed(setup.ServiceProvider);
        var gate=new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        async Task<ServiceFailure> Warn(){await gate.Task;using var scope=provider.CreateScope();var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();return (await Safety(db).WarnAsync(d.Course,Principal(d.Reviewer),Warning(d,"same incident"))).Failure;}
        var work=new[]{Warn(),Warn()};gate.SetResult();var results=await Task.WhenAll(work);Assert.Single(results,x=>x==ServiceFailure.None);Assert.Single(results,x=>x==ServiceFailure.Conflict);
        using var verify=provider.CreateScope();var check=verify.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(1,await check.CourseWarnings.CountAsync(x=>x.CourseId==d.Course));Assert.Equal(1,await check.Notifications.CountAsync(x=>x.RecipientUserId==d.Owner));
        Assert.Single((await Safety(check).ListCasesAsync(Principal(d.Reviewer))).Value!,x=>x.CourseId==d.Course);
        Assert.Contains((await new AdminActivityService(check).ListAsync(Principal(d.General))).Value!,x=>x.CourseId==d.Course&&x.Action=="course.warning.issued");
    }
    [AccountSqlServerFact] public async Task Failure_after_warning_save_rolls_back_escalation_warning_notification_and_audit()
    {
        var fail=new FailSaved();using var provider=Isolated(fail);using var scope=provider.CreateScope();var s=scope.ServiceProvider;var d=await Seed(s);var db=s.GetRequiredService<AppDbContext>();
        await Safety(db).WarnAsync(d.Course,Principal(d.Reviewer),Warning(d,"first"));fail.Armed=true;
        await Assert.ThrowsAsync<InvalidOperationException>(()=>Safety(db).WarnAsync(d.Course,Principal(d.Reviewer),Warning(d,"second")));
        Assert.Empty(db.ChangeTracker.Entries());Assert.Equal(1,await db.CourseWarnings.CountAsync(x=>x.CourseId==d.Course));Assert.Equal(1,await db.Notifications.CountAsync(x=>x.RecipientUserId==d.Owner));
        Assert.False((await db.Courses.AsNoTracking().SingleAsync(x=>x.Id==d.Course)).EnrollmentPaused);
        Assert.Equal(1,await db.AdminActivityLogs.CountAsync(x=>x.CourseId==d.Course&&x.Action=="course.warning.issued"));
    }
    [AccountSqlServerFact] public async Task Concurrent_appeal_decisions_commit_only_one_final_outcome()
    {
        using var provider=Isolated();Fixture d;Guid appeal;
        using(var setup=provider.CreateScope()){d=await Seed(setup.ServiceProvider);var db=setup.ServiceProvider.GetRequiredService<AppDbContext>();var w=(await Safety(db).WarnAsync(d.Course,Principal(d.Reviewer),Warning(d,"first"))).Value!;appeal=(await Safety(db).AppealAsync(d.Course,Principal(d.Owner),new(w.Id,"Please review the supplied context and original explanation."))).Value!.Id;}
        var gate=new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        async Task<ServiceFailure> Decide(string outcome){await gate.Task;using var scope=provider.CreateScope();return (await Safety(scope.ServiceProvider.GetRequiredService<AppDbContext>()).DecideAppealAsync(d.Course,appeal,Principal(d.General),new(outcome,"The submitted evidence has been independently reviewed."))).Failure;}
        var work=new[]{Decide("accepted"),Decide("rejected")};gate.SetResult();var results=await Task.WhenAll(work);Assert.Single(results,x=>x==ServiceFailure.None);Assert.Single(results,x=>x==ServiceFailure.Conflict);
        using var verify=provider.CreateScope();var db2=verify.ServiceProvider.GetRequiredService<AppDbContext>();Assert.Equal(2,await db2.Notifications.CountAsync(x=>x.RecipientUserId==d.Owner));Assert.Equal(1,await db2.AdminActivityLogs.CountAsync(x=>x.TargetId==appeal.ToString()&&x.Action!="course.appeal.submitted"));
    }
    [AccountSqlServerFact] public async Task Announcements_serialize_stale_versions_and_atomic_audit_and_audience_queries_translate()
    {
        using var provider=Isolated();Fixture d;esham.BLL.DTOs.Moderation.AnnouncementDto draft;
        using(var setup=provider.CreateScope()){d=await Seed(setup.ServiceProvider);draft=(await new AnnouncementService(setup.ServiceProvider.GetRequiredService<AppDbContext>()).SaveAsync(Principal(d.General),null,new(null,"SQL announcement",null,"Persisted content","learners"))).Value!;}
        var gate=new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        async Task<ServiceFailure> Publish(string next){await gate.Task;using var scope=provider.CreateScope();return (await new AnnouncementService(scope.ServiceProvider.GetRequiredService<AppDbContext>()).SetStatusAsync(Principal(d.General),draft.Id,new(next,draft.Version))).Failure;}
        var work=new[]{Publish("published"),Publish("archived")};gate.SetResult();var results=await Task.WhenAll(work);Assert.Single(results,x=>x==ServiceFailure.None);Assert.Single(results,x=>x==ServiceFailure.Conflict);
        using var verify=provider.CreateScope();var db=verify.ServiceProvider.GetRequiredService<AppDbContext>();var service=new AnnouncementService(db);Assert.DoesNotContain((await service.ListAsync(new(),false)).Value!,x=>x.Id==draft.Id);
        Assert.Equal(2,await db.AdminActivityLogs.CountAsync(x=>x.TargetId==draft.Id.ToString()));Assert.Contains((await service.ListAsync(Principal(d.General),true)).Value!,x=>x.Id==draft.Id);
    }
    private sealed class FailSaved:SaveChangesInterceptor
    {
        public bool Armed{get;set;}
        public override ValueTask<int> SavedChangesAsync(SaveChangesCompletedEventData eventData,int result,CancellationToken ct=default){if(Armed){Armed=false;throw new InvalidOperationException("Injected failure after save, before commit.");}return ValueTask.FromResult(result);}
    }
}
