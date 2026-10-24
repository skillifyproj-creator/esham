namespace esham.DAL.Entities;

public sealed class Course
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string OwnerUserId { get; set; } = string.Empty;
    public Guid? DraftVersionId { get; set; }
    public Guid? PublishedVersionId { get; set; }
    public string SafetyStatus { get; set; } = CourseSafetyStatuses.Active;
    public bool EnrollmentPaused { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public byte[] RowVersion { get; set; } = [];

    public ApplicationUser OwnerUser { get; set; } = null!;
    public ICollection<CourseVersion> CourseVersions { get; set; } = new List<CourseVersion>();
    public CourseVersion? DraftVersion { get; set; }
    public CourseVersion? PublishedVersion { get; set; }
}
