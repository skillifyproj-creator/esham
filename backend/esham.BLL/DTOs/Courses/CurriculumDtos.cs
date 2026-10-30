using System.Text.Json.Serialization;
namespace esham.BLL.DTOs.Courses;

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record SectionRequest(string? TitleAr, string? TitleEn, int SortOrder);
[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record LessonRequest(string? TitleAr, string? TitleEn, int SortOrder,
    string? DescriptionAr = null, string? DescriptionEn = null, string ContentType = "video",
    double? DurationSeconds = null, bool IsPreview = false, List<ObjectiveDto>? Objectives = null,
    Guid? PrimaryVideoMediaAssetId = null);
[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record ReorderRequest(List<Guid>? Ids);
public sealed record LessonResponse(Guid Id, Guid CourseSectionId, string? TitleAr, string? TitleEn,
    int SortOrder, string? DescriptionAr, string? DescriptionEn, string ContentType,
    double? DurationSeconds, bool IsPreview, List<ObjectiveDto> Objectives, Guid? PrimaryVideoMediaAssetId,
    LessonReadinessResponse Readiness);
public sealed record SectionResponse(Guid Id, Guid CourseVersionId, string? TitleAr, string? TitleEn,
    int SortOrder, List<LessonResponse> Lessons, SectionReadinessResponse Readiness);
public sealed record LessonReadinessResponse(bool TitleComplete, bool ContentReady, bool ObjectivesComplete,
    bool DurationSet, int Percentage, bool IsReady);
public sealed record SectionReadinessResponse(bool TitleComplete, bool HasLessons, bool LessonsReady, int Percentage, bool IsReady);
public sealed record CurriculumReadinessResponse(Guid CourseVersionId, int Percentage, bool IsReady, int CompletedSections, List<SectionResponse> Sections);
[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record LessonReadinessPreviewRequest(Guid? LessonId, LessonRequest Lesson);
