using System.ComponentModel.DataAnnotations;
using esham.BLL.Interfaces;
using esham.DAL.Entities;
using Microsoft.AspNetCore.Identity;

namespace esham.BLL.Services;

public sealed class AccountService : IAccountService
{
    private static readonly HashSet<string> SupportedRoles = ["learner", "instructor", "both"];
    private const string AvatarPrefix = "data:image/jpeg;base64,";
    private const int MaximumAvatarLength = 7 * 1024 * 1024;

    private readonly UserManager<ApplicationUser> _userManager;
    private readonly SignInManager<ApplicationUser> _signInManager;

    public AccountService(
        UserManager<ApplicationUser> userManager,
        SignInManager<ApplicationUser> signInManager)
    {
        _userManager = userManager;
        _signInManager = signInManager;
    }

    public async Task<AccountResult> RegisterAsync(RegisterAccountCommand command)
    {
        var name = command.Name?.Trim();
        var email = command.Email?.Trim();
        var password = command.Password;
        var errors = new List<string>();

        if (string.IsNullOrWhiteSpace(name) || name.Length is < 2 or > 80)
        {
            errors.Add("Name must contain between 2 and 80 characters.");
        }

        if (string.IsNullOrWhiteSpace(email)
            || email.Length > 256
            || !new EmailAddressAttribute().IsValid(email))
        {
            errors.Add("A valid email address is required.");
        }

        if (string.IsNullOrEmpty(password)
            || password.Length < 8
            || !password.Any(char.IsLetter)
            || !password.Any(char.IsDigit))
        {
            errors.Add("Password must contain at least 8 characters, a letter, and a number.");
        }

        if (errors.Count > 0)
        {
            return new AccountResult(null, AccountFailure.Validation, Errors: errors);
        }

        if (await _userManager.FindByEmailAsync(email!) is not null)
        {
            return new AccountResult(null, AccountFailure.EmailAlreadyExists);
        }

        var user = new ApplicationUser
        {
            UserName = email,
            Email = email,
            Name = name,
        };

        var creationResult = await _userManager.CreateAsync(user, password!);
        if (!creationResult.Succeeded)
        {
            var identityErrors = creationResult.Errors.ToArray();
            if (identityErrors.Any(error => error.Code is "DuplicateEmail" or "DuplicateUserName"))
            {
                return new AccountResult(null, AccountFailure.EmailAlreadyExists);
            }

            return new AccountResult(
                null,
                AccountFailure.Validation,
                Errors: identityErrors.Select(error => error.Description).ToArray());
        }

        await _signInManager.SignInAsync(user, isPersistent: false);
        return new AccountResult(ToProfile(user), OnboardingRequired: true);
    }

    public async Task<AccountResult> LoginAsync(LoginAccountCommand command)
    {
        var email = command.Email?.Trim();
        var password = command.Password;
        if (string.IsNullOrWhiteSpace(email)
            || email.Length > 256
            || !new EmailAddressAttribute().IsValid(email)
            || string.IsNullOrEmpty(password))
        {
            return new AccountResult(null, AccountFailure.Validation);
        }

        var user = await _userManager.FindByEmailAsync(email);
        if (user is null)
        {
            return new AccountResult(null, AccountFailure.InvalidCredentials);
        }

        var signInResult = await _signInManager.CheckPasswordSignInAsync(
            user,
            password,
            lockoutOnFailure: true);

        if (signInResult.IsLockedOut)
        {
            return new AccountResult(null, AccountFailure.LockedOut);
        }

        if (!signInResult.Succeeded)
        {
            return new AccountResult(null, AccountFailure.InvalidCredentials);
        }

        var identityRoles = await _userManager.GetRolesAsync(user);
        var isAdministrator = identityRoles.Any(role =>
            role is "GeneralAdmin" or "CategoryAdmin");
        if (!isAdministrator && (user.Role is null || !SupportedRoles.Contains(user.Role)))
        {
            return new AccountResult(null, AccountFailure.OnboardingRequired);
        }

        await _signInManager.SignInAsync(user, isPersistent: false);
        return new AccountResult(ToProfile(user));
    }

    public Task SignOutAsync() => _signInManager.SignOutAsync();

    public async Task<AccountResult> GetCurrentSessionAsync(System.Security.Claims.ClaimsPrincipal principal)
    {
        var user = await _userManager.GetUserAsync(principal);
        if (user is null)
        {
            return new AccountResult(null, AccountFailure.Unauthenticated);
        }

        return new AccountResult(
            ToProfile(user),
            OnboardingRequired: IsOnboardingRequired(user));
    }

    public async Task<AccountResult> UpdateCurrentProfileAsync(
        System.Security.Claims.ClaimsPrincipal principal,
        UpdateProfileCommand command)
    {
        var user = await _userManager.GetUserAsync(principal);
        if (user is null)
        {
            return new AccountResult(null, AccountFailure.Unauthenticated);
        }

        var name = command.Name?.Trim();
        var nameEn = command.NameEn?.Trim();
        var username = command.Username?.Trim();
        var role = command.Role?.Trim();
        var bio = command.Bio?.Trim();
        var customSkills = command.CustomSkills?.Select(skill => skill?.Trim() ?? string.Empty).ToArray();
        var errors = new List<string>();

        if (string.IsNullOrWhiteSpace(name) || name.Length is < 2 or > 80)
        {
            errors.Add("Name must contain between 2 and 80 characters.");
        }

        if (nameEn?.Length > 80)
        {
            errors.Add("English name must not exceed 80 characters.");
        }

        if (!IsValidUsername(username))
        {
            errors.Add("Username must be 3 to 24 letters, digits, or underscores.");
        }

        if (role is null || !SupportedRoles.Contains(role))
        {
            errors.Add("Role must be learner, instructor, or both.");
        }

        if (bio?.Length > 500)
        {
            errors.Add("Bio must not exceed 500 characters.");
        }

        if (!AreValidCategoryIndexes(command.Interests)
            || !AreValidCategoryIndexes(command.TeachingAreas))
        {
            errors.Add("Interests and teaching areas must contain unique category indexes from 0 to 5.");
        }

        if (customSkills is { Length: > 10 }
            || customSkills?.Any(skill => skill.Length is < 2 or > 80) == true)
        {
            errors.Add("Custom skills must contain at most 10 entries of 2 to 80 characters each.");
        }

        if (command.Goal is < 0 or > 3)
        {
            errors.Add("Goal must be null or an index from 0 to 3.");
        }

        if (!IsValidAvatar(command.Avatar))
        {
            errors.Add("Avatar must be an empty value or a valid JPEG data URL.");
        }

        if (errors.Count > 0)
        {
            return new AccountResult(null, AccountFailure.Validation, Errors: errors);
        }

        user.Name = name;
        if (command.NameEn is not null)
        {
            user.NameEn = nameEn;
        }

        user.UserName = username;
        user.Role = role;
        if (command.Avatar is not null)
        {
            user.Avatar = command.Avatar;
        }

        if (command.Bio is not null)
        {
            user.Bio = bio;
        }

        if (command.Interests is not null)
        {
            user.Interests = command.Interests.Distinct().ToList();
        }

        if (command.TeachingAreas is not null)
        {
            user.TeachingAreas = command.TeachingAreas.Distinct().ToList();
        }

        if (customSkills is not null)
        {
            user.CustomSkills = customSkills.ToList();
        }

        user.Goal = command.Goal;

        var updateResult = await _userManager.UpdateAsync(user);
        if (!updateResult.Succeeded)
        {
            var identityErrors = updateResult.Errors.ToArray();
            if (identityErrors.Any(error => error.Code == "DuplicateUserName"))
            {
                return new AccountResult(null, AccountFailure.UsernameAlreadyExists);
            }

            return new AccountResult(
                null,
                AccountFailure.Validation,
                Errors: identityErrors.Select(error => error.Description).ToArray());
        }

        await _signInManager.RefreshSignInAsync(user);
        return new AccountResult(ToProfile(user), OnboardingRequired: IsOnboardingRequired(user));
    }

    private static bool IsOnboardingRequired(ApplicationUser user)
    {
        if (user.Role is null || !SupportedRoles.Contains(user.Role)
            || string.IsNullOrWhiteSpace(user.Name) || user.Name.Trim().Length is < 2 or > 80
            || !IsValidUsername(user.UserName)
            || user.Goal is null or < 0 or > 3)
        {
            return true;
        }

        var needsInterests = user.Role is "learner" or "both";
        var needsTeachingAreas = user.Role is "instructor" or "both";
        return (needsInterests && user.Interests.Count == 0)
            || (needsTeachingAreas && user.TeachingAreas.Count == 0 && user.CustomSkills.Count == 0);
    }

    private static bool IsValidUsername(string? username) =>
        username is { Length: >= 3 and <= 24 }
        && username.All(character =>
            character is >= 'a' and <= 'z'
            or >= 'A' and <= 'Z'
            or >= '0' and <= '9'
            or '_');

    private static bool AreValidCategoryIndexes(IReadOnlyList<int>? values) =>
        values is null
        || (values.Count <= 6
            && values.All(value => value is >= 0 and < 6)
            && values.Distinct().Count() == values.Count);

    private static bool IsValidAvatar(string? avatar)
    {
        if (string.IsNullOrEmpty(avatar))
        {
            return true;
        }

        if (!avatar.StartsWith(AvatarPrefix, StringComparison.Ordinal)
            || avatar.Length > MaximumAvatarLength)
        {
            return false;
        }

        try
        {
            _ = Convert.FromBase64String(avatar[AvatarPrefix.Length..]);
            return true;
        }
        catch (FormatException)
        {
            return false;
        }
    }

    private static AccountProfile ToProfile(ApplicationUser user) => new(
        user.Id,
        user.Name,
        user.NameEn,
        user.Email,
        user.UserName,
        user.Role,
        user.Avatar,
        user.Bio,
        user.Interests.ToArray(),
        user.TeachingAreas.ToArray(),
        user.CustomSkills.ToArray(),
        user.Goal);
}