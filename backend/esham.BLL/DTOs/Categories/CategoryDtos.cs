using System.Text.Json.Serialization;
namespace esham.BLL.DTOs.Categories;

public sealed record CategoryResponseDto(Guid Id, string NameAr, string NameEn, string? DescriptionAr,
    string? DescriptionEn, Guid? ParentCategoryId, int DisplayOrder, bool IsActive,
    DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt);
[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record CreateCategoryRequest(string? NameAr, string? NameEn, string? DescriptionAr,
    string? DescriptionEn, Guid? ParentCategoryId, int DisplayOrder);
[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record UpdateCategoryRequest(string? NameAr, string? NameEn, string? DescriptionAr,
    string? DescriptionEn, Guid? ParentCategoryId, int DisplayOrder);
[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record ChangeCategoryStatusRequest([property: JsonRequired] bool IsActive);
