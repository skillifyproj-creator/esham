using System.Security.Claims;
using esham.BLL.DTOs;
using esham.DAL.Entities;
using Microsoft.AspNetCore.Identity;
namespace esham.BLL.Services;

internal static class FinancialAccess
{
    internal static bool ValidPage(int page, int size) => page >= 1 && size is >= 1 and <= 100 && (long)(page - 1) * size <= int.MaxValue;
    internal static async Task<(ApplicationUser? User, ServiceFailure Failure)> Check(UserManager<ApplicationUser> users, ClaimsPrincipal actor, params string[] roles)
    {
        if (actor.Identity?.IsAuthenticated != true) return (null, ServiceFailure.Unauthenticated);
        var user = await users.GetUserAsync(actor);
        if (user is null || await users.IsLockedOutAsync(user)) return (null, ServiceFailure.Unauthenticated);
        var actual = await users.GetRolesAsync(user);
        return roles.Any(x => actual.Contains(x, StringComparer.OrdinalIgnoreCase)) ? (user, ServiceFailure.None) : (null, ServiceFailure.Forbidden);
    }
}
