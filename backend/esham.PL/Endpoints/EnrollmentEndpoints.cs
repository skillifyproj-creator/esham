using System.Security.Claims;
using esham.BLL.DTOs;
using esham.BLL.DTOs.Enrollments;
using esham.BLL.Interfaces;
namespace esham.PL.Endpoints;

public static class EnrollmentEndpoints
{
    public static IEndpointRouteBuilder MapEnrollmentEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/me/enrollments").RequireAuthorization().AddEndpointFilter<FinancialResponseFilter>().WithTags("Learner enrollment");
        group.MapGet("", async (HttpContext c, IEnrollmentService s, int? page, int? pageSize, CancellationToken ct) =>
            (await s.ListAsync(c.User, page ?? 1, pageSize ?? 20, ct)).ToHttp());
        group.MapGet("/purchase-availability", async (HttpContext c, IEnrollmentService s, CancellationToken ct) => (await s.AvailabilityAsync(c.User, ct)).ToHttp());
        group.MapGet("/{id:guid}", async (Guid id, HttpContext c, IEnrollmentService s, CancellationToken ct) => (await s.GetAsync(c.User, id, ct)).ToHttp());
        group.MapPost("", async (PurchaseEnrollmentRequest request, HttpContext c, IEnrollmentService s, CancellationToken ct) =>
        {
            var result = await s.PurchaseAsync(c.User, request, ct);
            return result.Failure == ServiceFailure.None && result.Value is { Replayed: false } value
                ? Results.Created($"/me/enrollments/{value.Enrollment.Id:D}", value) : result.ToHttp();
        }).AddEndpointFilter<AdminMutationFilter>().AddEndpointFilter<EnrollmentAccountFilter>();
        return endpoints;
    }
}

public sealed class EnrollmentAccountFilter : IEndpointFilter
{
    public ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext c, EndpointFilterDelegate next)
    {
        var actual = c.HttpContext.User.FindFirstValue(ClaimTypes.NameIdentifier);
        return !string.IsNullOrEmpty(actual) && c.HttpContext.Request.Headers["X-Esham-Account-Id"].ToString() == actual
            ? next(c) : ValueTask.FromResult<object?>(Results.Problem(statusCode: 409, title: "The account session changed. Refresh before enrolling.",
                extensions: new Dictionary<string, object?> { ["code"] = "account_changed" }));
    }
}
