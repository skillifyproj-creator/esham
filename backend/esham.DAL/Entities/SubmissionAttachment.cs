namespace esham.DAL.Entities;

public sealed class SubmissionAttachment
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TaskSubmissionId { get; set; }
    public Guid MediaAssetId { get; set; }
    public TaskSubmission TaskSubmission { get; set; } = null!;
    public MediaAsset MediaAsset { get; set; } = null!;
}
