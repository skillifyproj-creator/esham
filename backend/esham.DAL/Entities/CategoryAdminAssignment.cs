namespace esham.DAL.Entities;

public sealed class CategoryAdminAssignment
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string UserId { get; set; } = string.Empty;
    public Guid CategoryId { get; set; }
    public DateTimeOffset AssignedAt { get; set; } = DateTimeOffset.UtcNow;
    public bool IsActive { get; set; } = true;

    public ApplicationUser User { get; set; } = null!;
    public Category Category { get; set; } = null!;
}
