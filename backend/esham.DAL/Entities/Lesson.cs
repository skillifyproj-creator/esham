namespace esham.DAL.Entities;

public sealed class Lesson
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid CourseSectionId { get; set; }
    public string? TitleAr { get; set; }
    public string? TitleEn { get; set; }
    public string? DescriptionAr { get; set; }
    public string? DescriptionEn { get; set; }
    public List<LocalizedText>? Objectives { get; set; }
    public string ContentType { get; set; } = "video";
    public double? DurationSeconds { get; set; }
    public int SortOrder { get; set; }
    public bool IsPreview { get; set; }
    public Guid? PrimaryVideoMediaAssetId { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public CourseSection CourseSection { get; set; } = null!;
    public MediaAsset? PrimaryVideoMediaAsset { get; set; }
    public ICollection<LessonAttachment> Attachments { get; set; } = new List<LessonAttachment>();
}
