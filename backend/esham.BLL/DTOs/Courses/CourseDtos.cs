using System.Text.Json.Serialization;
using esham.BLL.DTOs.Categories;
namespace esham.BLL.DTOs.Courses;

public sealed record ObjectiveDto(string? Ar, string? En);
public sealed record MediaSummaryDto(Guid Id, string OriginalFileName, string MimeType, long SizeBytes,
    double? DurationSeconds, string MediaType);
public sealed record OwnerSummaryDto(string Id, string? Name, string? NameEn);
[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record CreateCourseRequest(Guid CategoryId, string? TitleAr, string? TitleEn,
    string? DescriptionAr, string? DescriptionEn, List<ObjectiveDto>? Objectives,
    string? Language = "ar", string? Level = "beginner", Guid? CoverMediaAssetId = null);

// Setter presence distinguishes an omitted PATCH field from an explicit null.
[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed class UpdateCourseDraftRequest
{
    private readonly HashSet<string> fields = new(StringComparer.Ordinal);
    [JsonIgnore] public IReadOnlySet<string> ProvidedFields => fields;
    private Guid? categoryId; private string? titleAr, titleEn, descriptionAr, descriptionEn, language, level;
    private List<ObjectiveDto>? objectives; private Guid? coverMediaAssetId;
    public Guid? CategoryId { get => categoryId; set { categoryId = value; fields.Add(nameof(CategoryId)); } }
    public string? TitleAr { get => titleAr; set { titleAr = value; fields.Add(nameof(TitleAr)); } }
    public string? TitleEn { get => titleEn; set { titleEn = value; fields.Add(nameof(TitleEn)); } }
    public string? DescriptionAr { get => descriptionAr; set { descriptionAr = value; fields.Add(nameof(DescriptionAr)); } }
    public string? DescriptionEn { get => descriptionEn; set { descriptionEn = value; fields.Add(nameof(DescriptionEn)); } }
    public List<ObjectiveDto>? Objectives { get => objectives; set { objectives = value; fields.Add(nameof(Objectives)); } }
    public string? Language { get => language; set { language = value; fields.Add(nameof(Language)); } }
    public string? Level { get => level; set { level = value; fields.Add(nameof(Level)); } }
    public Guid? CoverMediaAssetId { get => coverMediaAssetId; set { coverMediaAssetId = value; fields.Add(nameof(CoverMediaAssetId)); } }
}
public sealed record CourseVersionResponseDto(Guid Id, int VersionNumber, Guid CategoryId,
    string? TitleAr, string? TitleEn, string? DescriptionAr, string? DescriptionEn,
    List<ObjectiveDto> Objectives, string Language, string Level, Guid? CoverMediaAssetId,
    string ReviewStatus, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt,
    DateTimeOffset? SubmittedAt, DateTimeOffset? ApprovedAt);
public sealed record InstructorCourseSummaryDto(Guid CourseId, Guid? DraftVersionId, Guid? PublishedVersionId,
    string? TitleAr, string? TitleEn, Guid? CategoryId, string? CategoryNameAr, string? CategoryNameEn,
    string? Language, string? Level, string? ReviewStatus, string SafetyStatus, bool EnrollmentPaused,
    DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt);
public sealed record CourseDetailResponseDto(Guid CourseId, OwnerSummaryDto Owner, Guid? DraftVersionId,
    Guid? PublishedVersionId, CourseVersionResponseDto? Draft, CourseVersionResponseDto? Published,
    string SafetyStatus, bool EnrollmentPaused, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt,
    string RowVersion);
public sealed record PublicCourseResponseDto(Guid CourseId, Guid PublishedVersionId,
    string? TitleAr, string? TitleEn, string? DescriptionAr, string? DescriptionEn,
    Guid CategoryId, string CategoryNameAr, string CategoryNameEn, string Language, string Level,
    MediaSummaryDto? CoverMedia, OwnerSummaryDto Instructor, DateTimeOffset CreatedAt,
    DateTimeOffset? ApprovedAt, List<ObjectiveDto>? Objectives = null);
