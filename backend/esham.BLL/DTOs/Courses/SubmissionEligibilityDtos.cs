namespace esham.BLL.DTOs.Courses;
public sealed record EligibilityCheck(string Code, bool IsMet);
public sealed record SubmissionEligibilityResponse(Guid CourseVersionId, string ReviewStatus, bool ContentEligible,
    bool SubmissionImplemented, bool CanSubmit, int TaskCount, int ReadyTaskCount, int Percentage, List<EligibilityCheck> Checks);
