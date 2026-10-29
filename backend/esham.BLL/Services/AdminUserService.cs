using System.Data;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using esham.BLL.DTOs;
using esham.BLL.DTOs.AdminUsers;
using esham.BLL.Interfaces;
using esham.BLL.Security;
using esham.DAL.Data;
using esham.DAL.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace esham.BLL.Services;

public sealed class AdminUserService(AppDbContext db, UserManager<ApplicationUser> users) : IAdminUserService
{
    private static bool Locked(ApplicationUser user, DateTimeOffset now) => user.LockoutEnabled && user.LockoutEnd > now;
    private static bool ValidId(string id) => Guid.TryParseExact(id, "D", out var guid) && guid != Guid.Empty;
    private static string Version(ApplicationUser user) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(user.ConcurrencyStamp ?? "")));
    private static AdminUserDto Map(ApplicationUser user, IEnumerable<string> roles, DateTimeOffset now) => new(
        user.Id, user.Name, user.UserName, user.Email, roles.Order().ToArray(), user.EmailConfirmed,
        user.LockoutEnabled, user.LockoutEnd, Locked(user, now), Version(user));
    private static ServiceResult<T> Fail<T>(ServiceFailure failure, string message) => ServiceResult<T>.Fail(failure, message);

    private async Task<ServiceFailure> AuthorizeAsync(ClaimsPrincipal principal)
    {
        if (principal.Identity?.IsAuthenticated != true) return ServiceFailure.Unauthenticated;
        var user = await users.GetUserAsync(principal);
        if (user is null || Locked(user, DateTimeOffset.UtcNow)) return ServiceFailure.Unauthenticated;
        return await users.IsInRoleAsync(user, "GeneralAdmin") ? ServiceFailure.None : ServiceFailure.Forbidden;
    }

    public async Task<ServiceResult<AdminUserPage>> GetUsersAsync(ClaimsPrincipal actor, AdminUserQuery query, CancellationToken ct = default)
    {
        var access = await AuthorizeAsync(actor);
        if (access != ServiceFailure.None) return Fail<AdminUserPage>(access, "GeneralAdmin membership is required.");
        var search = query.Search?.Trim();
        if (query.Page < 1 || query.PageSize is < 1 or > 100 || (long)(query.Page - 1) * query.PageSize > int.MaxValue
            || search?.Length > 100 || (query.Role is not null && query.Role != "administrators" && !AccountRoles.Known.Contains(query.Role))
            || query.Status is not (null or "locked" or "unlocked"))
            return Fail<AdminUserPage>(ServiceFailure.Validation, "Invalid pagination, search, role or lockout filter.");
        var now = DateTimeOffset.UtcNow;
        var matching = db.Users.AsNoTracking();
        if (!string.IsNullOrEmpty(search))
        {
            var term = search.ToUpperInvariant();
            matching = matching.Where(x => (x.Name != null && x.Name.ToUpper().Contains(term))
                || (x.NormalizedEmail != null && x.NormalizedEmail.Contains(term))
                || (x.NormalizedUserName != null && x.NormalizedUserName.Contains(term)));
        }
        if (query.Role is not null)
        {
            var allowed = query.Role == "administrators" ? new[] { "GENERALADMIN", "CATEGORYADMIN" } : [query.Role.ToUpperInvariant()];
            matching = matching.Where(user => (from membership in db.UserRoles join role in db.Roles on membership.RoleId equals role.Id
                where membership.UserId == user.Id && allowed.Contains(role.NormalizedName!) select membership).Any());
        }
        if (query.Status == "locked") matching = matching.Where(x => x.LockoutEnabled && x.LockoutEnd > now);
        if (query.Status == "unlocked") matching = matching.Where(x => !x.LockoutEnabled || x.LockoutEnd == null || x.LockoutEnd <= now);
        var total = await matching.CountAsync(ct);
        var page = await matching.OrderBy(x => x.NormalizedUserName).ThenBy(x => x.Id)
            .Skip((query.Page - 1) * query.PageSize).Take(query.PageSize).ToListAsync(ct);
        var ids = page.Select(x => x.Id).ToArray();
        var memberships = await (from membership in db.UserRoles.AsNoTracking() join role in db.Roles.AsNoTracking() on membership.RoleId equals role.Id
            where ids.Contains(membership.UserId) select new { membership.UserId, role.Name }).ToListAsync(ct);
        return ServiceResult<AdminUserPage>.Ok(new(page.Select(user => Map(user,
            memberships.Where(x => x.UserId == user.Id).Select(x => x.Name!), now)).ToArray(), query.Page, query.PageSize, total));
    }

    public async Task<ServiceResult<AdminUserDto>> GetUserAsync(ClaimsPrincipal actor, string id, CancellationToken ct = default)
    {
        var access = await AuthorizeAsync(actor);
        if (access != ServiceFailure.None) return Fail<AdminUserDto>(access, "GeneralAdmin membership is required.");
        if (!ValidId(id)) return Fail<AdminUserDto>(ServiceFailure.Validation, "A nonempty GUID user identifier is required.");
        var user = await db.Users.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, ct);
        return user is null ? Fail<AdminUserDto>(ServiceFailure.NotFound, "User not found.")
            : ServiceResult<AdminUserDto>.Ok(Map(user, await users.GetRolesAsync(user), DateTimeOffset.UtcNow));
    }

    public Task<ServiceResult<AdminUserDto>> UpdateRolesAsync(ClaimsPrincipal actor, string id, UpdateAdminUserRolesRequest request, CancellationToken ct = default)
    {
        var roles = request.Roles?.ToArray();
        return MutateAsync(actor, id, request.Version, roles, null, changeRoles: true, ct);
    }

    public Task<ServiceResult<AdminUserDto>> UpdateLockoutAsync(ClaimsPrincipal actor, string id, UpdateAdminUserLockoutRequest request, CancellationToken ct = default) =>
        MutateAsync(actor, id, request.Version, null, request.LockoutEnd, changeRoles: false, ct);

    private async Task<ServiceResult<AdminUserDto>> MutateAsync(ClaimsPrincipal actor, string id, string? expectedVersion,
        string[]? desired, DateTimeOffset? lockoutEnd, bool changeRoles, CancellationToken ct)
    {
        var access = await AuthorizeAsync(actor);
        if (access != ServiceFailure.None) return Fail<AdminUserDto>(access, "GeneralAdmin membership is required.");
        if (!ValidId(id) || expectedVersion is not { Length: 64 } || !expectedVersion.All(Uri.IsHexDigit)
            || (changeRoles && (desired is null || desired.Any(x => !AccountRoles.Known.Contains(x)) || desired.Distinct().Count() != desired.Length))
            || (!changeRoles && lockoutEnd.HasValue && lockoutEnd <= DateTimeOffset.UtcNow))
            return Fail<AdminUserDto>(ServiceFailure.Validation, "Provide a valid user GUID, version, supported unique roles or a future lockout end (null unlocks).");
        var actorId = users.GetUserId(actor)!;
        if (Guid.TryParse(actorId, out var actorGuid) && Guid.Parse(id) == actorGuid) id = actorId;
        try
        {
            return await db.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
            {
                db.ChangeTracker.Clear();
                await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
                // Global gate for GeneralAdmin membership/availability changes across instances.
                // User locks below follow the same order for cross-administrator requests.
                var adminRole = db.Database.IsSqlServer()
                    ? await db.Roles.FromSqlInterpolated($"SELECT * FROM [AspNetRoles] WITH (UPDLOCK, HOLDLOCK) WHERE [NormalizedName] = {"GENERALADMIN"}").SingleOrDefaultAsync(ct)
                    : await db.Roles.SingleOrDefaultAsync(x => x.NormalizedName == "GENERALADMIN", ct);
                if (adminRole is null) return Fail<AdminUserDto>(ServiceFailure.Conflict, "GeneralAdmin role is not provisioned.");
                foreach (var userId in new[] { actorId, id }.Distinct().Order(StringComparer.Ordinal))
                {
                    if (db.Database.IsSqlServer())
                        await db.Users.FromSqlInterpolated($"SELECT * FROM [AspNetUsers] WITH (UPDLOCK, HOLDLOCK) WHERE [Id] = {userId}").SingleOrDefaultAsync(ct);
                    else await db.Users.SingleOrDefaultAsync(x => x.Id == userId, ct);
                }
                access = await AuthorizeAsync(actor); // Recheck after waiting for locks.
                if (access != ServiceFailure.None) return Fail<AdminUserDto>(access, "Administrator access changed. Sign in again.");
                var user = await db.Users.SingleOrDefaultAsync(x => x.Id == id, ct);
                if (user is null) return Fail<AdminUserDto>(ServiceFailure.NotFound, "User not found.");
                if (!string.Equals(expectedVersion, Version(user), StringComparison.Ordinal))
                    return Fail<AdminUserDto>(ServiceFailure.Conflict, "The user changed. Reload their details before retrying.");
                var existing = (await users.GetRolesAsync(user)).ToArray();
                if (changeRoles && (existing.Any(x => !AccountRoles.Known.Contains(x))
                    || existing.Contains("CategoryAdmin") != desired!.Contains("CategoryAdmin")))
                    return Fail<AdminUserDto>(ServiceFailure.Conflict, "CategoryAdmin scope changes or unknown roles require separate coordination. Existing membership must be preserved.");
                var now = DateTimeOffset.UtcNow;
                if (!changeRoles && lockoutEnd.HasValue && lockoutEnd <= now)
                    return Fail<AdminUserDto>(ServiceFailure.Validation, "Lockout end must still be in the future.");
                var removesAvailability = existing.Contains("GeneralAdmin") && !Locked(user, now)
                    && (changeRoles ? !desired!.Contains("GeneralAdmin") : lockoutEnd > now && user.LockoutEnabled);
                if (removesAvailability)
                {
                    var available = await (from membership in db.UserRoles join candidate in db.Users on membership.UserId equals candidate.Id
                        where membership.RoleId == adminRole.Id && (!candidate.LockoutEnabled || candidate.LockoutEnd == null || candidate.LockoutEnd <= now)
                        select candidate.Id).CountAsync(ct);
                    if (available <= 1) return Fail<AdminUserDto>(ServiceFailure.Conflict, "The last unlocked GeneralAdmin must be preserved.");
                }
                if (string.Equals(user.Id, actorId, StringComparison.OrdinalIgnoreCase))
                    return Fail<AdminUserDto>(ServiceFailure.Conflict, "Administrative self-modification is not allowed.");
                if (!changeRoles && lockoutEnd.HasValue && !user.LockoutEnabled)
                    return Fail<AdminUserDto>(ServiceFailure.Conflict, "Identity lockout is not enabled for this account; activation/suspension is not supported.");

                if (changeRoles)
                {
                    if (existing.Order().SequenceEqual(desired!.Order()) && user.Role == AccountRoles.Persona(desired!))
                        return ServiceResult<AdminUserDto>.Ok(Map(user, existing, now));
                    if (await db.Roles.CountAsync(x => desired!.Contains(x.Name!)) != desired!.Length)
                        return Fail<AdminUserDto>(ServiceFailure.Conflict, "Required roles must be provisioned first.");
                    var add = desired.Except(existing).ToArray();
                    var remove = existing.Except(desired).ToArray();
                    if (add.Length > 0) Require(await users.AddToRolesAsync(user, add));
                    if (remove.Length > 0) Require(await users.RemoveFromRolesAsync(user, remove));
                    user.Role = AccountRoles.Persona(desired);
                }
                else
                {
                    if (user.LockoutEnd == lockoutEnd && (lockoutEnd.HasValue || user.AccessFailedCount == 0))
                        return ServiceResult<AdminUserDto>.Ok(Map(user, existing, now));
                    Require(await users.SetLockoutEndDateAsync(user, lockoutEnd));
                    if (!lockoutEnd.HasValue) Require(await users.ResetAccessFailedCountAsync(user));
                }
                Require(await users.UpdateSecurityStampAsync(user)); // Also saves the synchronized persona.
                db.AdminActivityLogs.Add(new AdminActivityLog { ActorUserId = actorId, TargetType = "user", TargetId = id,
                    Action = changeRoles ? "user.roles.changed" : lockoutEnd.HasValue ? "user.lockout.set" : "user.lockout.cleared",
                    Details = "Administrative identity change; existing sessions invalidated." });
                await db.SaveChangesAsync(ct);
                var response = Map(user, await users.GetRolesAsync(user), now);
                await transaction.CommitAsync(ct);
                return ServiceResult<AdminUserDto>.Ok(response);
            });
        }
        catch (IdentityChangeFailure)
        {
            return Fail<AdminUserDto>(ServiceFailure.Conflict, "The identity change could not be completed. No partial change was committed; reload and retry.");
        }
        finally { db.ChangeTracker.Clear(); }
    }

    private static void Require(IdentityResult result)
    {
        if (!result.Succeeded) throw new IdentityChangeFailure();
    }
    private sealed class IdentityChangeFailure : Exception { }
}
