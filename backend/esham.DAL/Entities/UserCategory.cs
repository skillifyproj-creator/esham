namespace esham.DAL.Entities;

public sealed class UserCategory
{
    public string UserId { get; set; } = string.Empty;
    public Guid CategoryId { get; set; }
    public string Kind { get; set; } = "learning";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public ApplicationUser User { get; set; } = null!;
    public Category Category { get; set; } = null!;
}
