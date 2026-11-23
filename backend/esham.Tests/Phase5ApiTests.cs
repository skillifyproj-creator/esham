using System.Net;
using System.Net.Http.Json;
using System.Threading.RateLimiting;
using esham.BLL.Services;
using esham.DAL.Data;
using esham.DAL.Entities;
using esham.PL.Endpoints;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.EntityFrameworkCore;
using Xunit;
using static esham.Tests.AccountFinalizationTests;
namespace esham.Tests;
public sealed class Phase5ApiTests
{
    [Fact]public async Task Legacy_review_edit_uses_owned_purchase_precondition_and_preserves_null_attribution(){
        using var p=Services();using var scope=p.CreateScope();var s=scope.ServiceProvider;var f=await LearnerLearningTests.Setup(s,"both");var db=s.GetRequiredService<AppDbContext>();
        db.CourseReviews.Add(new(){EnrollmentId=f.Enrollment,Rating=4,Comment="A historical review whose version attribution is unknown."});await db.SaveChangesAsync();
        var b=WebApplication.CreateBuilder();b.WebHost.UseUrls("http://127.0.0.1:0");b.Logging.ClearProviders();
        b.Services.AddAuthentication("fixture").AddScheme<AuthenticationSchemeOptions,EnrollmentApiTests.FixtureAuthentication>("fixture",_=>{});b.Services.AddAuthorization();b.Services.AddSingleton(db);b.Services.AddSingleton(Phase5Tests.Reviews(s));
        await using var app=b.Build();app.UseAuthentication();app.UseAuthorization();app.MapLearnerReviewEndpoints();await app.StartAsync();
        try{using var c=new HttpClient{BaseAddress=new(app.Services.GetRequiredService<IServer>().Features.Get<IServerAddressesFeature>()!.Addresses.Single())};c.DefaultRequestHeaders.Add("X-Fixture-User",f.Purchase.Learner);c.DefaultRequestHeaders.Add("X-Requested-With","XMLHttpRequest");c.DefaultRequestHeaders.Add("X-Esham-Account-Id",f.Purchase.Learner);
            var path=$"/me/enrollments/{f.Enrollment}/review";var read=await c.GetFromJsonAsync<System.Text.Json.JsonElement>(path);
            Assert.Equal(System.Text.Json.JsonValueKind.Null,read.GetProperty("review").GetProperty("courseVersionId").ValueKind);Assert.Equal(f.Purchase.Version,read.GetProperty("purchasedCourseVersionId").GetGuid());
            var edited=await c.PutAsJsonAsync(path,Phase5Tests.Write(read.GetProperty("purchasedCourseVersionId").GetGuid(),read.GetProperty("review").GetProperty("version").GetString()));Assert.Equal(HttpStatusCode.OK,edited.StatusCode);
            Assert.Null((await db.CourseReviews.SingleAsync(x=>x.EnrollmentId==f.Enrollment)).CourseVersionId);Assert.All(await db.AdminActivityLogs.Where(x=>x.CourseId==f.Purchase.Course).ToListAsync(),x=>Assert.Null(x.CourseVersionId));
        }finally{await app.StopAsync();}
    }
    [Fact]public async Task Review_http_authorization_origin_session_binding_and_public_privacy(){
        using var p=Services();using var scope=p.CreateScope();var s=scope.ServiceProvider;var f=await LearnerLearningTests.Setup(s,"both");var db=s.GetRequiredService<AppDbContext>();
        var b=WebApplication.CreateBuilder();b.WebHost.UseUrls("http://127.0.0.1:0");b.Logging.ClearProviders();b.Configuration.AddInMemoryCollection(new Dictionary<string,string?>{["Cors:AllowedOrigins:0"]="http://localhost:5175"});
        b.Services.AddAuthentication("fixture").AddScheme<AuthenticationSchemeOptions,EnrollmentApiTests.FixtureAuthentication>("fixture",_=>{});b.Services.AddAuthorization();b.Services.AddSingleton(db);b.Services.AddSingleton(Phase5Tests.Reviews(s));
        await using var app=b.Build();app.UseAuthentication();app.UseAuthorization();app.MapLearnerReviewEndpoints();await app.StartAsync();
        try{using var c=new HttpClient{BaseAddress=new(app.Services.GetRequiredService<IServer>().Features.Get<IServerAddressesFeature>()!.Addresses.Single())};var path=$"/me/enrollments/{f.Enrollment}/review";var input=Phase5Tests.Write(f.Purchase.Version);
            Assert.Equal(HttpStatusCode.Unauthorized,(await c.GetAsync(path)).StatusCode);c.DefaultRequestHeaders.Add("X-Fixture-User",f.Purchase.Owner);Assert.Equal(HttpStatusCode.Forbidden,(await c.GetAsync(path)).StatusCode);
            c.DefaultRequestHeaders.Remove("X-Fixture-User");c.DefaultRequestHeaders.Add("X-Fixture-User",f.Purchase.Learner);Assert.Equal(HttpStatusCode.Forbidden,(await c.PutAsJsonAsync(path,input)).StatusCode);
            c.DefaultRequestHeaders.Add("X-Requested-With","XMLHttpRequest");c.DefaultRequestHeaders.Add("Origin","http://evil.test");c.DefaultRequestHeaders.Add("X-Esham-Account-Id",f.Purchase.Learner);Assert.Equal(HttpStatusCode.Forbidden,(await c.PutAsJsonAsync(path,input)).StatusCode);
            c.DefaultRequestHeaders.Remove("Origin");c.DefaultRequestHeaders.Add("Origin","http://localhost:5175");c.DefaultRequestHeaders.Remove("X-Esham-Account-Id");c.DefaultRequestHeaders.Add("X-Esham-Account-Id",f.Purchase.Owner);Assert.Equal(HttpStatusCode.Conflict,(await c.PutAsJsonAsync(path,input)).StatusCode);
            c.DefaultRequestHeaders.Remove("X-Esham-Account-Id");c.DefaultRequestHeaders.Add("X-Esham-Account-Id",f.Purchase.Learner);var saved=await c.PutAsJsonAsync(path,input);Assert.Equal(HttpStatusCode.OK,saved.StatusCode);Assert.Contains("no-store",saved.Headers.CacheControl!.ToString());
            c.DefaultRequestHeaders.Remove("X-Fixture-User");var publicReview=await c.GetStringAsync($"/api/courses/public/{f.Purchase.Course}/reviews");Assert.DoesNotContain("accountId",publicReview);Assert.DoesNotContain("enrollmentId",publicReview);Assert.DoesNotContain(f.Purchase.Learner,publicReview);Assert.DoesNotContain("@",publicReview);
        }finally{await app.StopAsync();}
    }
    [Fact]public async Task Recovery_http_is_generic_private_capture_is_not_routable_and_throttling_applies(){
        using var p=Services();using var scope=p.CreateScope();var s=scope.ServiceProvider;var user=await Seed(s);var b=WebApplication.CreateBuilder();b.WebHost.UseUrls("http://127.0.0.1:0");b.Logging.ClearProviders();
        b.Services.AddAuthentication("fixture").AddScheme<AuthenticationSchemeOptions,EnrollmentApiTests.FixtureAuthentication>("fixture",_=>{});b.Services.AddAuthorization();b.Services.AddSingleton(Phase5Tests.Security(s,new()));b.Services.AddSingleton<IPhase5MutationGate>(new Phase5Tests.MemoryGate(s.GetRequiredService<AppDbContext>()));b.Services.AddSingleton(s.GetRequiredService<SignInManager<ApplicationUser>>());
        b.Services.AddRateLimiter(o=>{o.RejectionStatusCode=429;o.AddFixedWindowLimiter("account-security",x=>{x.PermitLimit=2;x.Window=TimeSpan.FromMinutes(15);x.QueueLimit=0;});});
        await using var app=b.Build();app.UseAuthentication();app.UseAuthorization();app.UseRateLimiter();app.MapAccountSecurityEndpoints();await app.StartAsync();
        try{using var c=new HttpClient{BaseAddress=new(app.Services.GetRequiredService<IServer>().Features.Get<IServerAddressesFeature>()!.Addresses.Single())};c.DefaultRequestHeaders.Add("X-Requested-With","XMLHttpRequest");
            var email=(await s.GetRequiredService<UserManager<ApplicationUser>>().FindByIdAsync(user))!.Email;
            var known=await c.PostAsJsonAsync("/auth/forgot-password",new{email});var missing=await c.PostAsJsonAsync("/auth/forgot-password",new{email="missing@example.test"});Assert.Equal(HttpStatusCode.Accepted,known.StatusCode);Assert.Equal(known.StatusCode,missing.StatusCode);Assert.Equal(await known.Content.ReadAsStringAsync(),await missing.Content.ReadAsStringAsync());
            Assert.Equal((HttpStatusCode)429,(await c.PostAsJsonAsync("/auth/forgot-password",new{email})).StatusCode);Assert.Equal(HttpStatusCode.NotFound,(await c.GetAsync("/development/recovery-capture")).StatusCode);
        }finally{await app.StopAsync();}
    }
}
