namespace esham.DAL.Entities;

public sealed class CourseReport
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string ReporterUserId { get; set; } = string.Empty;
    public Guid CourseId { get; set; }
    public Guid CourseVersionId { get; set; }
    public Guid? LessonId { get; set; }
    public Guid? MediaAssetId { get; set; }
    public string Reason { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? ContentLocation { get; set; }
    public string Status { get; set; } = "pending";
    public string? ReviewedByUserId { get; set; }
    public string? Resolution { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? ReviewedAt { get; set; }
    public ApplicationUser ReporterUser { get; set; } = null!;
    public ApplicationUser? ReviewedByUser { get; set; }
    public Course Course { get; set; } = null!;
    public CourseVersion CourseVersion { get; set; } = null!;
    public Lesson? Lesson { get; set; }
    public MediaAsset? MediaAsset { get; set; }
    public ICollection<CourseWarning> Warnings { get; set; } = new List<CourseWarning>();
}
