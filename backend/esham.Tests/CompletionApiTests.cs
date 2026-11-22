using System.Net;
using System.Net.Http.Json;
using System.Threading.RateLimiting;
using esham.BLL.Services;
using esham.DAL.Data;
using esham.PL.Endpoints;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Xunit;
using static esham.Tests.AccountFinalizationTests;
namespace esham.Tests;
public sealed class CompletionApiTests
{
    [Fact]public async Task Completion_http_auth_origin_account_privacy_and_rate_limits(){
        using var provider=Services();using var scope=provider.CreateScope();var s=scope.ServiceProvider;var f=await LearnerLearningTests.Setup(s,"both");await CompletionTests.Earn(s.GetRequiredService<AppDbContext>(),f);
        var builder=WebApplication.CreateBuilder();builder.WebHost.UseUrls("http://127.0.0.1:0");builder.Logging.ClearProviders();
        builder.Configuration.AddInMemoryCollection(new Dictionary<string,string?>{["Cors:AllowedOrigins:0"]="http://localhost:5175"});
        builder.Services.AddAuthentication("fixture").AddScheme<AuthenticationSchemeOptions,EnrollmentApiTests.FixtureAuthentication>("fixture",_=>{});builder.Services.AddAuthorization();
        builder.Services.AddSingleton(CompletionTests.Service(s));builder.Services.AddSingleton(CompletionTests.Certificates(s));
        builder.Services.AddRateLimiter(o=>{o.RejectionStatusCode=429;o.AddFixedWindowLimiter("certificate-verification",x=>{x.PermitLimit=2;x.Window=TimeSpan.FromMinutes(1);x.QueueLimit=0;});});
        await using var app=builder.Build();app.UseAuthentication();app.UseAuthorization();app.UseRateLimiter();app.MapCompletionEndpoints();await app.StartAsync();
        try{using var client=new HttpClient{BaseAddress=new(app.Services.GetRequiredService<IServer>().Features.Get<IServerAddressesFeature>()!.Addresses.Single())};var root=$"/me/enrollments/{f.Enrollment}/completion";
            Assert.Equal(HttpStatusCode.Unauthorized,(await client.GetAsync(root)).StatusCode);
            client.DefaultRequestHeaders.Add("X-Fixture-User",f.Purchase.Owner);Assert.Equal(HttpStatusCode.Forbidden,(await client.GetAsync(root)).StatusCode);
            client.DefaultRequestHeaders.Remove("X-Fixture-User");client.DefaultRequestHeaders.Add("X-Fixture-User",f.Purchase.Learner);
            var payload=new{expectedCourseVersionId=f.Purchase.Version};Assert.Equal(HttpStatusCode.Forbidden,(await client.PostAsJsonAsync(root+"/reconcile",payload)).StatusCode);
            client.DefaultRequestHeaders.Add("X-Requested-With","XMLHttpRequest");client.DefaultRequestHeaders.Add("Origin","http://evil.test");client.DefaultRequestHeaders.Add("X-Esham-Account-Id",f.Purchase.Learner);
            Assert.Equal(HttpStatusCode.Forbidden,(await client.PostAsJsonAsync(root+"/reconcile",payload)).StatusCode);
            client.DefaultRequestHeaders.Remove("Origin");client.DefaultRequestHeaders.Add("Origin","http://localhost:5175");client.DefaultRequestHeaders.Remove("X-Esham-Account-Id");client.DefaultRequestHeaders.Add("X-Esham-Account-Id",f.Purchase.Owner);
            Assert.Equal(HttpStatusCode.Conflict,(await client.PostAsJsonAsync(root+"/reconcile",payload)).StatusCode);
            client.DefaultRequestHeaders.Remove("X-Esham-Account-Id");client.DefaultRequestHeaders.Add("X-Esham-Account-Id",f.Purchase.Learner);
            var completed=await client.PostAsJsonAsync(root+"/reconcile",payload);Assert.Equal(HttpStatusCode.OK,completed.StatusCode);Assert.Contains("no-store",completed.Headers.CacheControl!.ToString());
            var cert=(await CompletionTests.Certificates(s).ListAsync(Principal(f.Purchase.Learner),1,20)).Value!.Items.Single();
            client.DefaultRequestHeaders.Remove("X-Fixture-User");var verify=await client.GetAsync($"/certificates/verify/{cert.VerificationCode}");Assert.Equal(HttpStatusCode.OK,verify.StatusCode);var body=await verify.Content.ReadAsStringAsync();Assert.DoesNotContain("enrollmentId",body);Assert.DoesNotContain("accountId",body);Assert.DoesNotContain(cert.LearnerNameSnapshot,body);Assert.Contains("***",body);
            await client.GetAsync("/certificates/verify/invalid");Assert.Equal((HttpStatusCode)429,(await client.GetAsync("/certificates/verify/invalid")).StatusCode);
        }finally{await app.StopAsync();}
    }
}
