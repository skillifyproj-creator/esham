namespace esham.DAL.Entities;

public sealed class CourseReview
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid EnrollmentId { get; set; }
    public int Rating { get; set; }
    public string? Comment { get; set; }
    public string? InstructorReply { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? RepliedAt { get; set; }
    public Enrollment Enrollment { get; set; } = null!;
}
