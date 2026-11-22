using esham.DAL.Entities;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;

namespace esham.PL.Endpoints;

public static class AccountCookieValidation
{
    public static void Configure(CookieAuthenticationOptions options)
    {
        // Fixed ticket lifetime: a delayed passive response must not extend/reissue an old login.
        options.SlidingExpiration=false;
        options.Events.OnValidatePrincipal=ValidateAsync;
    }
    public static async Task ValidateAsync(CookieValidatePrincipalContext context)
    {
        // Keep Identity's security-stamp verification and claims refresh, with its
        // validation interval configured to zero for next-request invalidation.
        await SecurityStampValidator.ValidatePrincipalAsync(context);
        // Keep refreshed claims in this request and validate again next request. Only explicit
        // sign-in/profile actions may issue a new ticket; stale GETs cannot restore old cookies.
        context.ShouldRenew=false;
        if (context.Principal?.Identity?.IsAuthenticated != true) return;
        var manager = context.HttpContext.RequestServices.GetRequiredService<UserManager<ApplicationUser>>();
        var user = await manager.GetUserAsync(context.Principal);
        if (user is not null && !await manager.IsLockedOutAsync(user)) return;
        context.RejectPrincipal();
        await context.HttpContext.SignOutAsync(IdentityConstants.ApplicationScheme);
    }
}
