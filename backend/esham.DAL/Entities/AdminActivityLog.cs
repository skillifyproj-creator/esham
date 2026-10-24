namespace esham.DAL.Entities;

public sealed class AdminActivityLog
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public string ActorUserId { get; init; } = string.Empty;
    public string Action { get; init; } = string.Empty;
    public string TargetType { get; init; } = string.Empty;
    // A string accommodates both Identity string IDs and domain GUIDs.
    public string? TargetId { get; init; }
    public string? TargetName { get; init; }
    public Guid? CourseId { get; init; }
    public Guid? CourseVersionId { get; init; }
    public Guid? CategoryId { get; init; }
    public string? PreviousState { get; init; }
    public string? NewState { get; init; }
    public string? Details { get; init; }
    public DateTimeOffset CreatedAt { get; init; } = DateTimeOffset.UtcNow;
    public ApplicationUser ActorUser { get; set; } = null!;
    public Course? Course { get; set; }
    public CourseVersion? CourseVersion { get; set; }
    public Category? Category { get; set; }
}
