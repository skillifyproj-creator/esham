using System.Security.Claims;
using esham.BLL.DTOs;
using esham.BLL.DTOs.Wallets;
namespace esham.BLL.Interfaces;

public interface IWalletService
{
    Task<ServiceResult<WalletSummary>> SummaryAsync(ClaimsPrincipal actor, CancellationToken ct = default);
    Task<ServiceResult<WalletHistory>> HistoryAsync(ClaimsPrincipal actor, int page = 1, int pageSize = 20, string? type = null, CancellationToken ct = default);
    Task<ServiceResult<TeachingSummary>> TeachingAsync(ClaimsPrincipal actor, int page = 1, int pageSize = 20, CancellationToken ct = default);
}
