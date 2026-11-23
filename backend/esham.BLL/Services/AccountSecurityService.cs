using System.ComponentModel.DataAnnotations;
using System.Data;
using System.Security.Claims;
using System.Text.Json;
using esham.BLL.DTOs;
using esham.DAL.Data;
using esham.DAL.Entities;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
namespace esham.BLL.Services;

// Private memory capture with optional explicitly isolated file export; no HTTP retrieval or token logging.
public sealed class PrivateRecoveryCapture(string? isolatedDirectory=null)
{
    private readonly System.Collections.Concurrent.ConcurrentDictionary<string,(string Token,DateTimeOffset Expires)> records=new();
    public bool Available { get { foreach(var r in records.Where(x=>x.Value.Expires<=DateTimeOffset.UtcNow))records.TryRemove(r.Key,out _);return records.Count<1000; } }
    internal void Deliver(string email,string token){
        var expires=DateTimeOffset.UtcNow.AddMinutes(30);records[email]=(token,expires);
        if(isolatedDirectory!=null){Directory.CreateDirectory(isolatedDirectory);var name=Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(email)));File.WriteAllText(Path.Combine(isolatedDirectory,name+".json"),JsonSerializer.Serialize(new{token,expires}));}
    }
    public string? TakeForIsolatedTest(string email)=>records.TryRemove(email,out var r)&&r.Expires>DateTimeOffset.UtcNow?r.Token:null;
}
public sealed record PasswordChange(string? CurrentPassword,string? Password);
public sealed record PasswordReset(string? Token,string? Password);
public sealed record PasswordForgot(string? Email);
public sealed record SessionRevoke(string? CurrentPassword);
public sealed class AccountSecurityService(AppDbContext db,UserManager<ApplicationUser> users,SignInManager<ApplicationUser> signIn,
    IPhase5MutationGate gate,IDataProtectionProvider protection,IOptions<Phase5Options> options,PrivateRecoveryCapture capture)
{
    private sealed record Recovery(string UserId,string IdentityToken);
    private readonly ITimeLimitedDataProtector protector=protection.CreateProtector("ESHAM.Phase5.PasswordRecovery.v1").ToTimeLimitedDataProtector();
    private static ServiceResult<bool> Fail(ServiceFailure f,string code)=>ServiceResult<bool>.Fail(f,code.Replace('_',' '),code);
    private static bool ValidNewPassword(string? password)=>password is{Length:>=8 and <=256}&&password.Any(char.IsLetter)&&password.Any(char.IsDigit);
    public async Task<ServiceResult<bool>> ForgotAsync(PasswordForgot input,CancellationToken ct=default){
        if(!await gate.IsEnabledAsync(Phase5Capability.AccountSecurity,ct))return Fail(ServiceFailure.Forbidden,"phase5_account_disabled");
        if(!options.Value.PrivateRecoveryCaptureEnabled||!capture.Available)return Fail(ServiceFailure.Conflict,"recovery_delivery_unavailable");
        if(string.IsNullOrWhiteSpace(input.Email)||input.Email.Length>256||!new EmailAddressAttribute().IsValid(input.Email))return Fail(ServiceFailure.Validation,"invalid_email");
        var user=await users.FindByEmailAsync(input.Email.Trim());
        if(user!=null&&!await users.IsLockedOutAsync(user)){
            var token=await users.GeneratePasswordResetTokenAsync(user);
            capture.Deliver(user.Email!,protector.Protect(JsonSerializer.Serialize(new Recovery(user.Id,token)),TimeSpan.FromMinutes(30)));
        }
        return ServiceResult<bool>.Ok(true);
    }
    public async Task<ServiceResult<bool>> ResetAsync(PasswordReset input,CancellationToken ct=default){
        if(!await gate.IsEnabledAsync(Phase5Capability.AccountSecurity,ct))return Fail(ServiceFailure.Forbidden,"phase5_account_disabled");
        Recovery? recovery;try{if(input.Token==null||input.Token.Length>10000)return Fail(ServiceFailure.Validation,"invalid_reset");recovery=JsonSerializer.Deserialize<Recovery>(protector.Unprotect(input.Token,out _));}catch(Exception e)when(e is System.Security.Cryptography.CryptographicException or JsonException or FormatException or ArgumentException){return Fail(ServiceFailure.Validation,"invalid_reset");}
        if(recovery==null||!ValidNewPassword(input.Password))return Fail(ServiceFailure.Validation,"invalid_reset");
        return await Change(recovery.UserId,async u=>{
            if(await users.IsLockedOutAsync(u))return Fail(ServiceFailure.Validation,"invalid_reset");
            var r=await users.ResetPasswordAsync(u,recovery.IdentityToken,input.Password!);return r.Succeeded?ServiceResult<bool>.Ok(true):Fail(ServiceFailure.Validation,"invalid_reset");
        },ct);
    }
    public async Task<ServiceResult<bool>> PasswordAsync(ClaimsPrincipal actor,PasswordChange input,CancellationToken ct=default)=>await AuthenticateChange(actor,input.CurrentPassword,input.Password,false,ct);
    public async Task<ServiceResult<bool>> RevokeAsync(ClaimsPrincipal actor,SessionRevoke input,CancellationToken ct=default)=>await AuthenticateChange(actor,input.CurrentPassword,null,true,ct);
    private async Task<ServiceResult<bool>> AuthenticateChange(ClaimsPrincipal actor,string? current,string? password,bool revoke,CancellationToken ct){
        if(actor.Identity?.IsAuthenticated!=true||users.GetUserId(actor) is not string id)return Fail(ServiceFailure.Unauthenticated,"session_expired");
        if(string.IsNullOrEmpty(current)||!revoke&&(!ValidNewPassword(password)||password==current))return Fail(ServiceFailure.Validation,"invalid_password");
        return await Change(id,async u=>{
            if(await signIn.ValidateSecurityStampAsync(actor)==null||await users.IsLockedOutAsync(u))return Fail(ServiceFailure.Unauthenticated,"session_expired");
            var verified=await signIn.CheckPasswordSignInAsync(u,current,true);
            if(!verified.Succeeded)return Fail(ServiceFailure.Unauthenticated,"password_confirmation_failed");
            var result=revoke?await users.UpdateSecurityStampAsync(u):await users.ChangePasswordAsync(u,current,password!);
            return result.Succeeded?ServiceResult<bool>.Ok(true):Fail(ServiceFailure.Validation,"invalid_password");
        },ct);
    }
    private async Task<ServiceResult<bool>> Change(string id,Func<ApplicationUser,Task<ServiceResult<bool>>> change,CancellationToken ct){
        if(!await gate.IsEnabledAsync(Phase5Capability.AccountSecurity,ct))return Fail(ServiceFailure.Forbidden,"phase5_account_disabled");
        try{return await db.Database.CreateExecutionStrategy().ExecuteAsync(async()=>{
            db.ChangeTracker.Clear();await using var tx=await db.Database.BeginTransactionAsync(IsolationLevel.Serializable,ct);
            if(!await gate.IsEnabledAsync(Phase5Capability.AccountSecurity,ct))return Fail(ServiceFailure.Forbidden,"phase5_account_disabled");
            var u=await (db.Database.IsSqlServer()?db.Users.FromSqlInterpolated($"SELECT * FROM [AspNetUsers] WITH (UPDLOCK,HOLDLOCK) WHERE [Id]={id}"):db.Users).SingleOrDefaultAsync(x=>x.Id==id,ct);
            if(u==null)return Fail(ServiceFailure.Unauthenticated,"session_expired");
            var result=await change(u);
            // Failed confirmation counters/lockouts deliberately commit; password/stamp failures throw through Identity EF concurrency handling.
            await tx.CommitAsync(ct);return result;
        });}finally{db.ChangeTracker.Clear();}
    }
}
