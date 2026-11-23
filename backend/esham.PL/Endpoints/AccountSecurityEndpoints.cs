using esham.BLL.Services;
using esham.BLL.DTOs;
using esham.DAL.Entities;
using Microsoft.AspNetCore.Identity;
namespace esham.PL.Endpoints;
public static class AccountSecurityEndpoints
{
    public static IEndpointRouteBuilder MapAccountSecurityEndpoints(this IEndpointRouteBuilder routes){
        routes.MapGet("/me/phase5",async(HttpContext c,IPhase5MutationGate gate,CancellationToken ct)=>Results.Ok(new{AccountId=c.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value,ReviewsEnabled=await gate.IsEnabledAsync(Phase5Capability.Reviews,ct),AccountSecurityEnabled=await gate.IsEnabledAsync(Phase5Capability.AccountSecurity,ct),AnnouncementDeliveryEnabled=await gate.IsEnabledAsync(Phase5Capability.AnnouncementDelivery,ct)})).RequireAuthorization().AddEndpointFilter<FinancialResponseFilter>();
        var auth=routes.MapGroup("/auth").AddEndpointFilter<AdminMutationFilter>().AddEndpointFilter<FinancialResponseFilter>().RequireRateLimiting("account-security");
        auth.MapPost("/forgot-password",async(PasswordForgot input,AccountSecurityService s,CancellationToken ct)=>{var r=await s.ForgotAsync(input,ct);return r.Failure==ServiceFailure.None?Results.Accepted(value:new{deliveryMode="isolated_capture"}):r.Code=="recovery_delivery_unavailable"?Results.Problem(statusCode:503,title:"Recovery delivery is not configured."):r.ToHttp();}).AllowAnonymous();
        auth.MapPost("/reset-password",async(PasswordReset input,AccountSecurityService s,CancellationToken ct)=>{var r=await s.ResetAsync(input,ct);return r.Failure==ServiceFailure.None?Results.NoContent():r.ToHttp();}).AllowAnonymous();
        var me=routes.MapGroup("/me").RequireAuthorization().AddEndpointFilter<AdminMutationFilter>().AddEndpointFilter<EnrollmentAccountFilter>().AddEndpointFilter<FinancialResponseFilter>().RequireRateLimiting("account-security");
        me.MapPost("/password",async(PasswordChange input,HttpContext c,AccountSecurityService s,SignInManager<ApplicationUser> signIn,CancellationToken ct)=>{var r=await s.PasswordAsync(c.User,input,ct);if(r.Failure!=ServiceFailure.None)return r.ToHttp();await signIn.SignOutAsync();return Results.NoContent();});
        me.MapPost("/sessions/revoke-all",async(SessionRevoke input,HttpContext c,AccountSecurityService s,SignInManager<ApplicationUser> signIn,CancellationToken ct)=>{var r=await s.RevokeAsync(c.User,input,ct);if(r.Failure!=ServiceFailure.None)return r.ToHttp();await signIn.SignOutAsync();return Results.NoContent();});
        return routes;
    }
}
