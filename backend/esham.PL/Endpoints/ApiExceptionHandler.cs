using Microsoft.AspNetCore.Diagnostics;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
namespace esham.PL.Endpoints;

public sealed class ApiExceptionHandler(ILogger<ApiExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken cancellationToken)
    {
        if (exception is OperationCanceledException && context.RequestAborted.IsCancellationRequested) return false;
        var status = exception switch
        {
            DbUpdateConcurrencyException => StatusCodes.Status409Conflict,
            DbUpdateException { InnerException: SqlException { Number: 2601 or 2627 or 547 } } => StatusCodes.Status409Conflict,
            SqlException or TimeoutException or RetryLimitExceededException => StatusCodes.Status503ServiceUnavailable,
            BadHttpRequestException => StatusCodes.Status400BadRequest,
            _ => StatusCodes.Status500InternalServerError
        };
        logger.LogError(exception, "API request failed; returning status {StatusCode}.", status);
        var title = status switch
        {
            409 => "The data changed or conflicts with an existing record. Refresh and retry.",
            503 => "The database is temporarily unavailable. Please retry later.",
            400 => "The request could not be read. Check its JSON fields and values.",
            _ => "The request could not be completed."
        };
        await Results.Problem(statusCode: status, title: title).ExecuteAsync(context);
        return true;
    }
}
