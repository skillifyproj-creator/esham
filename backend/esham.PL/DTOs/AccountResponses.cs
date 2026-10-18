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
    int? Goal);

public sealed record AccountSessionResponse(
    AccountProfileResponse Profile,
    bool OnboardingRequired);