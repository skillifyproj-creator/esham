using System.Data;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using esham.BLL.DTOs;
using esham.BLL.DTOs.Learning;
using esham.BLL.DTOs.Submissions;
using esham.BLL.Interfaces;
using esham.DAL.Data;
using esham.DAL.Entities;
using Microsoft.EntityFrameworkCore;
namespace esham.BLL.Services;

public sealed class LearnerSubmissionService(AppDbContext db, LearnerLearningAccess access, ICourseVersionUpdates versions,
    ISubmissionMutationGate gate, ISubmissionAttachmentWriter files, IMediaStorage storage, INotificationWriter notices) : ILearnerSubmissionService
{
    internal static Guid Identity(string kind, string account, Guid request) => new(SHA256.HashData(Encoding.UTF8.GetBytes($"esham:submission:{kind}:v1:{account}:{request:N}")).AsSpan(0, 16));
    private static ServiceResult<T> Fail<T>(ServiceFailure failure, string? message, string? code = null) => ServiceResult<T>.Fail(failure, message ?? "Submission unavailable.", code);
    private IQueryable<TaskSubmission> Attempts => db.TaskSubmissions.Include(x => x.Attachments).ThenInclude(x => x.MediaAsset)
        .Include(x => x.Reviews).Include(x => x.CourseTask).ThenInclude(x => x.Attachments).ThenInclude(x => x.MediaAsset);
    private static string Token(TaskSubmission s) => Convert.ToHexString(SHA256.HashData(JsonSerializer.SerializeToUtf8Bytes(new {
        s.Id, s.EnrollmentId, s.CourseTaskId, s.AnswerText, s.WorkUrl,
        Files = s.Attachments.OrderBy(x => x.Id).Select(x => new { x.Id, x.MediaAssetId, x.MediaAsset.ContentHash }).ToArray()
    })));
    private static bool Editable(TaskSubmission s) => s.Status == "inProgress" && s.SubmittedAt == null && s.Reviews.Count == 0;
    private static bool ValidUrl(string? value) => string.IsNullOrEmpty(value) || Uri.TryCreate(value, UriKind.Absolute, out var uri)
        && uri.Scheme is "http" or "https" && string.IsNullOrEmpty(uri.UserInfo) && !string.IsNullOrEmpty(uri.Host)
        && !value.Any(char.IsControl);
    private LearnerTask MapTask(CourseTask t, Guid enrollmentId, bool approved = false, bool optional = false, bool resources = true) => new(t.Id, t.LogicalTaskId, t.CourseVersionId,
        t.TitleAr, t.TitleEn, t.DescriptionAr, t.DescriptionEn, t.Instructions == null ? null : new(t.Instructions.Ar, t.Instructions.En),
        t.Requirements?.Select(x => new TaskText(x.Ar, x.En)).ToList() ?? [], t.SortOrder, approved, optional,
        resources ? t.Attachments.OrderBy(x => x.SortOrder).ThenBy(x => x.Id).Select(x => new TaskFile(x.Id, x.DisplayName, x.MediaAsset.SizeBytes,
            $"/me/enrollments/{enrollmentId}/tasks/{t.Id}/attachments/{x.Id}/content")).ToList() : []);
    private SubmissionDetail Map(TaskSubmission s, LearningAccess a) => new(a.Enrollment.LearnerUserId, s.EnrollmentId, s.Id, s.CourseTaskId,
        s.CourseTask.CourseVersionId, s.AttemptNumber, s.IsOptionalAtCreation, s.Status, s.AnswerText, s.WorkUrl, s.CreatedAt, s.SubmittedAt, Token(s),
        Editable(s) && s.CourseTask.CourseVersionId == a.Version.Id, MapTask(s.CourseTask, s.EnrollmentId, approved:EarnedTask(s,a), optional:s.IsOptionalAtCreation==true, resources:s.CourseTask.CourseVersionId==a.Version.Id),
        s.Attachments.OrderBy(x => x.Id).Select(x => new TaskFile(x.Id, x.MediaAsset.OriginalFileName, x.MediaAsset.SizeBytes,
            $"/me/enrollments/{s.EnrollmentId}/submissions/{s.Id}/attachments/{x.Id}/content")).ToList(),
        s.Reviews.OrderBy(x => x.ReviewedAt).ThenBy(x => x.Id).Select(x => new AttemptReview(x.Id, x.Decision, x.Feedback, x.ReviewedAt)).ToList());
    private bool EarnedTask(TaskSubmission s,LearningAccess a) => db.TaskSubmissions.AsNoTracking().Any(x=>x.EnrollmentId==s.EnrollmentId
        && x.CourseTask.LogicalTaskId==s.CourseTask.LogicalTaskId && x.CourseTask.CourseVersion.CourseId==a.Enrollment.CourseId
        && x.CourseTask.CourseVersion.ReviewStatus=="approved" && (x.Status=="approved"||x.Reviews.Any(r=>r.Decision=="approved")));
    private async Task<TaskSubmission?> Owned(Guid id, LearningAccess a, CancellationToken ct) => await Attempts.SingleOrDefaultAsync(x => x.Id == id
        && x.EnrollmentId == a.Enrollment.Id && x.CourseTask.CourseVersion.CourseId == a.Enrollment.CourseId && x.CourseTask.CourseVersion.ReviewStatus == "approved"
        && (x.CourseTask.CourseVersionId == a.Enrollment.CourseVersionId || db.EnrollmentVersionAccess.Any(v => v.EnrollmentId == a.Enrollment.Id && v.CourseId == a.Enrollment.CourseId && v.CourseVersionId == x.CourseTask.CourseVersionId)), ct);
    public async Task<ServiceResult<LearnerTaskPage>> TasksAsync(ClaimsPrincipal actor, Guid enrollmentId, CancellationToken ct = default)
    {
        var resolved = await access.ResolveAsync(actor, enrollmentId, ct: ct);
        if (resolved.Value is not { } a) return Fail<LearnerTaskPage>(resolved.Failure, resolved.Message, resolved.Code);
        var projection = await versions.GetStateAsync(enrollmentId, a.Enrollment.LearnerUserId, ct);
        if (projection.Value is not { } v) return Fail<LearnerTaskPage>(projection.Failure, projection.Message, projection.Code);
        if (v.AvailableCourseVersionId != a.Version.Id) return Fail<LearnerTaskPage>(ServiceFailure.Conflict, "Publication changed.", "publication_changed");
        var tasks = await db.CourseTasks.AsNoTracking().Include(x => x.Attachments).ThenInclude(x => x.MediaAsset).Where(x => x.CourseVersionId == a.Version.Id).OrderBy(x => x.SortOrder).ThenBy(x => x.Id).ToListAsync(ct);
        return ServiceResult<LearnerTaskPage>.Ok(new(a.Enrollment.LearnerUserId, enrollmentId, a.Version.Id, await gate.IsEnabledAsync(ct), tasks.Select(t => {
            var state = v.Tasks.Single(x => x.TaskId == t.Id); return MapTask(t, enrollmentId, state.IsApproved, state.IsOptional);
        }).ToList()));
    }
    public async Task<ServiceResult<LearnerTask>> TaskAsync(ClaimsPrincipal actor, Guid enrollmentId, Guid taskId, CancellationToken ct = default)
    {
        var page = await TasksAsync(actor, enrollmentId, ct);
        if (page.Value is null) return Fail<LearnerTask>(page.Failure, page.Message, page.Code);
        var task = page.Value.Items.SingleOrDefault(x => x.Id == taskId);
        return task == null ? Fail<LearnerTask>(ServiceFailure.NotFound, "Task not found.") : ServiceResult<LearnerTask>.Ok(task);
    }
    public async Task<ServiceResult<SubmissionDetail>> DetailAsync(ClaimsPrincipal actor, Guid enrollmentId, Guid submissionId, CancellationToken ct = default)
    {
        var resolved = await access.ResolveAsync(actor, enrollmentId, ct: ct);
        if (resolved.Value is not { } a) return Fail<SubmissionDetail>(resolved.Failure, resolved.Message, resolved.Code);
        var s = await Owned(submissionId, a, ct);
        return s == null ? Fail<SubmissionDetail>(ServiceFailure.NotFound, "Submission not found.") : ServiceResult<SubmissionDetail>.Ok(Map(s, a));
    }
    public async Task<ServiceResult<SubmissionPage>> HistoryAsync(ClaimsPrincipal actor, Guid enrollmentId, Guid? taskId, int page, CancellationToken ct = default)
    {
        var resolved = await access.ResolveAsync(actor, enrollmentId, ct: ct);
        if (resolved.Value is not { } a) return Fail<SubmissionPage>(resolved.Failure, resolved.Message, resolved.Code);
        if (page < 1 || page > 100000) return Fail<SubmissionPage>(ServiceFailure.Validation, "Invalid pagination.");
        var q = db.TaskSubmissions.AsNoTracking().Where(x => x.EnrollmentId == enrollmentId && (!taskId.HasValue || x.CourseTaskId == taskId)
            && x.CourseTask.CourseVersion.CourseId == a.Enrollment.CourseId && x.CourseTask.CourseVersion.ReviewStatus == "approved"
            && (x.CourseTask.CourseVersionId == a.Enrollment.CourseVersionId || db.EnrollmentVersionAccess.Any(v => v.EnrollmentId == enrollmentId && v.CourseId == a.Enrollment.CourseId && v.CourseVersionId == x.CourseTask.CourseVersionId)));
        var ids = await q.OrderByDescending(x => x.CreatedAt).ThenBy(x => x.Id).Skip((page - 1) * 20).Take(20).Select(x => x.Id).ToListAsync(ct);
        var rows = new List<SubmissionDetail>(); foreach (var id in ids) rows.Add(Map((await Owned(id, a, ct))!, a));
        return ServiceResult<SubmissionPage>.Ok(new(a.Enrollment.LearnerUserId, enrollmentId, page, 20, await q.CountAsync(ct), rows));
    }
    private async Task<ServiceResult<SubmissionDetail>> Transaction(ClaimsPrincipal actor, Guid enrollmentId, Func<LearningAccess, Task<ServiceResult<SubmissionDetail>>> action, CancellationToken ct)
    {
        var first = await access.ResolveAsync(actor, enrollmentId, ct: ct);
        if (first.Value is not { } initial) return Fail<SubmissionDetail>(first.Failure, first.Message, first.Code);
        if (!await gate.IsEnabledAsync(ct)) return Fail<SubmissionDetail>(ServiceFailure.Forbidden, "Submission mutations disabled.", "submission_disabled");
        try {
            return await db.Database.CreateExecutionStrategy().ExecuteAsync(async () => {
                db.ChangeTracker.Clear(); await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
                if (db.Database.IsSqlServer()) {
                    var lockedCourse=await db.Courses.FromSqlInterpolated($"SELECT * FROM [Courses] WITH (UPDLOCK,HOLDLOCK) WHERE [Id]={initial.Enrollment.CourseId}").SingleAsync(ct);
                    foreach(var uid in new[]{initial.Enrollment.LearnerUserId,lockedCourse.OwnerUserId}.Distinct().OrderBy(x=>x,StringComparer.Ordinal))
                        await db.Users.FromSqlInterpolated($"SELECT * FROM [AspNetUsers] WITH (UPDLOCK,HOLDLOCK) WHERE [Id]={uid}").SingleAsync(ct);
                    await db.Enrollments.FromSqlInterpolated($"SELECT * FROM [Enrollments] WITH (UPDLOCK,HOLDLOCK) WHERE [Id]={enrollmentId}").SingleAsync(ct);
                }
                var check = await access.ResolveAsync(actor, enrollmentId, ct: ct);
                if (check.Value is not { } a) return Fail<SubmissionDetail>(check.Failure, check.Message, check.Code);
                var result = await action(a);
                if (result.Failure != ServiceFailure.None) return result;
                await db.SaveChangesAsync(ct); await tx.CommitAsync(ct); return result;
            });
        } finally { db.ChangeTracker.Clear(); }
    }
    public Task<ServiceResult<SubmissionDetail>> CreateAsync(ClaimsPrincipal actor, Guid enrollmentId, Guid taskId, CreateAttempt request, CancellationToken ct = default)
        => Transaction(actor, enrollmentId, async a => {
            if (request.RequestId == Guid.Empty) return Fail<SubmissionDetail>(ServiceFailure.Validation, "A request GUID is required.");
            var id = Identity("draft", a.Enrollment.LearnerUserId, request.RequestId);
            // Reserve the existing primary-key range before checking an absent request ID.
            // Serializable S-S lookups followed by INSERT otherwise form conversion deadlocks.
            if(db.Database.IsSqlServer())await db.TaskSubmissions.FromSqlInterpolated($"SELECT * FROM [TaskSubmissions] WITH (UPDLOCK,HOLDLOCK) WHERE [Id]={id}").AsNoTracking().ToListAsync(ct);
            var existing = await Attempts.SingleOrDefaultAsync(x => x.Id == id, ct);
            if (existing != null) return existing.EnrollmentId == enrollmentId && existing.CourseTaskId == taskId && existing.CourseTask.CourseVersionId == request.ExpectedCourseVersionId
                ? ServiceResult<SubmissionDetail>.Ok(Map(existing, a)) : Fail<SubmissionDetail>(ServiceFailure.Conflict, "Request identity already belongs to another task.", "request_conflict");
            if (a.Version.Id != request.ExpectedCourseVersionId) return Fail<SubmissionDetail>(ServiceFailure.Conflict, "Publication changed.", "publication_changed");
            var t = await db.CourseTasks.Include(x => x.Attachments).ThenInclude(x => x.MediaAsset).SingleOrDefaultAsync(x => x.Id == taskId && x.CourseVersionId == a.Version.Id, ct);
            if (t == null) return Fail<SubmissionDetail>(ServiceFailure.NotFound, "Task not found.");
            if (await db.TaskSubmissions.AnyAsync(x => x.EnrollmentId == enrollmentId && x.CourseTaskId == taskId && (x.Status == "inProgress" || x.Status == "awaitingReview"), ct))
                return Fail<SubmissionDetail>(ServiceFailure.Conflict, "An editable or pending attempt already exists.", "attempt_pending");
            var state = await versions.GetStateAsync(enrollmentId, a.Enrollment.LearnerUserId, ct);
            if (state.Value is not { } v) return Fail<SubmissionDetail>(state.Failure, state.Message, state.Code);
            var next = (await db.TaskSubmissions.Where(x => x.EnrollmentId == enrollmentId && x.CourseTaskId == taskId).MaxAsync(x => (int?)x.AttemptNumber, ct) ?? 0);
            if (next == int.MaxValue) return Fail<SubmissionDetail>(ServiceFailure.Conflict, "Attempt limit reached.");
            var s = new TaskSubmission { Id = id, EnrollmentId = enrollmentId, CourseTaskId = taskId, CourseTask = t, AttemptNumber = next + 1,
                IsOptionalAtCreation = v.IsCourseCompleted || v.Tasks.Single(x => x.TaskId == taskId).IsApproved };
            db.TaskSubmissions.Add(s); return ServiceResult<SubmissionDetail>.Ok(Map(s, a));
        }, ct);
    private ServiceResult<SubmissionDetail>? Preconditions(TaskSubmission s, LearningAccess a, Guid version, string? token)
    {
        if (version != s.CourseTask.CourseVersionId || version != a.Version.Id) return Fail<SubmissionDetail>(ServiceFailure.Conflict, "The draft version was superseded; its history is retained.", "publication_changed");
        if (!Editable(s)) return Fail<SubmissionDetail>(ServiceFailure.Conflict, "Submitted/reviewed attempts are immutable.", "submission_locked");
        return token == Token(s) ? null : new(Map(s, a), ServiceFailure.Conflict, "Draft changed. Reload the canonical state.", "draft_conflict");
    }
    public Task<ServiceResult<SubmissionDetail>> SaveAsync(ClaimsPrincipal actor, Guid enrollmentId, Guid submissionId, SaveDraft request, CancellationToken ct = default)
        => Transaction(actor, enrollmentId, async a => {
            var s = await Owned(submissionId, a, ct); if (s == null) return Fail<SubmissionDetail>(ServiceFailure.NotFound, "Submission not found.");
            var fail = Preconditions(s, a, request.ExpectedTaskVersionId, request.ExpectedDraftToken); if (fail != null) return fail;
            var answer = request.AnswerText?.Trim(); var url = request.WorkUrl?.Trim();
            if (answer?.Length > 5000 || url?.Length > 2000 || !ValidUrl(url)) return Fail<SubmissionDetail>(ServiceFailure.Validation, "Invalid answer or HTTP/HTTPS work URL.", "invalid_work");
            s.AnswerText = answer; s.WorkUrl = url; return ServiceResult<SubmissionDetail>.Ok(Map(s, a));
        }, ct);
    public Task<ServiceResult<SubmissionDetail>> SubmitAsync(ClaimsPrincipal actor, Guid enrollmentId, Guid submissionId, FinalizeAttempt request, CancellationToken ct = default)
        => Transaction(actor, enrollmentId, async a => {
            var s = await Owned(submissionId, a, ct); if (s == null) return Fail<SubmissionDetail>(ServiceFailure.NotFound, "Submission not found.");
            // Reconcile a committed finalization before present-day publication checks.
            if (s.SubmittedAt != null) return request.ExpectedTaskVersionId == s.CourseTask.CourseVersionId && request.ExpectedDraftToken == Token(s)
                ? ServiceResult<SubmissionDetail>.Ok(Map(s, a)) : Fail<SubmissionDetail>(ServiceFailure.Conflict, "Finalization identity conflicts.", "submission_locked");
            var fail = Preconditions(s, a, request.ExpectedTaskVersionId, request.ExpectedDraftToken); if (fail != null) return fail;
            if(s.AnswerText?.Length>5000||s.WorkUrl?.Length>2000||!ValidUrl(s.WorkUrl))return Fail<SubmissionDetail>(ServiceFailure.Validation,"Invalid answer or work URL.","invalid_work");
            if (string.IsNullOrWhiteSpace(s.AnswerText) && string.IsNullOrWhiteSpace(s.WorkUrl) && s.Attachments.Count == 0)
                return Fail<SubmissionDetail>(ServiceFailure.Validation, "Provide an answer, work URL or attachment.", "empty_submission");
            // Requirements are free text, not a machine-readable mandated file-format schema.
            s.Status = "awaitingReview"; s.SubmittedAt = DateTimeOffset.UtcNow;
            await notices.StageAsync(new(s.Id, a.Enrollment.Course.OwnerUserId, "task.submitted", "تسليم مهمة جديد", "New task submission",
                "تم تسليم محاولة جديدة للمراجعة.", "A learner submitted a new attempt for assessment."), ct);
            return ServiceResult<SubmissionDetail>.Ok(Map(s, a));
        }, ct);
    public async Task<ServiceResult<SubmissionDetail>> UploadAsync(ClaimsPrincipal actor, Guid enrollmentId, Guid submissionId, SubmissionFileInput request, CancellationToken ct = default)
    {
        var check = await DetailAsync(actor, enrollmentId, submissionId, ct);
        if (check.Value is null) return check;
        if (!await gate.IsEnabledAsync(ct)) return Fail<SubmissionDetail>(ServiceFailure.Forbidden, "Submission mutations disabled.", "submission_disabled");
        if (request.UploadId == Guid.Empty) return Fail<SubmissionDetail>(ServiceFailure.Validation, "Upload GUID required.");
        PreparedSubmissionFile prepared;
        try { prepared = await files.PrepareAsync(request.Content, request.FileName, request.ContentType, ct); }
        catch (InvalidDataException) { return Fail<SubmissionDetail>(ServiceFailure.Validation, "Unsupported, malformed or oversized attachment.", "invalid_attachment"); }
        try {
            var result = await Transaction(actor, enrollmentId, async a => {
                var s = await Owned(submissionId, a, ct); if (s == null) return Fail<SubmissionDetail>(ServiceFailure.NotFound, "Submission not found.");
                var assetId = Identity("upload", a.Enrollment.LearnerUserId, request.UploadId);
                var prior = await db.MediaAssets.SingleOrDefaultAsync(x => x.Id == assetId, ct);
                if (prior != null) {
                    var link = s.Attachments.SingleOrDefault(x => x.MediaAssetId == assetId);
                    return link != null && prior.ContentHash == prepared.Hash && prior.SizeBytes == prepared.Size && prior.MimeType == prepared.ContentType && prior.OriginalFileName == prepared.Name
                        ? ServiceResult<SubmissionDetail>.Ok(Map(s, a)) : Fail<SubmissionDetail>(ServiceFailure.Conflict, "Upload identity differs or was detached.", "upload_conflict");
                }
                var fail = Preconditions(s, a, request.ExpectedTaskVersionId, request.ExpectedDraftToken); if (fail != null) return fail;
                if (s.Attachments.Count >= 5) return Fail<SubmissionDetail>(ServiceFailure.Conflict, "Maximum five attachments.", "attachment_limit");
                var asset = new MediaAsset { Id = assetId, OwnerUserId = a.Enrollment.LearnerUserId, StorageKey = prepared.Key,
                    ContentHash = prepared.Hash, SizeBytes = prepared.Size, MimeType = prepared.ContentType, OriginalFileName = prepared.Name, MediaType = "attachment" };
                var linkNew = new SubmissionAttachment { Id = assetId, TaskSubmissionId = s.Id, MediaAssetId = assetId, MediaAsset = asset };
                db.MediaAssets.Add(asset); db.SubmissionAttachments.Add(linkNew);
                if(!s.Attachments.Contains(linkNew))s.Attachments.Add(linkNew);
                return ServiceResult<SubmissionDetail>.Ok(Map(s, a));
            }, ct);
            return result;
        } finally {
            // Even exceptions/ambiguous commits require persisted-reference reconciliation.
            // Failure leaves the operational journal for conservative later reconciliation.
            try { await files.ReconcileAsync(prepared.Key, CancellationToken.None); } catch { /* Retain journal and file; never guess rollback. */ }
        }
    }
    public Task<ServiceResult<SubmissionDetail>> RemoveAsync(ClaimsPrincipal actor, Guid enrollmentId, Guid submissionId, Guid attachmentId, AttachmentMutation request, CancellationToken ct = default)
        => Transaction(actor, enrollmentId, async a => {
            var s = await Owned(submissionId, a, ct); if (s == null) return Fail<SubmissionDetail>(ServiceFailure.NotFound, "Submission not found.");
            var fail = Preconditions(s, a, request.ExpectedTaskVersionId, request.ExpectedDraftToken); if (fail != null) return fail;
            var attachment = s.Attachments.SingleOrDefault(x => x.Id == attachmentId);
            if (attachment == null) return Fail<SubmissionDetail>(ServiceFailure.NotFound, "Attachment not found.");
            db.SubmissionAttachments.Remove(attachment); s.Attachments.Remove(attachment);
            // Keep immutable MediaAsset metadata as the upload identity tombstone. Do not resurrect it.
            return ServiceResult<SubmissionDetail>.Ok(Map(s, a));
        }, ct);
    public async Task<ServiceResult<LearningMedia>> FileAsync(ClaimsPrincipal actor, Guid enrollmentId, Guid resourceId, Guid attachmentId, bool taskResource, CancellationToken ct = default)
    {
        var resolved = await access.ResolveAsync(actor, enrollmentId, ct: ct);
        if (resolved.Value is not { } a) return Fail<LearningMedia>(resolved.Failure, resolved.Message, resolved.Code);
        MediaAsset? asset;
        if (taskResource) asset = await db.TaskAttachments.AsNoTracking().Where(x => x.Id == attachmentId && x.CourseTaskId == resourceId && x.CourseTask.CourseVersionId == a.Version.Id).Select(x => x.MediaAsset).SingleOrDefaultAsync(ct);
        else { var s = await Owned(resourceId, a, ct); asset = s?.Attachments.SingleOrDefault(x => x.Id == attachmentId)?.MediaAsset; }
        if (asset == null) return Fail<LearningMedia>(ServiceFailure.NotFound, "Attachment not found.");
        var stream = await storage.OpenAsync(asset.StorageKey, ct);
        return stream == null ? Fail<LearningMedia>(ServiceFailure.NotFound, "Attachment file unavailable.", "media_missing")
            : ServiceResult<LearningMedia>.Ok(new(stream, "application/octet-stream", SafeFileName(asset.OriginalFileName)));
    }
    public static string SafeFileName(string name) {
        var result = new string(name.Where(c => !char.IsControl(c) && c is not ('/' or '\\' or '"' or ':' )).Take(200).ToArray());
        return string.IsNullOrWhiteSpace(result) ? "attachment" : result;
    }
}
