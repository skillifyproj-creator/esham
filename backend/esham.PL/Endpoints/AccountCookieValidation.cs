using esham.DAL.Entities;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;

namespace esham.PL.Endpoints;

public static class AccountCookieValidation
{
    public static async Task ValidateAsync(CookieValidatePrincipalContext context)
    {
        // Keep Identity's security-stamp verification and claims refresh, with its
        // validation interval configured to zero for next-request invalidation.
        await SecurityStampValidator.ValidatePrincipalAsync(context);
        if (context.Principal?.Identity?.IsAuthenticated != true) return;
        var manager = context.HttpContext.RequestServices.GetRequiredService<UserManager<ApplicationUser>>();
        var user = await manager.GetUserAsync(context.Principal);
        if (user is not null && !await manager.IsLockedOutAsync(user)) return;
        context.RejectPrincipal();
        await context.HttpContext.SignOutAsync(IdentityConstants.ApplicationScheme);
    }
}
