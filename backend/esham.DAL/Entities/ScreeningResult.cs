namespace esham.DAL.Entities;

public sealed class ScreeningResult
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid MediaAssetId { get; set; }
    public string ContentHash { get; set; } = string.Empty;
    public string ModelName { get; set; } = string.Empty;
    public string ModelVersion { get; set; } = string.Empty;
    public string PolicyVersion { get; set; } = string.Empty;
    public string Status { get; set; } = "pending";
    public List<ScreeningFinding> Findings { get; set; } = [];
    public int SampleCount { get; set; }
    public bool IsTrustedServerResult { get; set; }
    public DateTimeOffset? StartedAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }

    public MediaAsset MediaAsset { get; set; } = null!;
}
