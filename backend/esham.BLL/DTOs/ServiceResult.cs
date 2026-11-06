namespace esham.BLL.DTOs;

public enum ServiceFailure { None, Validation, NotFound, Forbidden, Conflict, Unauthenticated }
public sealed record ServiceResult<T>(T? Value, ServiceFailure Failure = ServiceFailure.None, string? Message = null, string? Code = null)
{
    public static ServiceResult<T> Ok(T value) => new(value);
    public static ServiceResult<T> Fail(ServiceFailure failure, string message, string? code = null) => new(default, failure, message, code);
}
public sealed record CourseActor(string UserId, bool IsInstructor, bool IsGeneralAdmin, bool IsCategoryAdmin = false);
