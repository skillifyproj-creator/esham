using System.Security.Claims;
using esham.BLL.DTOs;
using esham.BLL.DTOs.Submissions;
using esham.BLL.Interfaces;
using esham.BLL.Services;
using esham.DAL.Data;
using esham.DAL.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
using static esham.Tests.AccountFinalizationTests;
namespace esham.Tests;
public sealed class LearnerSubmissionTests
{
    internal sealed class MemoryGate(AppDbContext db, bool enabled = true) : ISubmissionMutationGate {
        public Task<bool> IsEnabledAsync(CancellationToken ct = default) => db.Database.IsInMemory() ? Task.FromResult(enabled) : throw new InvalidOperationException("Memory-only gate.");
    }
    internal sealed class NoFiles : ISubmissionAttachmentWriter {
        public Task<PreparedSubmissionFile> PrepareAsync(Stream input,string name,string type,CancellationToken ct) => throw new NotSupportedException();
        public Task CompleteAsync(string key,CancellationToken ct) => Task.CompletedTask;
        public Task ReconcileAsync(string key,CancellationToken ct) => Task.CompletedTask;
        public Task<int> ReconcilePendingAsync(CancellationToken ct) => Task.FromResult(0);
    }
    internal static LearnerSubmissionService Service(IServiceProvider s,ISubmissionMutationGate? gate=null,ISubmissionAttachmentWriter? writer=null) {
        var db=s.GetRequiredService<AppDbContext>(); return new(db,LearnerLearningTests.Access(s),new CourseVersionUpdates(db,new NotificationWriter(db)),
            gate ?? new MemoryGate(db),writer ?? new NoFiles(),new LearnerLearningTests.MemoryStorage(),new NotificationWriter(db));
    }
    internal static async Task<Guid> AddTask(IServiceProvider s,Guid version) {
        var db=s.GetRequiredService<AppDbContext>(); var task=new CourseTask {CourseVersionId=version,TitleEn="Practical work",TitleAr="مهمة تطبيقية",Instructions=new(){Ar="اشرح عملك",En="Explain your work"},
            Requirements=[new(){Ar="إجابة واضحة",En="A clear answer"}],SortOrder=1}; db.Add(task);await db.SaveChangesAsync();return task.Id;
    }
    [Theory] [InlineData("learner")] [InlineData("both")]
    public async Task Lifecycle_privacy_terminal_review_and_resubmission_preserve_finances(string persona) {
        using var p=Services();using var scope=p.CreateScope();var s=scope.ServiceProvider;var f=await LearnerLearningTests.Setup(s,persona);var task=await AddTask(s,f.Purchase.Version);
        var db=s.GetRequiredService<AppDbContext>();var service=Service(s);var actor=Principal(f.Purchase.Learner);
        var before=await Phase2IsolatedEnvironmentTests.Snapshot(db,f.Enrollment,f.Purchase.Learner,f.Purchase.Owner);
        Assert.Equal(ServiceFailure.Unauthenticated,(await service.TasksAsync(new(),f.Enrollment)).Failure);
        Assert.Equal(ServiceFailure.Forbidden,(await service.TasksAsync(Principal(f.Purchase.Owner),f.Enrollment)).Failure);
        var request=new CreateAttempt(Guid.NewGuid(),f.Purchase.Version);var draft=(await service.CreateAsync(actor,f.Enrollment,task,request)).Value!;
        Assert.Equal(draft.Id,(await service.CreateAsync(actor,f.Enrollment,task,request)).Value!.Id);
        Assert.Equal("attempt_pending",(await service.CreateAsync(actor,f.Enrollment,task,request with{RequestId=Guid.NewGuid()})).Code);
        var instructor=new InstructorInsightsService(db);var privateList=await instructor.Submissions(Principal(f.Purchase.Owner),null,draft.Id);Assert.Equal(ServiceFailure.NotFound,privateList.Failure);
        var saved=(await service.SaveAsync(actor,f.Enrollment,draft.Id,new(f.Purchase.Version,draft.DraftToken,"An explanation","https://example.test/work"))).Value!;
        Assert.Equal("draft_conflict",(await service.SaveAsync(actor,f.Enrollment,draft.Id,new(f.Purchase.Version,draft.DraftToken,"stale",null))).Code);
        var finalized=(await service.SubmitAsync(actor,f.Enrollment,draft.Id,new(f.Purchase.Version,saved.DraftToken))).Value!;
        Assert.Equal("awaitingReview",finalized.Status);Assert.False(finalized.CanEdit);
        Assert.Equal(finalized.SubmittedAt,(await service.SubmitAsync(actor,f.Enrollment,draft.Id,new(f.Purchase.Version,saved.DraftToken))).Value!.SubmittedAt);
        Assert.Equal(1,await db.Notifications.CountAsync(x=>x.Id==draft.Id&&x.NotificationType=="task.submitted"));
        Assert.Equal("submission_locked",(await service.SaveAsync(actor,f.Enrollment,draft.Id,new(f.Purchase.Version,saved.DraftToken,"rewrite",null))).Code);
        Assert.Equal(ServiceFailure.None,(await instructor.Review(Principal(f.Purchase.Owner),draft.Id,new("rejected","Please revise"))).Failure);
        Assert.Equal(ServiceFailure.Conflict,(await instructor.Review(Principal(f.Purchase.Owner),draft.Id,new("approved",null))).Failure);
        var next=(await service.CreateAsync(actor,f.Enrollment,task,new(Guid.NewGuid(),f.Purchase.Version))).Value!;Assert.Equal(2,next.AttemptNumber);
        next=(await service.SaveAsync(actor,f.Enrollment,next.Id,new(f.Purchase.Version,next.DraftToken,"Revised answer",null))).Value!;
        await service.SubmitAsync(actor,f.Enrollment,next.Id,new(f.Purchase.Version,next.DraftToken));
        Assert.Equal(ServiceFailure.None,(await instructor.Review(Principal(f.Purchase.Owner),next.Id,new("approved","Good"))).Failure);
        var tasks=(await service.TasksAsync(actor,f.Enrollment)).Value!;Assert.True(tasks.Items.Single().IsApproved);
        var optional=(await service.CreateAsync(actor,f.Enrollment,task,new(Guid.NewGuid(),f.Purchase.Version))).Value!;Assert.True(optional.IsOptionalAtCreation);Assert.True(optional.Task.IsApproved);
        Assert.Equal(StripAttempts(before),StripAttempts(await Phase2IsolatedEnvironmentTests.Snapshot(db,f.Enrollment,f.Purchase.Learner,f.Purchase.Owner)));
        Assert.Equal("rejected",(await service.DetailAsync(actor,f.Enrollment,draft.Id)).Value!.Status);
        Assert.Equal(2,await db.Notifications.CountAsync(x=>x.NotificationType=="task.assessed"));
    }
    // Submissions/assessments intentionally change; financial/enrollment/certificate fields must not.
    internal static string StripAttempts(string snapshot) {
        var node=System.Text.Json.Nodes.JsonNode.Parse(snapshot)!;node["attempts"]=new System.Text.Json.Nodes.JsonArray();return node.ToJsonString(new System.Text.Json.JsonSerializerOptions{WriteIndented=false});
    }
    [Fact] public async Task Gate_empty_work_unsafe_urls_and_foreign_attempts_fail_closed() {
        using var p=Services();using var scope=p.CreateScope();var s=scope.ServiceProvider;var f=await LearnerLearningTests.Setup(s);var task=await AddTask(s,f.Purchase.Version);var db=s.GetRequiredService<AppDbContext>();var actor=Principal(f.Purchase.Learner);
        Assert.Equal("submission_disabled",(await Service(s,new MemoryGate(db,false)).CreateAsync(actor,f.Enrollment,task,new(Guid.NewGuid(),f.Purchase.Version))).Code);
        var service=Service(s);var draft=(await service.CreateAsync(actor,f.Enrollment,task,new(Guid.NewGuid(),f.Purchase.Version))).Value!;
        Assert.Equal("empty_submission",(await service.SubmitAsync(actor,f.Enrollment,draft.Id,new(f.Purchase.Version,draft.DraftToken))).Code);
        foreach(var url in new[]{"javascript:alert(1)","file:///secret","https://name:password@example.test"})
            Assert.Equal("invalid_work",(await service.SaveAsync(actor,f.Enrollment,draft.Id,new(f.Purchase.Version,draft.DraftToken,"answer",url))).Code);
        Assert.Equal(ServiceFailure.NotFound,(await service.DetailAsync(actor,f.Enrollment,Guid.NewGuid())).Failure);
        Assert.Equal(ServiceFailure.NotFound,(await service.FileAsync(actor,f.Enrollment,draft.Id,Guid.NewGuid(),false)).Failure);
    }
    [Fact] public async Task Draft_fingerprint_accepts_documented_ABA_but_rejects_different_current_content() {
        using var p=Services();using var scope=p.CreateScope();var s=scope.ServiceProvider;var f=await LearnerLearningTests.Setup(s);var task=await AddTask(s,f.Purchase.Version);var actor=Principal(f.Purchase.Learner);var service=Service(s);
        var a=(await service.CreateAsync(actor,f.Enrollment,task,new(Guid.NewGuid(),f.Purchase.Version))).Value!;
        a=(await service.SaveAsync(actor,f.Enrollment,a.Id,new(f.Purchase.Version,a.DraftToken,"A",null))).Value!;
        var b=(await service.SaveAsync(actor,f.Enrollment,a.Id,new(f.Purchase.Version,a.DraftToken,"B",null))).Value!;
        Assert.Equal("draft_conflict",(await service.SaveAsync(actor,f.Enrollment,a.Id,new(f.Purchase.Version,a.DraftToken,"C",null))).Code);
        var again=(await service.SaveAsync(actor,f.Enrollment,a.Id,new(f.Purchase.Version,b.DraftToken,"A",null))).Value!;
        Assert.Equal(a.DraftToken,again.DraftToken); // Explicitly accepted editable-draft ABA limitation.
    }
}
