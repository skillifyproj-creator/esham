namespace esham.BLL.DTOs;

public enum ServiceFailure { None, Validation, NotFound, Forbidden, Conflict, Unauthenticated }
public sealed record ServiceResult<T>(T? Value, ServiceFailure Failure = ServiceFailure.None, string? Message = null)
{
    public static ServiceResult<T> Ok(T value) => new(value);
    public static ServiceResult<T> Fail(ServiceFailure failure, string message) => new(default, failure, message);
}
public sealed record CourseActor(string UserId, bool IsInstructor, bool IsGeneralAdmin);
