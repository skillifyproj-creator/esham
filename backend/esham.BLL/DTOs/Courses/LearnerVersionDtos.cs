namespace esham.BLL.DTOs.Courses;
public sealed record AchievementSource(Guid RecordId, Guid ContentId, Guid CourseVersionId, DateTimeOffset? EarnedAt);
public sealed record LearnerLessonVersionState(Guid LessonId, Guid LogicalLessonId, Guid CourseSectionId,
    string? TitleAr, string? TitleEn, bool IsNewToEnrollment, bool IsUpdated, bool IsCompleted, bool IsInherited,
    bool IsOptional, bool RevisitAllowedByPolicy, double CurrentLastPositionSeconds, double? PreviousLastPositionSeconds, double? ResumePositionSeconds,
    AchievementSource? CompletionSource);
public sealed record LearnerTaskVersionState(Guid TaskId, Guid LogicalTaskId, string? TitleAr, string? TitleEn,
    bool IsNewToEnrollment, bool IsUpdated, bool IsApproved, bool IsInherited, bool IsOptional,
    bool OptionalResubmissionAllowedByPolicy, AchievementSource? ApprovalSource);
public sealed record EnrollmentVersionState(Guid EnrollmentId, Guid CourseId, Guid OriginalCourseVersionId,
    Guid AvailableCourseVersionId, int AvailableVersionNumber, string EnrollmentStatus,
    bool IsCourseCompleted, DateTimeOffset? CompletedAt, Guid? CertificateId, Guid? CertificateCourseVersionId,
    int CurrentItemCount, int RequiredItemCount, int EarnedItemCount, int ProgressPercentage, int CurrentCoveragePercentage, bool MeetsCurrentRequirements,
    bool LearnerContentApiAvailable, bool LearnerSubmissionApiAvailable, List<LearnerLessonVersionState> Lessons, List<LearnerTaskVersionState> Tasks);
