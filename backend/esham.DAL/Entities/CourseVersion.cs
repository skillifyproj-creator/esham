namespace esham.DAL.Entities;

public sealed class CourseVersion
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid CourseId { get; set; }
    public Guid CategoryId { get; set; }
    public int VersionNumber { get; set; }
    public string? TitleAr { get; set; }
    public string? TitleEn { get; set; }
    public string? DescriptionAr { get; set; }
    public string? DescriptionEn { get; set; }
    public List<LocalizedText> Objectives { get; set; } = [];
    public string Language { get; set; } = "ar";
    public string Level { get; set; } = "beginner";
    public Guid? CoverMediaAssetId { get; set; }
    public string ReviewStatus { get; set; } = CourseReviewStatuses.Draft;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? SubmittedAt { get; set; }
    public DateTimeOffset? ApprovedAt { get; set; }

    public Course Course { get; set; } = null!;
    public Category Category { get; set; } = null!;
    public MediaAsset? CoverMediaAsset { get; set; }
    public ICollection<CourseSection> Sections { get; set; } = new List<CourseSection>();
    public ICollection<CourseTask> Tasks { get; set; } = new List<CourseTask>();
}
