using System.Text.Json.Serialization;
namespace esham.BLL.DTOs.Courses;

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record CourseTaskRequest(string? TitleAr, string? TitleEn, int SortOrder,
    string? DescriptionAr = null, string? DescriptionEn = null, ObjectiveDto? Instructions = null,
    List<ObjectiveDto>? Requirements = null, Guid? DisplaySectionId = null, bool IsReady = false);
public sealed record CourseTaskResponse(Guid Id, Guid CourseVersionId, Guid? DisplaySectionId,
    string? TitleAr, string? TitleEn, string? DescriptionAr, string? DescriptionEn,
    ObjectiveDto? Instructions, List<ObjectiveDto> Requirements, int SortOrder, bool IsReady);
public sealed record TaskReadinessResponse(int TaskCount, bool MeetsTaskCount, int MinimumTasks = 1, int MaximumTasks = 3);
