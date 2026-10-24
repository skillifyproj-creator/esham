namespace esham.DAL.Entities;

public sealed class CourseReviewDecision
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid CourseVersionId { get; init; }
    public string ReviewerUserId { get; init; } = string.Empty;
    public string Decision { get; init; } = string.Empty;
    public string? Comment { get; init; }
    public DateTimeOffset ReviewedAt { get; init; } = DateTimeOffset.UtcNow;
    public CourseVersion CourseVersion { get; set; } = null!;
    public ApplicationUser ReviewerUser { get; set; } = null!;
}
