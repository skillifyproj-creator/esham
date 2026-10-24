namespace esham.DAL.Entities;

public sealed class TaskSubmissionReview
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid TaskSubmissionId { get; init; }
    public string ReviewerUserId { get; init; } = string.Empty;
    public string Decision { get; init; } = string.Empty;
    public string? Feedback { get; init; }
    public DateTimeOffset ReviewedAt { get; init; } = DateTimeOffset.UtcNow;
    public TaskSubmission TaskSubmission { get; set; } = null!;
    public ApplicationUser ReviewerUser { get; set; } = null!;
}
