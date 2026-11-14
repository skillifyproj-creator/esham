using System.Security.Claims;
using esham.BLL.DTOs;
using esham.BLL.DTOs.Wallets;
using esham.BLL.Interfaces;
using esham.DAL.Data;
using esham.DAL.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
namespace esham.BLL.Services;

public sealed class WalletService(AppDbContext db, UserManager<ApplicationUser> users) : IWalletService
{
    private static ServiceResult<T> Fail<T>(ServiceFailure f, string message, string? code = null) => ServiceResult<T>.Fail(f, message, code);
    public async Task<ServiceResult<WalletSummary>> SummaryAsync(ClaimsPrincipal actor, CancellationToken ct = default)
    {
        var (user, failure) = await FinancialAccess.Check(users, actor, "Learner", "Instructor");
        if (user is null) return Fail<WalletSummary>(failure, "A current learning or teaching account is required.");
        var wallet = await db.Wallets.AsNoTracking().SingleOrDefaultAsync(x => x.UserId == user.Id, ct);
        if (wallet is null) return Fail<WalletSummary>(ServiceFailure.Conflict, "The account wallet requires coordinated initialization.", "wallet_unavailable");
        var entries = db.PointTransactions.AsNoTracking().Where(x => x.UserId == user.Id);
        var earned = await entries.Where(x => x.TransactionType == "teaching").SumAsync(x => (long?)x.Amount, ct) ?? 0;
        var spent = -(await entries.Where(x => x.TransactionType == "enrollment").SumAsync(x => (long?)x.Amount, ct) ?? 0);
        return ServiceResult<WalletSummary>.Ok(new(user.Id, wallet.Balance, earned, spent));
    }
    public async Task<ServiceResult<WalletHistory>> HistoryAsync(ClaimsPrincipal actor, int page = 1, int pageSize = 20, string? type = null, CancellationToken ct = default)
    {
        var (user, failure) = await FinancialAccess.Check(users, actor, "Learner", "Instructor");
        if (user is null) return Fail<WalletHistory>(failure, "A current learning or teaching account is required.");
        if (!FinancialAccess.ValidPage(page, pageSize) || type is not (null or "welcome" or "enrollment" or "teaching"))
            return Fail<WalletHistory>(ServiceFailure.Validation, "Invalid history pagination or type.");
        var q = db.PointTransactions.AsNoTracking().Where(x => x.UserId == user.Id && (type == null || x.TransactionType == type));
        var count = await q.CountAsync(ct);
        var items = await q.OrderByDescending(x => x.CreatedAt).ThenByDescending(x => x.Id).Skip((page - 1) * pageSize).Take(pageSize)
            .Select(x => new WalletEntry(x.Id, x.Amount, x.TransactionType, x.EnrollmentId, x.Enrollment == null ? null : x.Enrollment.CourseId,
                x.Enrollment == null ? null : x.Enrollment.CourseVersion.TitleAr, x.Enrollment == null ? null : x.Enrollment.CourseVersion.TitleEn, x.CreatedAt)).ToListAsync(ct);
        return ServiceResult<WalletHistory>.Ok(new(user.Id, items, page, pageSize, count));
    }
    public async Task<ServiceResult<TeachingSummary>> TeachingAsync(ClaimsPrincipal actor, int page = 1, int pageSize = 20, CancellationToken ct = default)
    {
        var (user, failure) = await FinancialAccess.Check(users, actor, "Instructor");
        if (user is null) return Fail<TeachingSummary>(failure, "Instructor membership is required.");
        if (!FinancialAccess.ValidPage(page, pageSize)) return Fail<TeachingSummary>(ServiceFailure.Validation, "Invalid pagination.");
        var q = db.PointTransactions.AsNoTracking().Where(x => x.UserId == user.Id && x.TransactionType == "teaching" && x.Enrollment != null && x.Enrollment.Course.OwnerUserId == user.Id);
        var grouped = q.GroupBy(x => x.Enrollment!.CourseId).Select(g => new { CourseId = g.Key, Points = g.Sum(x => (long)x.Amount) });
        return ServiceResult<TeachingSummary>.Ok(new(user.Id, await grouped.OrderBy(x => x.CourseId).Skip((page - 1) * pageSize).Take(pageSize).Select(x => new TeachingTotal(x.CourseId, x.Points)).ToListAsync(ct), page, pageSize,
            await grouped.CountAsync(ct), await q.SumAsync(x => (long?)x.Amount, ct) ?? 0));
    }
}
