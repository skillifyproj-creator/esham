namespace esham.DAL.Entities;

// File content is immutable: trimming/replacement creates a new asset identity.
public sealed class MediaAsset
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string OwnerUserId { get; set; } = string.Empty;
    public Guid? SourceMediaAssetId { get; set; }
    public string StorageKey { get; set; } = string.Empty;
    public string OriginalFileName { get; set; } = string.Empty;
    public string MimeType { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    public string ContentHash { get; set; } = string.Empty;
    public double? DurationSeconds { get; set; }
    public string MediaType { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public ApplicationUser OwnerUser { get; set; } = null!;
    public MediaAsset? SourceMediaAsset { get; set; }
    public ICollection<MediaAsset> DerivedMediaAssets { get; set; } = new List<MediaAsset>();
    public ICollection<CourseVersion> CoverForVersions { get; set; } = new List<CourseVersion>();
    public ICollection<Lesson> PrimaryVideoForLessons { get; set; } = new List<Lesson>();
    public ICollection<LessonAttachment> LessonAttachments { get; set; } = new List<LessonAttachment>();
    public ICollection<TaskAttachment> TaskAttachments { get; set; } = new List<TaskAttachment>();
    public ICollection<ScreeningResult> ScreeningResults { get; set; } = new List<ScreeningResult>();
}
