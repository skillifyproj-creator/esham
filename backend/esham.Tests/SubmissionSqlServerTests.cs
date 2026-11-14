using System.Data.Common;
using esham.BLL.DTOs;
using esham.BLL.DTOs.Submissions;
using esham.BLL.Services;
using esham.DAL.Data;
using esham.DAL.Entities;
using esham.PL.Storage;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Xunit;
using static esham.Tests.AccountFinalizationTests;
namespace esham.Tests;
public sealed class SubmissionSqlServerTests
{
    internal sealed record Fixture(LearnerLearningTests.LearningFixture Learning,Guid Task) {
        public string Actor=>Learning.Purchase.Learner;public Guid Enrollment=>Learning.Enrollment;public Guid Version=>Learning.Purchase.Version;
    }
    internal static SubmissionMutationGate Gate(AppDbContext db)=>new(db,Options.Create(new SubmissionMutationOptions{Enabled=true,ApprovedIsolatedDatabase=Phase1IsolatedEnvironmentTests.ApprovedCatalog}));
    internal static async Task<ServiceProvider> Provider(params IInterceptor[] interceptors) {
        var p=await LessonProgressSqlServerTests.Provider(interceptors);using var scope=p.CreateScope();Assert.True(await Gate(scope.ServiceProvider.GetRequiredService<AppDbContext>()).IsEnabledAsync());return p;
    }
    internal static async Task<Fixture> Setup(ServiceProvider p) {
        var f=await LessonProgressSqlServerTests.Fixture(p);using var scope=p.CreateScope();var s=scope.ServiceProvider;Assert.True(await Gate(s.GetRequiredService<AppDbContext>()).IsEnabledAsync());
        return new(f,await LearnerSubmissionTests.AddTask(s,f.Purchase.Version));
    }
    internal static string MediaRoot()=>Environment.GetEnvironmentVariable("ESHAM_PHASE3_MEDIA_ROOT")??throw new InvalidOperationException("Dedicated approved media root required.");
    internal static LearnerSubmissionService Service(IServiceProvider s,bool disk=false) {
        var db=s.GetRequiredService<AppDbContext>();return LearnerSubmissionTests.Service(s,Gate(db),disk?new SubmissionAttachmentWriter(db,Gate(db),MediaRoot()):null);
    }
    internal static async Task<ServiceResult<SubmissionDetail>> Create(ServiceProvider p,Fixture f,Guid? request=null){using var scope=p.CreateScope();return await Service(scope.ServiceProvider).CreateAsync(Principal(f.Actor),f.Enrollment,f.Task,new(request??Guid.NewGuid(),f.Version));}
    internal static async Task<ServiceResult<SubmissionDetail>> Save(ServiceProvider p,Fixture f,SubmissionDetail s,string answer){using var scope=p.CreateScope();return await Service(scope.ServiceProvider).SaveAsync(Principal(f.Actor),f.Enrollment,s.Id,new(s.CourseVersionId,s.DraftToken,answer,null));}
    internal static async Task<ServiceResult<SubmissionDetail>> Submit(ServiceProvider p,Fixture f,SubmissionDetail s){using var scope=p.CreateScope();return await Service(scope.ServiceProvider).SubmitAsync(Principal(f.Actor),f.Enrollment,s.Id,new(s.CourseVersionId,s.DraftToken));}
    internal static async Task<ServiceResult<SubmissionDetail>> Upload(ServiceProvider p,Fixture f,SubmissionDetail s,Guid id,string bytes="A real answer"){
        using var scope=p.CreateScope();return await Service(scope.ServiceProvider,true).UploadAsync(Principal(f.Actor),f.Enrollment,s.Id,new(id,s.CourseVersionId,s.DraftToken,"work.txt","text/plain",new MemoryStream(System.Text.Encoding.UTF8.GetBytes(bytes))));
    }
    [Phase1SqlFact] public async Task Concurrent_identical_creates_and_account_wide_cross_task_conflicts() {
        using var p=await Provider();var f=await Setup(p);var id=Guid.NewGuid();var results=await Task.WhenAll(Enumerable.Range(0,5).Select(_=>Create(p,f,id)));
        Assert.All(results,r=>Assert.Equal(ServiceFailure.None,r.Failure));Assert.Single(results.Select(r=>r.Value!.Id).Distinct());
        using var scope=p.CreateScope();var second=await LearnerSubmissionTests.AddTask(scope.ServiceProvider,f.Version);
        Assert.Equal("request_conflict",(await Service(scope.ServiceProvider).CreateAsync(Principal(f.Actor),f.Enrollment,second,new(id,f.Version))).Code);
    }
    [Phase1SqlFact] public async Task Independent_creates_allocate_one_open_attempt_and_stale_edits_do_not_overwrite() {
        using var p=await Provider();var f=await Setup(p);var results=await Task.WhenAll(Enumerable.Range(0,5).Select(_=>Create(p,f)));
        var draft=Assert.Single(results,r=>r.Failure==ServiceFailure.None).Value!;Assert.All(results.Where(r=>r.Value==null),r=>Assert.Equal("attempt_pending",r.Code));
        var edits=await Task.WhenAll(Save(p,f,draft,"A"),Save(p,f,draft,"B"));Assert.Single(edits,r=>r.Failure==ServiceFailure.None);Assert.Single(edits,r=>r.Code=="draft_conflict");
    }
    [Phase1SqlFact] public async Task Concurrent_finalization_replays_create_one_notice_and_freeze_payload() {
        using var p=await Provider();var f=await Setup(p);var draft=(await Save(p,f,(await Create(p,f)).Value!,"final answer")).Value!;
        var results=await Task.WhenAll(Enumerable.Range(0,4).Select(_=>Submit(p,f,draft)));Assert.All(results,r=>Assert.Equal("awaitingReview",r.Value!.Status));Assert.Single(results.Select(r=>r.Value!.SubmittedAt).Distinct());
        using var scope=p.CreateScope();var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();Assert.Equal(1,await db.Notifications.CountAsync(n=>n.Id==draft.Id));
        Assert.Equal("submission_locked",(await Save(p,f,draft,"overwrite")).Code);
    }
    [Phase1SqlFact] public async Task Finalization_edit_race_is_serialized() {
        using var p=await Provider();var f=await Setup(p);var draft=(await Save(p,f,(await Create(p,f)).Value!,"original")).Value!;
        var save=Save(p,f,draft,"new");var submit=Submit(p,f,draft);await Task.WhenAll(save,submit);
        Assert.True(save.Result.Failure==ServiceFailure.None ^ submit.Result.Failure==ServiceFailure.None);
    }
    [Phase1SqlFact] public async Task Duplicate_upload_removal_and_delayed_replay_preserve_tombstone() {
        using var p=await Provider();var f=await Setup(p);var draft=(await Create(p,f)).Value!;var id=Guid.NewGuid();
        var first=(await Upload(p,f,draft,id)).Value!;Assert.Single(first.Attachments);var replay=await Upload(p,f,draft,id);Assert.Equal(first.DraftToken,replay.Value!.DraftToken);
        Assert.Equal("upload_conflict",(await Upload(p,f,draft,id,"different bytes")).Code);
        using var scope=p.CreateScope();var removed=await Service(scope.ServiceProvider).RemoveAsync(Principal(f.Actor),f.Enrollment,draft.Id,first.Attachments[0].Id,new(f.Version,first.DraftToken));Assert.Empty(removed.Value!.Attachments);
        Assert.Equal("upload_conflict",(await Upload(p,f,removed.Value,id)).Code);
    }
    [Phase1SqlFact] public async Task Concurrent_uploads_enforce_five_and_fingerprints() {
        using var p=await Provider();var f=await Setup(p);var draft=(await Create(p,f)).Value!;
        for(var i=0;i<4;i++)draft=(await Upload(p,f,draft,Guid.NewGuid(),"file "+i)).Value!;
        var results=await Task.WhenAll(Upload(p,f,draft,Guid.NewGuid(),"fifth"),Upload(p,f,draft,Guid.NewGuid(),"sixth"));
        var winner=Assert.Single(results,r=>r.Failure==ServiceFailure.None).Value!;Assert.Equal(5,winner.Attachments.Count);
        Assert.Equal("attachment_limit",(await Upload(p,f,winner,Guid.NewGuid())).Code);
    }
    [Phase1SqlFact] public async Task Assessment_resubmission_race_and_immutable_approval_events() {
        using var p=await Provider();var f=await Setup(p);var draft=(await Save(p,f,(await Create(p,f)).Value!,"answer")).Value!;await Submit(p,f,draft);
        async Task<ServiceResult<object>> Review(){using var scope=p.CreateScope();return await new InstructorInsightsService(scope.ServiceProvider.GetRequiredService<AppDbContext>()).Review(Principal(f.Learning.Purchase.Owner),draft.Id,new("rejected","Revise"));}
        var review=Review();var create=Create(p,f);await Task.WhenAll(review,create);Assert.Equal(ServiceFailure.None,review.Result.Failure);
        var next=create.Result.Value??(await Create(p,f)).Value!;Assert.Equal(2,next.AttemptNumber);
        next=(await Save(p,f,next,"revised")).Value!;await Submit(p,f,next);
        using var scope=p.CreateScope();var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();var instructor=new InstructorInsightsService(db);
        Assert.Equal(ServiceFailure.None,(await instructor.Review(Principal(f.Learning.Purchase.Owner),next.Id,new("approved","Good"))).Failure);
        Assert.Equal(ServiceFailure.Conflict,(await instructor.Review(Principal(f.Learning.Purchase.Owner),next.Id,new("rejected","Cannot revoke"))).Failure);
        Assert.Equal(2,await db.Notifications.CountAsync(n=>n.RecipientUserId==f.Actor&&n.NotificationType=="task.assessed"));
        Assert.True((await Service(scope.ServiceProvider).TasksAsync(Principal(f.Actor),f.Enrollment)).Value!.Items.Single().IsApproved);
    }
    [Phase1SqlFact] public async Task Superseded_draft_is_read_only_and_historical_pending_stays_assessable() {
        using var p=await Provider();var f=await Setup(p);var draft=(await Save(p,f,(await Create(p,f)).Value!,"saved")).Value!;
        using(var resources=p.CreateScope()){
            var db=resources.ServiceProvider.GetRequiredService<AppDbContext>();var asset=await db.MediaAssets.Where(x=>x.PrimaryVideoForLessons.Any(l=>l.Id==f.Learning.Lesson)).Select(x=>x.Id).SingleAsync();
            db.TaskAttachments.Add(new(){CourseTaskId=f.Task,MediaAssetId=asset,DisplayName="Original task resource"});await db.SaveChangesAsync();
        }
        var next=await LessonProgressSqlServerTests.NextVersion(p,f.Learning);Guid newTask;
        using(var scope=p.CreateScope()){var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();var old=await db.CourseTasks.SingleAsync(t=>t.Id==f.Task);var t=new CourseTask{CourseVersionId=next.Version,LogicalTaskId=old.LogicalTaskId,TitleEn="Updated task"};db.Add(t);await db.SaveChangesAsync();newTask=t.Id;}
        await LessonProgressSqlServerTests.Publish(p,f.Learning,next.Version);
        Assert.Equal("publication_changed",(await Save(p,f,draft,"stale")).Code);Assert.Equal("publication_changed",(await Submit(p,f,draft)).Code);
        Assert.Equal("publication_changed",(await Upload(p,f,draft,Guid.NewGuid())).Code);
        using var s=p.CreateScope();var service=Service(s.ServiceProvider);var historical=(await service.DetailAsync(Principal(f.Actor),f.Enrollment,draft.Id)).Value!;Assert.False(historical.CanEdit);Assert.Empty(historical.Task.Attachments);
        Assert.Equal(ServiceFailure.None,(await service.CreateAsync(Principal(f.Actor),f.Enrollment,newTask,new(Guid.NewGuid(),next.Version))).Failure);
    }
    [Phase1SqlFact] public async Task Historical_pending_approval_carries_forward_without_financial_effects() {
        using var p=await Provider();var f=await Setup(p);var draft=(await Save(p,f,(await Create(p,f)).Value!,"answer")).Value!;await Submit(p,f,draft);
        var next=await LessonProgressSqlServerTests.NextVersion(p,f.Learning);
        using(var setup=p.CreateScope()){var db=setup.ServiceProvider.GetRequiredService<AppDbContext>();var old=await db.CourseTasks.SingleAsync(t=>t.Id==f.Task);db.Add(new CourseTask{CourseVersionId=next.Version,LogicalTaskId=old.LogicalTaskId,TitleEn="Changed rubric"});await db.SaveChangesAsync();}
        await LessonProgressSqlServerTests.Publish(p,f.Learning,next.Version);
        using var scope=p.CreateScope();var s=scope.ServiceProvider;var db2=s.GetRequiredService<AppDbContext>();
        var before=await Phase2IsolatedEnvironmentTests.Snapshot(db2,f.Enrollment,f.Actor,f.Learning.Purchase.Owner);
        Assert.Equal(ServiceFailure.None,(await new InstructorInsightsService(db2).Review(Principal(f.Learning.Purchase.Owner),draft.Id,new("approved","Historical"))).Failure);
        Assert.True((await Service(s).TasksAsync(Principal(f.Actor),f.Enrollment)).Value!.Items.Single().IsApproved);
        Assert.True((await Service(s).DetailAsync(Principal(f.Actor),f.Enrollment,draft.Id)).Value!.Task.IsApproved);
        Assert.Equal(LearnerSubmissionTests.StripAttempts(before),LearnerSubmissionTests.StripAttempts(await Phase2IsolatedEnvironmentTests.Snapshot(db2,f.Enrollment,f.Actor,f.Learning.Purchase.Owner)));
    }
    [Phase1SqlFact] public async Task Upload_SQL_failure_rolls_back_link_and_compensates_file() {
        var fail=new FailSave();using var p=await Provider(fail);var f=await Setup(p);var draft=(await Create(p,f)).Value!;fail.Armed=true;
        await Assert.ThrowsAsync<InvalidOperationException>(()=>Upload(p,f,draft,Guid.NewGuid()));
        using var scope=p.CreateScope();var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();Assert.False(await db.SubmissionAttachments.AnyAsync(a=>a.TaskSubmissionId==draft.Id));
        Assert.NotNull(fail.Key);Assert.False(File.Exists(Path.Combine(MediaRoot(),fail.Key!)));
    }
    [Phase1SqlFact] public async Task Lost_commit_finalization_reconciles_one_event() {
        var fail=new LostCommit();using var p=await Provider(fail);var f=await Setup(p);var draft=(await Save(p,f,(await Create(p,f)).Value!,"answer")).Value!;fail.Armed=true;
        Assert.Equal(ServiceFailure.None,(await Submit(p,f,draft)).Failure);Assert.True(fail.Injected);
        using var scope=p.CreateScope();var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();Assert.Equal(1,await db.Notifications.CountAsync(n=>n.Id==draft.Id));
    }
    [Phase1SqlFact] public async Task Lost_upload_commit_keeps_committed_file_and_one_link(){
        var fail=new LostCommit();using var p=await Provider(fail);var f=await Setup(p);var draft=(await Create(p,f)).Value!;fail.Armed=true;
        var uploaded=await Upload(p,f,draft,Guid.NewGuid());Assert.Equal(ServiceFailure.None,uploaded.Failure);Assert.True(fail.Injected);
        using var scope=p.CreateScope();var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var key=await db.SubmissionAttachments.Where(x=>x.TaskSubmissionId==draft.Id).Select(x=>x.MediaAsset.StorageKey).SingleAsync();Assert.True(File.Exists(Path.Combine(MediaRoot(),key)));
    }
    [Phase1SqlFact] public async Task Interrupted_upload_reconciliation_uses_actual_database_and_respects_active_lease(){
        using var p=await Provider();using var scope=p.CreateScope();var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();Assert.True(await Gate(db).IsEnabledAsync());
        using var writer=new SubmissionAttachmentWriter(db,Gate(db),MediaRoot());
        var file=await writer.PrepareAsync(new MemoryStream("synthetic interrupted upload"u8.ToArray()),"work.txt","text/plain",default);
        var marker=Path.Combine(MediaRoot(),".phase3-journal",file.Key+".pending");File.SetLastWriteTimeUtc(marker,DateTime.UtcNow.AddDays(-2));
        using var recovered=new SubmissionAttachmentWriter(db,Gate(db),MediaRoot());await recovered.ReconcileAsync(file.Key,default);Assert.True(File.Exists(Path.Combine(MediaRoot(),file.Key)));
        writer.Dispose();await recovered.ReconcileAsync(file.Key,default);Assert.False(File.Exists(Path.Combine(MediaRoot(),file.Key)));Assert.False(File.Exists(marker));
    }
    [Phase1SqlFact] public async Task Concurrent_identical_uploads_and_cross_submission_identity_conflicts(){
        using var p=await Provider();var f=await Setup(p);var draft=(await Create(p,f)).Value!;var upload=Guid.NewGuid();
        var results=await Task.WhenAll(Upload(p,f,draft,upload),Upload(p,f,draft,upload));Assert.All(results,r=>Assert.Equal(ServiceFailure.None,r.Failure));Assert.Single(results.Select(r=>r.Value!.Attachments.Single().Id).Distinct());
        using var scope=p.CreateScope();var task=await LearnerSubmissionTests.AddTask(scope.ServiceProvider,f.Version);
        var other=(await Service(scope.ServiceProvider).CreateAsync(Principal(f.Actor),f.Enrollment,task,new(Guid.NewGuid(),f.Version))).Value!;
        Assert.Equal("upload_conflict",(await Upload(p,f,other,upload)).Code);
    }
    [Phase1SqlFact] public async Task Finalization_versus_upload_never_commits_a_partial_attachment_set(){
        using var p=await Provider();var f=await Setup(p);var draft=(await Save(p,f,(await Create(p,f)).Value!,"answer")).Value!;
        var submit=Submit(p,f,draft);var upload=Upload(p,f,draft,Guid.NewGuid());await Task.WhenAll(submit,upload);
        Assert.True(submit.Result.Failure==ServiceFailure.None ^ upload.Result.Failure==ServiceFailure.None);
        using var scope=p.CreateScope();var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();var saved=await db.TaskSubmissions.Include(x=>x.Attachments).SingleAsync(x=>x.Id==draft.Id);
        Assert.Equal(saved.Status=="awaitingReview"?0:1,saved.Attachments.Count);
    }
    [Phase1SqlFact] public async Task Account_wide_request_reuse_across_courses_conflicts(){
        using var p=await Provider();var first=await Setup(p);var second=await Setup(p);var request=Guid.NewGuid();await Create(p,first,request);
        using var scope=p.CreateScope();var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();Assert.True(await Gate(db).IsEnabledAsync());
        var e=new Enrollment{LearnerUserId=first.Actor,CourseId=second.Learning.Purchase.Course,CourseVersionId=second.Version};db.Add(e);db.EnrollmentVersionAccess.Add(new(){EnrollmentId=e.Id,CourseId=e.CourseId,CourseVersionId=e.CourseVersionId,Reason="enrolled"});await db.SaveChangesAsync();
        Assert.Equal("request_conflict",(await Service(scope.ServiceProvider).CreateAsync(Principal(first.Actor),e.Id,second.Task,new(request,second.Version))).Code);
        Assert.False(await db.TaskSubmissions.AnyAsync(x=>x.EnrollmentId==e.Id));
    }
    [Phase1SqlTheory][InlineData(false)][InlineData(true)] public async Task Publication_races_with_draft_creation_and_finalization(bool finalize){
        using var p=await Provider();var f=await Setup(p);SubmissionDetail? draft=finalize?(await Save(p,f,(await Create(p,f)).Value!,"answer")).Value:null;
        var next=await LessonProgressSqlServerTests.NextVersion(p,f.Learning);
        using(var scope=p.CreateScope()){var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();var old=await db.CourseTasks.SingleAsync(t=>t.Id==f.Task);db.CourseTasks.Add(new(){CourseVersionId=next.Version,LogicalTaskId=old.LogicalTaskId,TitleEn="Updated"});await db.SaveChangesAsync();}
        var barrier=new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        async Task<ServiceResult<SubmissionDetail>> Write(){await barrier.Task;return finalize?await Submit(p,f,draft!):await Create(p,f);}
        async Task Publish(){await barrier.Task;await LessonProgressSqlServerTests.Publish(p,f.Learning,next.Version);}
        var write=Write();var publish=Publish();barrier.SetResult();await Task.WhenAll(write,publish);
        Assert.True(write.Result.Failure==ServiceFailure.None||write.Result.Code=="publication_changed");
        using var verify=p.CreateScope();var db2=verify.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.All(await db2.TaskSubmissions.Where(x=>x.EnrollmentId==f.Enrollment).ToListAsync(),x=>Assert.Equal(f.Task,x.CourseTaskId));
    }
    private sealed class FailSave:SaveChangesInterceptor {
        public bool Armed;public string? Key;
        public override ValueTask<int> SavedChangesAsync(SaveChangesCompletedEventData e,int result,CancellationToken ct=default){
            if(Armed&&e.Context!.ChangeTracker.Entries<SubmissionAttachment>().Any()){Armed=false;Key=e.Context.ChangeTracker.Entries<MediaAsset>().First(x=>x.Entity.MediaType=="attachment").Entity.StorageKey;throw new InvalidOperationException("Injected attachment failure.");}return ValueTask.FromResult(result);}
    }
    private sealed class LostCommit:DbTransactionInterceptor {
        public bool Armed,Injected;public override Task TransactionCommittedAsync(DbTransaction tx,TransactionEndEventData e,CancellationToken ct=default){if(Armed){Armed=false;Injected=true;throw new TimeoutException("Injected acknowledgement ambiguity.");}return Task.CompletedTask;}
    }
}
