namespace esham.PL.DTOs;

public sealed record AccountProfileResponse(
    string Id,
    string? Name,
    string? NameEn,
    string? Email,
    string? Username,
    string? Role,
    string? Avatar,
    string? Bio,
    IReadOnlyList<int> Interests,
    IReadOnlyList<int> TeachingAreas,
    IReadOnlyList<string> CustomSkills,
    int? Goal)
{
    public IReadOnlyList<Guid> LearningCategoryIds { get; init; } = [];
    public IReadOnlyList<Guid> TeachingCategoryIds { get; init; } = [];
    public IReadOnlyList<string> Roles { get; init; } = [];
}

public sealed record AccountSessionResponse(
    AccountProfileResponse Profile,
    bool OnboardingRequired);
