using esham.BLL.DTOs;
namespace esham.PL.Endpoints;

internal static class ServiceResults
{
    internal static IResult ToHttp<T>(this ServiceResult<T> result, string? createdLocation = null) => result.Failure switch
    {
        ServiceFailure.None => createdLocation is null ? Results.Ok(result.Value) : Results.Created(createdLocation, result.Value),
        ServiceFailure.Validation => Results.ValidationProblem(new Dictionary<string, string[]> { ["request"] = [result.Message ?? "Invalid request."] },
            extensions: result.Code == null ? null : new Dictionary<string, object?> { ["code"] = result.Code }),
        ServiceFailure.NotFound => Results.Problem(statusCode: 404, title: result.Message, extensions: Extensions(result.Code)),
        ServiceFailure.Forbidden => Results.Problem(statusCode: 403, title: result.Message, extensions: Extensions(result.Code)),
        ServiceFailure.Unauthenticated => Results.Unauthorized(),
        ServiceFailure.Conflict => Results.Problem(statusCode: 409, title: result.Message, extensions: Extensions(result.Code)),
        _ => Results.Problem(statusCode: 500, title: "Unable to complete the request.")
    };
    private static Dictionary<string, object?>? Extensions(string? code) => code is null ? null : new() { ["code"] = code };
}
