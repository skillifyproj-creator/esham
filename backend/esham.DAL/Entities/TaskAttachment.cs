namespace esham.DAL.Entities;

public sealed class TaskAttachment
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid CourseTaskId { get; set; }
    public Guid MediaAssetId { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    public int SortOrder { get; set; }

    public CourseTask CourseTask { get; set; } = null!;
    public MediaAsset MediaAsset { get; set; } = null!;
}
