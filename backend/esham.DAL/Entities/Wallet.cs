namespace esham.DAL.Entities;

public sealed class Wallet
{
    public string UserId { get; set; } = string.Empty;
    public int Balance { get; set; }
    public byte[] RowVersion { get; set; } = [];
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public ApplicationUser User { get; set; } = null!;
}
