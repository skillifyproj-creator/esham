namespace esham.DAL.Entities;

public sealed class Announcement
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string AuthorUserId { get; set; } = string.Empty;
    public string? TitleAr { get; set; }
    public string? TitleEn { get; set; }
    public string? ContentAr { get; set; }
    public string? ContentEn { get; set; }
    public string Audience { get; set; } = "all";
    public string Status { get; set; } = "draft";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? PublishedAt { get; set; }
    public ApplicationUser AuthorUser { get; set; } = null!;
}
