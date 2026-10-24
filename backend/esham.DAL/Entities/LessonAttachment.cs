namespace esham.DAL.Entities;

public sealed class LessonAttachment
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid LessonId { get; set; }
    public Guid MediaAssetId { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    public int SortOrder { get; set; }

    public Lesson Lesson { get; set; } = null!;
    public MediaAsset MediaAsset { get; set; } = null!;
}
