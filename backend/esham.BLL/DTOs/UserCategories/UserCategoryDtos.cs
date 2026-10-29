using System.Text.Json.Serialization;

namespace esham.BLL.DTOs.UserCategories;

public sealed record UserCategoriesResponseDto(
    IReadOnlyList<Guid> LearningCategoryIds,
    IReadOnlyList<Guid> TeachingCategoryIds);

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record ReplaceUserCategoriesRequest([property: JsonRequired] Guid[]? CategoryIds);
