namespace esham.BLL.DTOs.Reviews;
public sealed record ReviewWrite(Guid RequestId,string? ExpectedVersion,Guid ExpectedCourseVersionId,int Rating,string? Comment);
public sealed record ReplyWrite(Guid RequestId,string? ExpectedVersion,string? Reply);
public sealed record ReviewRemove(Guid RequestId,string? ExpectedVersion,string? Reason=null);
public sealed record LearnerReviewDto(Guid Id,Guid EnrollmentId,Guid CourseId,Guid? CourseVersionId,int Rating,string? Comment,string? InstructorReply,DateTimeOffset CreatedAt,DateTimeOffset UpdatedAt,DateTimeOffset? RepliedAt,string Version,string? TitleAr=null,string? TitleEn=null);
public sealed record ReviewRead(string AccountId,Guid EnrollmentId,bool Eligible,string? ReasonCode,bool MutationsEnabled,LearnerReviewDto? Review,Guid PurchasedCourseVersionId);
public sealed record ReviewMutation(string AccountId,LearnerReviewDto? Review,bool Replayed);
public sealed record ReviewPage(string AccountId,List<LearnerReviewDto> Items,int Page,int PageSize,int TotalCount);
