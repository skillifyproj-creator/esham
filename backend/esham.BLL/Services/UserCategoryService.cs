using System.Data;
using System.Security.Claims;
using esham.BLL.DTOs;
using esham.BLL.DTOs.UserCategories;
using esham.BLL.Interfaces;
using esham.DAL.Data;
using esham.DAL.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace esham.BLL.Services;

public sealed class UserCategoryService(AppDbContext db, UserManager<ApplicationUser> users) : IUserCategoryService
{
    public async Task<ServiceResult<UserCategoriesResponseDto>> GetCurrentAsync(ClaimsPrincipal principal, CancellationToken ct = default)
    {
        var id = CurrentUserId(principal);
        if (id is null || !await db.Users.AnyAsync(x => x.Id == id, ct)) return Forbidden();
        // Retain visibility of the user's own selections even after membership removal
        // or category deactivation; only new selections require an active category.
        return ServiceResult<UserCategoriesResponseDto>.Ok(await ReadSelectionsAsync(db, id, ct));
    }

    public async Task<ServiceResult<UserCategoriesResponseDto>> ReplaceCurrentAsync(ClaimsPrincipal principal,
        string kind, ReplaceUserCategoriesRequest request, CancellationToken ct = default)
    {
        var id = CurrentUserId(principal);
        if (id is null) return Forbidden();
        if (kind is not ("learning" or "teaching"))
            return Invalid("Kind must be learning or teaching.");
        var ids = request.CategoryIds;
        if (ids is null || ids.Any(x => x == Guid.Empty) || ids.Distinct().Count() != ids.Length)
            return Invalid("CategoryIds must be an array of unique, nonempty category GUIDs.");
        // Capture the request once: every execution-strategy attempt replaces the same set.
        ids = ids.ToArray();
        try
        {
            return await db.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
            {
                db.ChangeTracker.Clear();
                await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
                // Same user-row lock as account finalization: profile edits, persona
                // changes and selection replacements cannot overwrite each other.
                var user = db.Database.IsSqlServer()
                    ? await db.Users.FromSqlInterpolated($"SELECT * FROM [AspNetUsers] WITH (UPDLOCK, HOLDLOCK) WHERE [Id] = {id}").SingleOrDefaultAsync(ct)
                    : await db.Users.SingleOrDefaultAsync(x => x.Id == id, ct);
                if (user is null) return Forbidden();
                var memberships = await users.GetRolesAsync(user);
                var requiredRole = kind == "learning" ? "Learner" : "Instructor";
                if (!memberships.Contains(requiredRole, StringComparer.OrdinalIgnoreCase)) return Forbidden();
                if (await db.Categories.CountAsync(x => ids.Contains(x.Id) && x.IsActive, ct) != ids.Length)
                    return Invalid("Every selected category must exist and be active.");

                var existing = await db.UserCategories.Where(x => x.UserId == id && x.Kind == kind).ToListAsync(ct);
                var retained = existing.Select(x => x.CategoryId).ToHashSet();
                db.UserCategories.RemoveRange(existing.Where(x => !ids.Contains(x.CategoryId)));
                foreach (var categoryId in ids.Where(x => !retained.Contains(x)))
                    db.UserCategories.Add(new UserCategory { UserId = id, CategoryId = categoryId, Kind = kind });

                // GUIDs cannot be reverse-mapped to frontend indexes. Clear that kind's
                // legacy preview selections so profile responses never report stale ones.
                if (kind == "learning") user.Interests = [];
                else user.TeachingAreas = [];
                // Identity writes loaded before this replacement must fail optimistic
                // concurrency checks rather than restore stale legacy category arrays.
                user.ConcurrencyStamp = Guid.NewGuid().ToString();
                await db.SaveChangesAsync(ct);
                var response = await ReadSelectionsAsync(db, id, ct);
                await transaction.CommitAsync(ct);
                return ServiceResult<UserCategoriesResponseDto>.Ok(response);
            });
        }
        finally
        {
            db.ChangeTracker.Clear();
        }
    }

    private string? CurrentUserId(ClaimsPrincipal principal) =>
        principal.Identity?.IsAuthenticated == true ? users.GetUserId(principal) : null;

    internal static async Task<UserCategoriesResponseDto> ReadSelectionsAsync(AppDbContext db, string userId, CancellationToken ct = default)
    {
        var selected = await db.UserCategories.AsNoTracking().Where(x => x.UserId == userId)
            .Select(x => new { x.CategoryId, x.Kind }).ToListAsync(ct);
        return new(selected.Where(x => x.Kind == "learning").Select(x => x.CategoryId).Order().ToArray(),
            selected.Where(x => x.Kind == "teaching").Select(x => x.CategoryId).Order().ToArray());
    }

    private static ServiceResult<UserCategoriesResponseDto> Forbidden() =>
        ServiceResult<UserCategoriesResponseDto>.Fail(ServiceFailure.Forbidden, "The current account is not permitted to perform this operation.");
    private static ServiceResult<UserCategoriesResponseDto> Invalid(string message) =>
        ServiceResult<UserCategoriesResponseDto>.Fail(ServiceFailure.Validation, message);
}
