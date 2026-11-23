using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using esham.BLL.Interfaces;
using esham.BLL.Services;
using esham.DAL.Data;
using esham.DAL.Entities;
using esham.PL.Endpoints;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Xunit;
namespace esham.Tests;

public sealed class SessionRenewalTests
{
    internal sealed record User(string Id,string Email);
    internal static async Task<(WebApplication App,Uri Address,User A,User B)> Server(TaskCompletionSource entered,TaskCompletionSource release){
        var b=WebApplication.CreateBuilder();b.WebHost.UseUrls("http://127.0.0.1:0");b.Logging.ClearProviders();b.Services.AddDataProtection().UseEphemeralDataProtectionProvider();
        var database=Guid.NewGuid().ToString();b.Services.AddDbContext<AppDbContext>(o=>o.UseInMemoryDatabase(database).ReplaceService<Microsoft.EntityFrameworkCore.Storage.IDbContextTransactionManager,TestTransactionManager>());
        b.Services.AddIdentity<ApplicationUser,IdentityRole>().AddEntityFrameworkStores<AppDbContext>().AddDefaultTokenProviders();b.Services.AddAuthorization();b.Services.AddScoped<IAccountService,AccountService>();b.Services.AddScoped<INotificationWriter,NotificationWriter>();
        b.Services.Configure<SecurityStampValidatorOptions>(o=>o.ValidationInterval=TimeSpan.Zero);
        b.Services.AddScoped<IPhase5MutationGate>(s=>new Phase5Tests.MemoryGate(s.GetRequiredService<AppDbContext>()));b.Services.AddScoped<AccountSecurityService>();b.Services.AddSingleton<PrivateRecoveryCapture>();b.Services.Configure<Phase5Options>(o=>o.PrivateRecoveryCaptureEnabled=true);
        b.Services.AddRateLimiter(o=>o.AddFixedWindowLimiter("account-security",x=>{x.PermitLimit=100;x.Window=TimeSpan.FromMinutes(15);x.QueueLimit=0;}));
        b.Services.ConfigureApplicationCookie(o=>{o.Cookie.Name="Esham.Identity";AccountCookieValidation.Configure(o);o.Events.OnRedirectToLogin=c=>{c.Response.StatusCode=401;return Task.CompletedTask;};});
        var app=b.Build();app.UseAuthentication();app.UseAuthorization();app.UseRateLimiter();app.MapAccountEndpoints();app.MapAccountSecurityEndpoints();
        app.MapGet("/delayed",async(HttpContext c)=>{entered.TrySetResult();await release.Task.WaitAsync(TimeSpan.FromSeconds(15));return Results.Ok(new{id=c.User.FindFirstValue(ClaimTypes.NameIdentifier)});}).RequireAuthorization();
        app.MapGet("/current-roles",(HttpContext c)=>Results.Ok(new{instructor=c.User.IsInRole("Instructor")})).RequireAuthorization();
        User a,bb;using(var scope=app.Services.CreateScope()){var s=scope.ServiceProvider;var roles=s.GetRequiredService<RoleManager<IdentityRole>>();await roles.CreateAsync(new("Learner"));await roles.CreateAsync(new("Instructor"));var users=s.GetRequiredService<UserManager<ApplicationUser>>();
            async Task<User> Create(string label){var u=new ApplicationUser{UserName=label+Guid.NewGuid().ToString("N"),Email=Guid.NewGuid()+"@example.test",Name="Synthetic session user",Role="learner",Goal=0,Interests=[0]};Assert.True((await users.CreateAsync(u,AccountFinalizationTests.Password)).Succeeded);await users.AddToRoleAsync(u,"Learner");return new(u.Id,u.Email!);}
            a=await Create("a");bb=await Create("b");
        }
        await app.StartAsync();return(app,new(app.Services.GetRequiredService<IServer>().Features.Get<IServerAddressesFeature>()!.Addresses.Single()),a,bb);
    }
    internal static async Task Login(HttpClient c,User u){Assert.Equal(HttpStatusCode.OK,(await c.PostAsJsonAsync("/auth/login",new{email=u.Email,password=AccountFinalizationTests.Password})).StatusCode);}
    [Theory][InlineData(false)][InlineData(true)]
    public async Task Delayed_passive_response_cannot_restore_logged_out_or_previous_account_cookie(bool switchAccount){
        var entered=new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);var release=new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);var server=await Server(entered,release);await using var app=server.App;
        using var handler=new HttpClientHandler{CookieContainer=new CookieContainer(),AllowAutoRedirect=false};using var client=new HttpClient(handler){BaseAddress=server.Address};
        try{await Login(client,server.A);var delayed=client.GetAsync("/delayed");await entered.Task.WaitAsync(TimeSpan.FromSeconds(10));
            Assert.Equal(HttpStatusCode.NoContent,(await client.PostAsync("/auth/logout",null)).StatusCode);if(switchAccount)await Login(client,server.B);
            release.TrySetResult();var old=await delayed;
            var current=await client.GetAsync("/auth/session");
            if(!switchAccount)Assert.Equal(HttpStatusCode.Unauthorized,current.StatusCode);
            else {Assert.Equal(HttpStatusCode.OK,current.StatusCode);var json=await current.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();Assert.Equal(server.B.Id,json.GetProperty("profile").GetProperty("id").GetString());}
            Assert.False(old.Headers.Contains("Set-Cookie"));
        }finally{release.TrySetResult();await app.StopAsync();}
    }
    [Fact]public async Task Stamp_lockout_and_claim_refresh_remain_authoritative_without_renewing_passive_cookies(){
        var server=await Server(new(),new());await using var app=server.App;using var client=new HttpClient(new HttpClientHandler{CookieContainer=new(),AllowAutoRedirect=false}){BaseAddress=server.Address};
        try{await Login(client,server.A);
            using(var scope=app.Services.CreateScope()){var users=scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();await users.AddToRoleAsync((await users.FindByIdAsync(server.A.Id))!,"Instructor");}
            var roles=await client.GetAsync("/current-roles");Assert.True((await roles.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>()).GetProperty("instructor").GetBoolean());Assert.False(roles.Headers.Contains("Set-Cookie"));
            using(var scope=app.Services.CreateScope()){var users=scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();await users.UpdateSecurityStampAsync((await users.FindByIdAsync(server.A.Id))!);}
            Assert.Equal(HttpStatusCode.Unauthorized,(await client.GetAsync("/auth/session")).StatusCode);
            await Login(client,server.B);using(var scope=app.Services.CreateScope()){var users=scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();await users.SetLockoutEndDateAsync((await users.FindByIdAsync(server.B.Id))!,DateTimeOffset.UtcNow.AddHours(1));}
            Assert.Equal(HttpStatusCode.Unauthorized,(await client.GetAsync("/auth/session")).StatusCode);
        }finally{await app.StopAsync();}
    }
    [Fact]public async Task Older_than_half_lifetime_ticket_is_valid_without_sliding_or_renewal(){
        var server=await Server(new(),new());await using var app=server.App;var jar=new CookieContainer();using var client=new HttpClient(new HttpClientHandler{CookieContainer=jar,AllowAutoRedirect=false}){BaseAddress=server.Address};
        try{await Login(client,server.A);var options=app.Services.GetRequiredService<IOptionsMonitor<CookieAuthenticationOptions>>().Get(IdentityConstants.ApplicationScheme);Assert.False(options.SlidingExpiration);
            var cookie=jar.GetCookies(server.Address)["Esham.Identity"]!;var ticket=options.TicketDataFormat.Unprotect(cookie.Value)!;
            ticket.Properties.IssuedUtc=DateTimeOffset.UtcNow.AddDays(-10);ticket.Properties.ExpiresUtc=DateTimeOffset.UtcNow.AddDays(4);cookie.Value=options.TicketDataFormat.Protect(ticket);jar.Add(server.Address,cookie);
            var response=await client.GetAsync("/auth/session");Assert.Equal(HttpStatusCode.OK,response.StatusCode);Assert.False(response.Headers.Contains("Set-Cookie"));
        }finally{await app.StopAsync();}
    }
}
