using esham.BLL.DTOs.Courses;
namespace esham.BLL.DTOs.Learning;

public sealed record LearningAttachment(Guid Id, string DisplayName, string ContentType, string ContentUrl);
public sealed record LearningLesson(Guid Id, Guid LogicalLessonId, string? TitleAr, string? TitleEn,
    string ContentType, int SortOrder, bool IsCompleted, bool IsInherited, bool IsOptional);
public sealed record LearningSection(Guid Id, string? TitleAr, string? TitleEn, int SortOrder, List<LearningLesson> Lessons);
public sealed record LearningCourse(string AccountId, Guid EnrollmentId, Guid CourseId, Guid OriginalCourseVersionId,
    Guid AvailableCourseVersionId, string? TitleAr, string? TitleEn, bool ProgressWritesEnabled,
    Guid? ResumeLessonId, int LessonCoveragePercentage, EnrollmentVersionState VersionState, List<LearningSection> Sections);
public sealed record LessonContent(string AccountId, Guid EnrollmentId, Guid CourseVersionId, Guid LessonId,
    string? TitleAr, string? TitleEn, string? DescriptionAr, string? DescriptionEn, string ContentType,
    double? VideoDurationSeconds, string? VideoUrl, List<LearningAttachment> Attachments, ProgressState Progress);
public sealed record ProgressState(string AccountId, Guid EnrollmentId, Guid CourseVersionId, Guid LessonId,
    bool IsCompleted, DateTimeOffset? CompletedAt, double LastPositionSeconds, double? ResumePositionSeconds,
    string ProgressToken, DateTimeOffset? UpdatedAt);
public sealed record ProgressWrite(Guid ExpectedCourseVersionId, string? ExpectedProgressToken, double LastPositionSeconds = 0);
public sealed record CompleteLesson(Guid ExpectedCourseVersionId);
public sealed record LearningMedia(Stream Stream, string ContentType, string? DownloadName);
