using System.Security.Claims;
using esham.BLL.DTOs;
using esham.BLL.DTOs.Learning;
using esham.BLL.DTOs.Submissions;
namespace esham.BLL.Interfaces;
public interface ISubmissionMutationGate { Task<bool> IsEnabledAsync(CancellationToken ct = default); }
public interface ISubmissionAttachmentWriter
{
    Task<PreparedSubmissionFile> PrepareAsync(Stream content, string name, string contentType, CancellationToken ct);
    Task CompleteAsync(string key, CancellationToken ct);
    Task ReconcileAsync(string key, CancellationToken ct);
    Task<int> ReconcilePendingAsync(CancellationToken ct);
}
public interface ILearnerSubmissionService
{
    Task<ServiceResult<LearnerTaskPage>> TasksAsync(ClaimsPrincipal actor, Guid enrollmentId, CancellationToken ct = default);
    Task<ServiceResult<LearnerTask>> TaskAsync(ClaimsPrincipal actor, Guid enrollmentId, Guid taskId, CancellationToken ct = default);
    Task<ServiceResult<SubmissionPage>> HistoryAsync(ClaimsPrincipal actor, Guid enrollmentId, Guid? taskId, int page, CancellationToken ct = default);
    Task<ServiceResult<SubmissionDetail>> DetailAsync(ClaimsPrincipal actor, Guid enrollmentId, Guid submissionId, CancellationToken ct = default);
    Task<ServiceResult<SubmissionDetail>> CreateAsync(ClaimsPrincipal actor, Guid enrollmentId, Guid taskId, CreateAttempt request, CancellationToken ct = default);
    Task<ServiceResult<SubmissionDetail>> SaveAsync(ClaimsPrincipal actor, Guid enrollmentId, Guid submissionId, SaveDraft request, CancellationToken ct = default);
    Task<ServiceResult<SubmissionDetail>> SubmitAsync(ClaimsPrincipal actor, Guid enrollmentId, Guid submissionId, FinalizeAttempt request, CancellationToken ct = default);
    Task<ServiceResult<SubmissionDetail>> UploadAsync(ClaimsPrincipal actor, Guid enrollmentId, Guid submissionId, SubmissionFileInput request, CancellationToken ct = default);
    Task<ServiceResult<SubmissionDetail>> RemoveAsync(ClaimsPrincipal actor, Guid enrollmentId, Guid submissionId, Guid attachmentId, AttachmentMutation request, CancellationToken ct = default);
    Task<ServiceResult<LearningMedia>> FileAsync(ClaimsPrincipal actor, Guid enrollmentId, Guid resourceId, Guid attachmentId, bool taskResource, CancellationToken ct = default);
}
