namespace esham.DAL.Entities;

public sealed class PointTransaction
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public string UserId { get; init; } = string.Empty;
    public Guid? EnrollmentId { get; init; }
    public int Amount { get; init; }
    public string TransactionType { get; init; } = string.Empty;
    public string OperationKey { get; init; } = string.Empty;
    public DateTimeOffset CreatedAt { get; init; } = DateTimeOffset.UtcNow;
    public ApplicationUser User { get; set; } = null!;
    public Enrollment? Enrollment { get; set; }
}
