using System.Text.Json.Serialization;
namespace esham.BLL.DTOs.Submissions;
public sealed record TaskText(string? Ar, string? En);
public sealed record TaskFile(Guid Id, string Name, long SizeBytes, string ContentUrl);
public sealed record LearnerTask(Guid Id, Guid LogicalTaskId, Guid CourseVersionId, string? TitleAr, string? TitleEn,
    string? DescriptionAr, string? DescriptionEn, TaskText? Instructions, List<TaskText> Requirements, int SortOrder,
    bool IsApproved, bool IsOptional, List<TaskFile> Attachments);
public sealed record LearnerTaskPage(string AccountId, Guid EnrollmentId, Guid AvailableCourseVersionId, bool MutationsEnabled, List<LearnerTask> Items);
public sealed record AttemptReview(Guid Id, string Decision, string? Feedback, DateTimeOffset ReviewedAt);
public sealed record SubmissionDetail(string AccountId, Guid EnrollmentId, Guid Id, Guid CourseTaskId, Guid CourseVersionId,
    int AttemptNumber, bool? IsOptionalAtCreation, string Status, string? AnswerText, string? WorkUrl,
    DateTimeOffset CreatedAt, DateTimeOffset? SubmittedAt, string DraftToken, bool CanEdit,
    LearnerTask Task, List<TaskFile> Attachments, List<AttemptReview> Reviews);
public sealed record SubmissionPage(string AccountId, Guid EnrollmentId, int Page, int PageSize, int TotalCount, List<SubmissionDetail> Items);
[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record CreateAttempt(Guid RequestId, Guid ExpectedCourseVersionId);
[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record SaveDraft(Guid ExpectedTaskVersionId, string? ExpectedDraftToken, string? AnswerText, string? WorkUrl);
[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record FinalizeAttempt(Guid ExpectedTaskVersionId, string? ExpectedDraftToken);
[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record AttachmentMutation(Guid ExpectedTaskVersionId, string? ExpectedDraftToken);
public sealed record SubmissionFileInput(Guid UploadId, Guid ExpectedTaskVersionId, string? ExpectedDraftToken, string FileName, string ContentType, Stream Content);
public sealed record PreparedSubmissionFile(string Key, string Hash, long Size, string ContentType, string Name);
