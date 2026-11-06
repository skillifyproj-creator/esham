namespace esham.DAL.Entities;

// Append-only availability receipt. Enrollment.CourseVersionId remains the original version.
public sealed class EnrollmentVersionAccess
{
    public Guid Id { get; init; }
    public Guid EnrollmentId { get; init; }
    public Guid CourseId { get; init; }
    public Guid CourseVersionId { get; init; }
    public Guid? PreviousCourseVersionId { get; init; }
    public DateTimeOffset GrantedAt { get; init; } = DateTimeOffset.UtcNow;
    public string Reason { get; init; } = "publication";
    public bool WasCourseCompleted { get; init; }
    public Enrollment Enrollment { get; set; } = null!;
    public CourseVersion CourseVersion { get; set; } = null!;
    public CourseVersion? PreviousCourseVersion { get; set; }
}
