using System.ComponentModel.DataAnnotations;
using System.Data;
using System.Security.Claims;
using System.Text.Json.Serialization;
using esham.BLL.DTOs;
using esham.DAL.Data;
using esham.DAL.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace esham.BLL.Services;

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record CreateCategoryAdminRequest(string Name, string Email, string Password, Guid[] CategoryIds);

// Uses the same scoped Identity store/context: account, fixed role, scope and audit commit together.
public sealed class CategoryAdminProvisioningService(AppDbContext db, UserManager<ApplicationUser> users)
{
    public async Task<ServiceResult<object>> Create(ClaimsPrincipal principal, CreateCategoryAdminRequest input, CancellationToken ct = default)
    {
        async Task<ServiceFailure> Access()
        {
            var actor = await new ModerationAccess(db).ReadAsync(principal, ct);
            return actor is null ? ServiceFailure.Unauthenticated : actor.General ? ServiceFailure.None : ServiceFailure.Forbidden;
        }
        var access = await Access();
        if (access != ServiceFailure.None) return ServiceResult<object>.Fail(access, "GeneralAdmin membership is required.");
        var name = input.Name?.Trim(); var email = input.Email?.Trim();
        if (string.IsNullOrWhiteSpace(name) || name.Length > 200 || string.IsNullOrWhiteSpace(email) || email.Length > 256
            || !new EmailAddressAttribute().IsValid(email) || string.IsNullOrEmpty(input.Password) || input.Password.Length > 128
            || input.CategoryIds is null || input.CategoryIds.Length > 100 || input.CategoryIds.Contains(Guid.Empty)
            || input.CategoryIds.Distinct().Count() != input.CategoryIds.Length)
            return ServiceResult<object>.Fail(ServiceFailure.Validation, "Provide a name, valid email, password and unique category IDs.");
        try
        {
            return await db.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
            {
                db.ChangeTracker.Clear();
                await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
                access = await Access();
                if (access != ServiceFailure.None) return ServiceResult<object>.Fail(access, "GeneralAdmin membership is required.");
                // Read selected rows in a deterministic order; serializable isolation protects scope validation.
                var categories = await db.Categories.Where(x => input.CategoryIds.Contains(x.Id)).OrderBy(x => x.Id).ToListAsync(ct);
                if (categories.Count != input.CategoryIds.Length || categories.Any(x => !x.IsActive))
                    return ServiceResult<object>.Fail(ServiceFailure.Validation, "Select existing active categories.");
                if (!await db.Roles.AnyAsync(x => x.NormalizedName == "CATEGORYADMIN", ct))
                    return ServiceResult<object>.Fail(ServiceFailure.Conflict, "The CategoryAdmin role must already exist.");
                if (await users.FindByEmailAsync(email!) != null || await users.FindByNameAsync(email!) != null)
                    return ServiceResult<object>.Fail(ServiceFailure.Conflict, "An account with this email or username already exists.");
                var user = new ApplicationUser { Name = name, Email = email, UserName = email, LockoutEnabled = true };
                var created = await users.CreateAsync(user, input.Password);
                if (!created.Succeeded) return ServiceResult<object>.Fail(ServiceFailure.Validation, string.Join(" ", created.Errors.Select(x => x.Description)));
                var assigned = await users.AddToRoleAsync(user, "CategoryAdmin");
                if (!assigned.Succeeded) throw new InvalidOperationException("CategoryAdmin role assignment failed.");
                db.CategoryAdminAssignments.AddRange(categories.Select(x => new CategoryAdminAssignment { UserId = user.Id, CategoryId = x.Id }));
                db.AdminActivityLogs.Add(new AdminActivityLog { ActorUserId = principal.FindFirstValue(ClaimTypes.NameIdentifier)!,
                    Action = "category-admin.created", TargetType = "user", TargetId = user.Id, TargetName = name,
                    NewState = "CategoryAdmin", Details = $"Initial category assignments: {categories.Count}." });
                await db.SaveChangesAsync(ct);
                await tx.CommitAsync(ct);
                return ServiceResult<object>.Ok(new { user.Id, user.Name, user.Email, Roles = new[] { "CategoryAdmin" }, CategoryIds = categories.Select(x => x.Id).ToArray() });
            });
        }
        catch (DbUpdateException) { db.ChangeTracker.Clear(); return ServiceResult<object>.Fail(ServiceFailure.Conflict, "The account or category state changed. Reload before retrying."); }
    }
}
