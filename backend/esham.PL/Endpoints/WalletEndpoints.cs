using esham.BLL.Interfaces;
namespace esham.PL.Endpoints;

public static class WalletEndpoints
{
    public static IEndpointRouteBuilder MapWalletEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/me/wallet").RequireAuthorization().AddEndpointFilter<FinancialResponseFilter>().WithTags("Wallet");
        group.MapGet("", async (HttpContext c, IWalletService s, CancellationToken ct) => (await s.SummaryAsync(c.User, ct)).ToHttp());
        group.MapGet("/transactions", async (HttpContext c, IWalletService s, int? page, int? pageSize, string? type, CancellationToken ct) =>
            (await s.HistoryAsync(c.User, page ?? 1, pageSize ?? 20, type, ct)).ToHttp());
        group.MapGet("/teaching-summary", async (HttpContext c, IWalletService s, int? page, int? pageSize, CancellationToken ct) =>
            (await s.TeachingAsync(c.User, page ?? 1, pageSize ?? 20, ct)).ToHttp());
        return endpoints;
    }
}

public sealed class FinancialResponseFilter : IEndpointFilter
{
    public ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        context.HttpContext.Response.Headers.CacheControl = "private, no-store";
        context.HttpContext.Response.Headers["X-Content-Type-Options"] = "nosniff";
        return next(context);
    }
}
