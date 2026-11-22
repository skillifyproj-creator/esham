namespace esham.BLL.DTOs.Completion;
public sealed record CompletionState(string AccountId, Guid EnrollmentId, Guid? EvaluatedCourseVersionId,
    string Status, DateTimeOffset? CompletedAt, bool Eligible, string? ReasonCode,
    int RequiredLessonCount, int EarnedRequiredLessonCount, int RequiredTaskCount, int ApprovedRequiredTaskCount,
    CertificateDetail? Certificate, bool ReconciliationEnabled);
public sealed record CertificateDetail(string AccountId, Guid Id, Guid EnrollmentId, Guid? CourseVersionId,
    string VerificationCode, string LearnerNameSnapshot, string? CourseTitleSnapshotAr,
    string? CourseTitleSnapshotEn, string InstructorNameSnapshot, DateTimeOffset IssuedAt, string Status);
public sealed record CertificatePage(string AccountId, List<CertificateDetail> Items, int Page, int PageSize, int Total);
public sealed record CertificateVerification(string Status, string LearnerName, string? CourseTitleAr,
    string? CourseTitleEn, DateTimeOffset IssuedAt, string Issuer);
public sealed record ReconcileCompletion(Guid ExpectedCourseVersionId);
public sealed record RevokeCertificate(string Reason);
