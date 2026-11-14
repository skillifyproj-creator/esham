namespace esham.BLL.DTOs.Wallets;

public sealed record WalletSummary(string AccountId, int Balance, long Earned, long Spent);
public sealed record WalletEntry(Guid Id, int Amount, string TransactionType, Guid? EnrollmentId, Guid? CourseId,
    string? CourseTitleAr, string? CourseTitleEn, DateTimeOffset CreatedAt);
public sealed record WalletHistory(string AccountId, IReadOnlyList<WalletEntry> Items, int Page, int PageSize, int TotalCount);
public sealed record TeachingTotal(Guid CourseId, long Points);
public sealed record TeachingSummary(string AccountId, IReadOnlyList<TeachingTotal> Items, int Page, int PageSize, int TotalCount, long TotalEarned);
