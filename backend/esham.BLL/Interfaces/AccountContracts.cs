namespace esham.BLL.Interfaces;

public sealed record RegisterAccountCommand(string? Name, string? Email, string? Password);

public sealed record LoginAccountCommand(string? Email, string? Password);

public sealed record UpdateProfileCommand(
    string? Name,
    string? NameEn,
    string? Username,
    string? Role,
    string? Avatar,
    string? Bio,
    IReadOnlyList<int>? Interests,
    IReadOnlyList<int>? TeachingAreas,
    IReadOnlyList<string>? CustomSkills,
    int? Goal);

public sealed record AccountProfile(
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

public enum AccountFailure
{
    None,
    Validation,
    EmailAlreadyExists,
    InvalidCredentials,
    LockedOut,
    OnboardingRequired,
    Unauthenticated,
    UsernameAlreadyExists,
}

public sealed record AccountResult(
    AccountProfile? Profile,
    AccountFailure Failure = AccountFailure.None,
    bool OnboardingRequired = false,
    IReadOnlyList<string>? Errors = null);