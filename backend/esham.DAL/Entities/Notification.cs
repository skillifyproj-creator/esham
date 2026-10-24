namespace esham.DAL.Entities;

public sealed class Notification
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string RecipientUserId { get; set; } = string.Empty;
    public string? TitleAr { get; set; }
    public string? TitleEn { get; set; }
    public string? MessageAr { get; set; }
    public string? MessageEn { get; set; }
    public string NotificationType { get; set; } = string.Empty;
    public bool IsRead { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? ReadAt { get; set; }
    public ApplicationUser RecipientUser { get; set; } = null!;
}
