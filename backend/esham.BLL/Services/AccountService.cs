using System.ComponentModel.DataAnnotations;
using System.Data;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using esham.DAL.Data;
using esham.BLL.Interfaces;
using esham.DAL.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace esham.BLL.Services;

public sealed class AccountService : IAccountService
{
    private static readonly HashSet<string> SupportedRoles = ["learner", "instructor", "both"];
    private const string AvatarPrefix = "data:image/jpeg;base64,";
    private const int MaximumAvatarLength = 7 * 1024 * 1024;

    private readonly UserManager<ApplicationUser> _userManager;
    private readonly SignInManager<ApplicationUser> _signInManager;
    private readonly AppDbContext _db;
    private readonly INotificationWriter _notifications;

    public AccountService(
        UserManager<ApplicationUser> userManager,
        SignInManager<ApplicationUser> signInManager,
        AppDbContext db,
        INotificationWriter notifications)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _db = db;
        _notifications = notifications;
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
        return new AccountResult(await ToProfileAsync(user), OnboardingRequired: true);
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

        var onboardingRequired = await IsOnboardingRequiredAsync(user);
        // Valid credentials may restore an onboarding session. Authorization
        // still uses actual memberships; no roles or points are granted by login.
        await _signInManager.SignInAsync(user, isPersistent: false);
        return new AccountResult(await ToProfileAsync(user), OnboardingRequired: onboardingRequired);
    }

    public Task SignOutAsync() => _signInManager.SignOutAsync();

    public async Task<AccountResult> GetCurrentSessionAsync(System.Security.Claims.ClaimsPrincipal principal)
    {
        var user = await _userManager.GetUserAsync(principal);
        if (user is null || await _userManager.IsLockedOutAsync(user))
        {
            return new AccountResult(null, AccountFailure.Unauthenticated);
        }

        return new AccountResult(
            await ToProfileAsync(user),
            OnboardingRequired: await IsOnboardingRequiredAsync(user));
    }

    public async Task<AccountResult> UpdateCurrentProfileAsync(
        System.Security.Claims.ClaimsPrincipal principal,
        UpdateProfileCommand command)
    {
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

        return await FinalizeAsync(principal, user =>
        {
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
        }, command);
    }

    public Task<AccountResult> UpdateCurrentRoleAsync(ClaimsPrincipal principal, string? role)
    {
        role = role?.Trim();
        return role is null || !SupportedRoles.Contains(role)
            ? Task.FromResult(new AccountResult(null, AccountFailure.Validation,
                Errors: ["Role must be learner, instructor, or both."]))
            : FinalizeAsync(principal, user => user.Role = role);
    }

    private async Task<AccountResult> FinalizeAsync(ClaimsPrincipal principal, Action<ApplicationUser> apply,
        UpdateProfileCommand? profileCommand = null)
    {
        var userId = principal.Identity?.IsAuthenticated == true ? _userManager.GetUserId(principal) : null;
        if (userId is null) return new AccountResult(null, AccountFailure.Unauthenticated);

        AccountResult result;
        try
        {
            result = await _db.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
            {
                // Identity's EF store resolves this same scoped context. Its intermediate
                // SaveChanges calls therefore participate in this transaction too.
                _db.ChangeTracker.Clear();
                await using var transaction = await _db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
                // Take an update lock before reading memberships/wallet. Concurrent requests
                // for the same account wait here, rather than racing to insert the welcome.
                var user = _db.Database.IsSqlServer()
                    ? await _db.Users.FromSqlInterpolated($"SELECT * FROM [AspNetUsers] WITH (UPDLOCK, HOLDLOCK) WHERE [Id] = {userId}").SingleOrDefaultAsync()
                    : await _db.Users.SingleOrDefaultAsync(x => x.Id == userId);
                if (user is null) return new AccountResult(null, AccountFailure.Unauthenticated);
                if (await _userManager.IsLockedOutAsync(user)) return new AccountResult(null, AccountFailure.Unauthenticated);
                var selections = await UserCategoryService.ReadSelectionsAsync(_db, user.Id);
                // The legacy frontend has no trustworthy index-to-GUID mapping. Do not
                // let a profile save silently replace authoritative GUID selections.
                if (profileCommand is not null
                    && ((selections.LearningCategoryIds.Count > 0 && profileCommand.Interests is not null
                            && !profileCommand.Interests.Order().SequenceEqual(user.Interests.Order()))
                        || (selections.TeachingCategoryIds.Count > 0 && profileCommand.TeachingAreas is not null
                            && !profileCommand.TeachingAreas.Order().SequenceEqual(user.TeachingAreas.Order()))))
                    throw new FinalizationFailure(new(null, AccountFailure.Conflict,
                        Errors: ["Update GUID category selections through /me/categories; frontend indexes cannot be mapped safely."]));
                apply(user);
                if (profileCommand is not null)
                {
                    foreach (var (kind, categoryIds, legacy, allowed) in new[]
                    {
                        ("learning", profileCommand.LearningCategoryIds, profileCommand.Interests, user.Role is "learner" or "both"),
                        ("teaching", profileCommand.TeachingCategoryIds, profileCommand.TeachingAreas, user.Role is "instructor" or "both"),
                    })
                    {
                        if (categoryIds is null) continue;
                        if (!allowed || legacy is { Count: > 0 } || categoryIds.Any(x => x == Guid.Empty)
                            || categoryIds.Distinct().Count() != categoryIds.Count
                            || await _db.Categories.CountAsync(x => categoryIds.Contains(x.Id) && x.IsActive) != categoryIds.Count)
                            throw new FinalizationFailure(new(null, AccountFailure.Validation,
                                Errors: ["Select unique active category GUIDs for the chosen persona; do not mix GUIDs and legacy indexes."]));
                        var existingSelections = await _db.UserCategories.Where(x => x.UserId == user.Id && x.Kind == kind).ToListAsync();
                        _db.UserCategories.RemoveRange(existingSelections.Where(x => !categoryIds.Contains(x.CategoryId)));
                        var retained = existingSelections.Select(x => x.CategoryId).ToHashSet();
                        foreach (var categoryId in categoryIds.Where(x => !retained.Contains(x)))
                            _db.UserCategories.Add(new UserCategory { UserId = user.Id, CategoryId = categoryId, Kind = kind });
                        if (kind == "learning") user.Interests = [];
                        else user.TeachingAreas = [];
                    }
                }
                var activeKinds = await ActiveCategoryKindsAsync(user.Id);
                // Pending GUID inserts/removals are saved with Identity later in this
                // transaction; use the validated requested set for completeness now.
                if (profileCommand?.LearningCategoryIds is { } learning)
                { activeKinds.Remove("learning"); if (learning.Count > 0) activeKinds.Add("learning"); }
                if (profileCommand?.TeachingCategoryIds is { } teaching)
                { activeKinds.Remove("teaching"); if (teaching.Count > 0) activeKinds.Add("teaching"); }
                if (IsOnboardingRequired(user, activeKinds.Contains("learning"), activeKinds.Contains("teaching")))
                    throw new FinalizationFailure(new(null, AccountFailure.Validation,
                        Errors: ["Complete the profile, interests or teaching areas, and goal before finalizing."]));

                var desired = PersonaRoles(user.Role!);
                var normalized = desired.Select(x => x.ToUpperInvariant()).ToArray();
                if (await _db.Roles.CountAsync(x => normalized.Contains(x.NormalizedName!)) != desired.Length)
                    throw new FinalizationFailure(new(null, AccountFailure.Unavailable));

                // A fixed-size operation key also supports existing long Identity IDs.
                var key = "welcome:" + Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(user.Id)));
                var wallet = await _db.Wallets.SingleOrDefaultAsync(x => x.UserId == user.Id);
                var welcome = await _db.PointTransactions.SingleOrDefaultAsync(x => x.OperationKey == key);
                if ((wallet is null) != (welcome is null)
                    || (welcome is not null && (welcome.UserId != user.Id || welcome.Amount != 20
                        || welcome.TransactionType != "welcome" || welcome.EnrollmentId is not null))
                    || (welcome is null && await _db.PointTransactions.AnyAsync(x => x.UserId == user.Id)))
                    throw new FinalizationFailure(new(null, AccountFailure.Conflict));

                RequireSuccess(await _userManager.UpdateAsync(user));
                var existing = await _userManager.GetRolesAsync(user);
                var remove = existing.Where(x => (x is "Learner" or "Instructor") && !desired.Contains(x)).ToArray();
                if (remove.Length > 0) RequireSuccess(await _userManager.RemoveFromRolesAsync(user, remove));
                var add = desired.Except(existing, StringComparer.OrdinalIgnoreCase).ToArray();
                if (add.Length > 0) RequireSuccess(await _userManager.AddToRolesAsync(user, add));
                // Administrative and any other non-persona memberships are never changed.
                RequireSuccess(await _userManager.UpdateSecurityStampAsync(user));

                if (wallet is null)
                {
                    _db.Wallets.Add(new Wallet { UserId = user.Id, Balance = 20 });
                    _db.PointTransactions.Add(new PointTransaction
                    {
                        UserId = user.Id, Amount = 20, TransactionType = "welcome", OperationKey = key,
                    });
                    await _notifications.StageAsync(new(NotificationWriter.WelcomeId(user.Id), user.Id, "account.welcome",
                        "مرحبًا بك في إسهام", "Welcome to Esham",
                        "اكتمل إعداد حسابك وأضيف رصيد البداية إلى محفظتك.", "Your account setup is complete and your welcome credit has been added to your wallet."));
                    await _db.SaveChangesAsync();
                }
                await transaction.CommitAsync();
                return new AccountResult(await ToProfileAsync(user));
            });
        }
        catch (FinalizationFailure failure)
        {
            return failure.Result;
        }
        finally
        {
            // Do not reuse tracked changes after rollback, failed saves or execution retries.
            _db.ChangeTracker.Clear();
        }

        if (result.Failure == AccountFailure.None)
        {
            var committedUser = await _userManager.FindByIdAsync(userId);
            if (committedUser is not null) await _signInManager.RefreshSignInAsync(committedUser);
        }
        // Cookie delivery cannot be committed atomically with SQL. A failed refresh can
        // be recovered by login/retrying; the committed welcome is never granted twice.
        return result;
    }

    private static void RequireSuccess(IdentityResult result)
    {
        if (result.Succeeded) return;
        throw new FinalizationFailure(new(null,
            result.Errors.Any(x => x.Code == "DuplicateUserName") ? AccountFailure.UsernameAlreadyExists
                : result.Errors.Any(x => x.Code == "ConcurrencyFailure") ? AccountFailure.Conflict : AccountFailure.Validation,
            Errors: result.Errors.Select(x => x.Description).ToArray()));
    }

    private sealed class FinalizationFailure(AccountResult result) : Exception("Account finalization was rolled back.")
    {
        public AccountResult Result { get; } = result;
    }

    private static string[] PersonaRoles(string role) => role switch
    {
        "learner" => ["Learner"], "instructor" => ["Instructor"], "both" => ["Learner", "Instructor"], _ => [],
    };

    private async Task<bool> IsOnboardingRequiredAsync(ApplicationUser user)
    {
        var roles = await _userManager.GetRolesAsync(user);
        // Administrators can use existing administrative APIs without a learner persona.
        if (user.Role is null or "" && roles.Any(x => x is "GeneralAdmin" or "CategoryAdmin")) return false;
        var activeKinds = await ActiveCategoryKindsAsync(user.Id);
        if (IsOnboardingRequired(user, activeKinds.Contains("learning"), activeKinds.Contains("teaching"))) return true;
        var desired = PersonaRoles(user.Role!);
        return !desired.Order().SequenceEqual(roles.Where(x => x is "Learner" or "Instructor").Order());
    }

    private Task<List<string>> ActiveCategoryKindsAsync(string userId) => _db.UserCategories.AsNoTracking()
        .Where(x => x.UserId == userId && x.Category.IsActive).Select(x => x.Kind).Distinct().ToListAsync();

    private static bool IsOnboardingRequired(ApplicationUser user, bool hasLearningCategories, bool hasTeachingCategories)
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
        return (needsInterests && user.Interests.Count == 0 && !hasLearningCategories)
            || (needsTeachingAreas && user.TeachingAreas.Count == 0 && !hasTeachingCategories && user.CustomSkills.Count == 0);
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

    private async Task<AccountProfile> ToProfileAsync(ApplicationUser user)
    {
        var selected = await UserCategoryService.ReadSelectionsAsync(_db, user.Id);
        return new(
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
        user.Goal)
        {
            LearningCategoryIds = selected.LearningCategoryIds,
            TeachingCategoryIds = selected.TeachingCategoryIds,
            Roles = (await _userManager.GetRolesAsync(user)).ToArray(),
        };
    }
}
