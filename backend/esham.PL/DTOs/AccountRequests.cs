namespace esham.PL.DTOs;

public sealed record RegisterAccountRequest(string? Name, string? Email, string? Password);

public sealed record LoginAccountRequest(string? Email, string? Password);

public sealed record UpdateRoleRequest(string? Role);

public sealed record UpdateProfileRequest(
	string? Name,
	string? NameEn,
	string? Username,
	string? Role,
	string? Avatar,
	string? Bio,
	int[]? Interests,
	int[]? TeachingAreas,
	string[]? CustomSkills,
	int? Goal)
{
    public Guid[]? LearningCategoryIds { get; init; }
    public Guid[]? TeachingCategoryIds { get; init; }
}
