namespace esham.BLL.DTOs.Courses;
public sealed record VersionActionRequest(Guid ExpectedVersionId);
public sealed record ReviewDecisionRequest(string Decision, string? Comment);
public sealed record ReviewDecisionResponse(Guid Id, string Decision, string? Comment, string ReviewerUserId, DateTimeOffset ReviewedAt);
public sealed record ReviewQueueItem(Guid CourseId, Guid CourseVersionId, int VersionNumber, Guid CategoryId,
    string? TitleAr, string? TitleEn, string CategoryNameAr, string CategoryNameEn, string OwnerName,
    string ReviewStatus, DateTimeOffset? SubmittedAt, Guid? PublishedVersionId);
public sealed record ReviewMediaResponse(Guid Id, Guid? LessonId, Guid? TaskId, string DisplayName, string MimeType, string MediaType, string ContentUrl);
public sealed record CourseReviewSnapshot(Guid CourseId, string OwnerUserId, Guid? PublishedVersionId,
    CourseVersionResponseDto Version, List<SectionResponse> Sections, List<CourseTaskResponse> Tasks,
    SubmissionEligibilityResponse Eligibility, List<ReviewDecisionResponse> Decisions, List<ReviewMediaResponse> Media, bool CanReview);
