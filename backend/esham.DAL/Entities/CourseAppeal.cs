namespace esham.DAL.Entities;

public sealed class CourseAppeal
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid CourseId { get; set; }
    public Guid CourseWarningId { get; set; }
    public string InstructorUserId { get; set; } = string.Empty;
    public string Explanation { get; set; } = string.Empty;
    public string Status { get; set; } = "pending";
    public string? ReviewedByUserId { get; set; }
    public string? DecisionComment { get; set; }
    public DateTimeOffset SubmittedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? ReviewedAt { get; set; }
    public Course Course { get; set; } = null!;
    public CourseWarning CourseWarning { get; set; } = null!;
    public ApplicationUser InstructorUser { get; set; } = null!;
    public ApplicationUser? ReviewedByUser { get; set; }
}
