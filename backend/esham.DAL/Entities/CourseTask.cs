namespace esham.DAL.Entities;

public sealed class CourseTask
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid CourseVersionId { get; set; }
    // Placement only; the composite FK enforces the same version.
    public Guid? DisplaySectionId { get; set; }
    public string? TitleAr { get; set; }
    public string? TitleEn { get; set; }
    public string? DescriptionAr { get; set; }
    public string? DescriptionEn { get; set; }
    public LocalizedText? Instructions { get; set; }
    public List<LocalizedText>? Requirements { get; set; }
    public int SortOrder { get; set; }
    public bool IsReady { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public CourseVersion CourseVersion { get; set; } = null!;
    public CourseSection? DisplaySection { get; set; }
    public ICollection<TaskAttachment> Attachments { get; set; } = new List<TaskAttachment>();
}
