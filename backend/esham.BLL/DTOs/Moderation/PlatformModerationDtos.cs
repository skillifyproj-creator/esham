namespace esham.BLL.DTOs.Moderation;

public sealed record AnnouncementInput(string? TitleAr,string? TitleEn,string? ContentAr,string? ContentEn,string Audience,string? ExpectedVersion=null);
public sealed record AnnouncementStateRequest(string Status,string ExpectedVersion);
public sealed record AnnouncementDto(Guid Id,string? TitleAr,string? TitleEn,string? ContentAr,string? ContentEn,string Audience,string Status,DateTimeOffset CreatedAt,DateTimeOffset? PublishedAt,string Version);
public sealed record FileCourseReportRequest(Guid CourseVersionId,string Reason,string Description,string? ContentLocation=null,Guid? LessonId=null,Guid? MediaAssetId=null);
public sealed record ResolveCourseReportRequest(string Status,string? Resolution,string ExpectedStatus);
public sealed record CourseReportDto(Guid Id,Guid CourseId,Guid CourseVersionId,string? TitleAr,string? TitleEn,string Reason,string? Description,string? ContentLocation,Guid? LessonId,Guid? MediaAssetId,string Status,string? Resolution,DateTimeOffset CreatedAt,DateTimeOffset? ReviewedAt);
public sealed record IssueCourseWarningRequest(Guid CourseVersionId,string IncidentKey,string Reason,string RequiredCorrection,DateTimeOffset Deadline,bool Verified,Guid? CourseReportId=null,Guid? MediaAssetId=null);
public sealed record SuspendCourseRequest(Guid CourseVersionId,string Reason,bool Verified);
public sealed record SubmitCourseAppealRequest(Guid CourseWarningId,string Explanation);
public sealed record DecideCourseAppealRequest(string Decision,string Comment);
public sealed record WarningDto(Guid Id,Guid CourseVersionId,Guid? CourseReportId,int WarningNumber,string IncidentKey,string Reason,string? RequiredCorrection,DateTimeOffset? Deadline,DateTimeOffset CreatedAt);
public sealed record AppealDto(Guid Id,Guid CourseWarningId,string Explanation,string Status,string? DecisionComment,DateTimeOffset SubmittedAt,DateTimeOffset? ReviewedAt);
public sealed record CourseSafetyDto(Guid CourseId,string SafetyStatus,bool EnrollmentPaused,List<WarningDto> Warnings,List<AppealDto> Appeals,bool CanModerate,bool CanAppeal,bool CanDecideAppeals,Guid? PublishedVersionId);
public sealed record AdminActivityDto(Guid Id,string ActorUserId,string ActorName,string Action,string TargetType,string? TargetId,string? TargetName,Guid? CourseId,Guid? CourseVersionId,Guid? CategoryId,string? PreviousState,string? NewState,string? Details,DateTimeOffset CreatedAt);

public sealed record CourseSafetyCaseDto(Guid CourseId,Guid CourseVersionId,string? TitleAr,string? TitleEn,string SafetyStatus,int WarningNumber,int PendingAppeals);
