namespace esham.DAL.Entities;

public sealed class Certificate
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid EnrollmentId { get; set; }
    public string VerificationCode { get; set; } = string.Empty;
    public string LearnerNameSnapshot { get; set; } = string.Empty;
    public string? CourseTitleSnapshotAr { get; set; }
    public string? CourseTitleSnapshotEn { get; set; }
    public string InstructorNameSnapshot { get; set; } = string.Empty;
    public DateTimeOffset IssuedAt { get; set; } = DateTimeOffset.UtcNow;
    public string Status { get; set; } = "issued";
    public Enrollment Enrollment { get; set; } = null!;
}
