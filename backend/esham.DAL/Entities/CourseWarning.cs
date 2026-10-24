namespace esham.DAL.Entities;

public sealed class CourseWarning
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid CourseId { get; init; }
    public Guid CourseVersionId { get; init; }
    public Guid? CourseReportId { get; init; }
    public Guid? MediaAssetId { get; init; }
    public string IssuedByUserId { get; init; } = string.Empty;
    public string IncidentKey { get; init; } = string.Empty;
    public int WarningNumber { get; init; }
    public string Reason { get; init; } = string.Empty;
    public string? RequiredCorrection { get; init; }
    public DateTimeOffset? Deadline { get; init; }
    public DateTimeOffset CreatedAt { get; init; } = DateTimeOffset.UtcNow;
    public Course Course { get; set; } = null!;
    public CourseVersion CourseVersion { get; set; } = null!;
    public CourseReport? CourseReport { get; set; }
    public MediaAsset? MediaAsset { get; set; }
    public ApplicationUser IssuedByUser { get; set; } = null!;
    public ICollection<CourseAppeal> Appeals { get; set; } = new List<CourseAppeal>();
}
