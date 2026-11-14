using System.Text.Json.Serialization;
namespace esham.BLL.DTOs.Enrollments;

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record PurchaseEnrollmentRequest(Guid CourseId, Guid ExpectedPublishedVersionId, Guid RequestId);
public sealed record EnrollmentDto(Guid Id, Guid CourseId, Guid CourseVersionId, Guid? AvailableCourseVersionId,
    string Status, DateTimeOffset EnrolledAt, DateTimeOffset? CompletedAt, DateTimeOffset? LastOpenedAt,
    string? TitleAr, string? TitleEn, string InstructorName, string? InstructorNameEn, bool IsAvailable);
public sealed record EnrollmentPage(string AccountId, IReadOnlyList<EnrollmentDto> Items, int Page, int PageSize, int TotalCount);
public sealed record EnrollmentDetail(string AccountId, EnrollmentDto Enrollment);
public sealed record EnrollmentPurchase(string AccountId, Guid RequestId, bool Replayed, int Charge, EnrollmentDto Enrollment);
public sealed record PurchaseAvailability(string AccountId, bool Enabled, int Cost = 20);
