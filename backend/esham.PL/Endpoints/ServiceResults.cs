using esham.BLL.DTOs;
namespace esham.PL.Endpoints;

internal static class ServiceResults
{
    internal static IResult ToHttp<T>(this ServiceResult<T> result, string? createdLocation = null) => result.Failure switch
    {
        ServiceFailure.None => createdLocation is null ? Results.Ok(result.Value) : Results.Created(createdLocation, result.Value),
        ServiceFailure.Validation => Results.ValidationProblem(new Dictionary<string, string[]> { ["request"] = [result.Message ?? "Invalid request."] }),
        ServiceFailure.NotFound => Results.Problem(statusCode: 404, title: result.Message),
        ServiceFailure.Forbidden => Results.Problem(statusCode: 403, title: result.Message),
        ServiceFailure.Conflict => Results.Problem(statusCode: 409, title: result.Message),
        _ => Results.Problem(statusCode: 500, title: "Unable to complete the request.")
    };
}
