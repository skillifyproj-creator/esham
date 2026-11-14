using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Encodings.Web;
using esham.BLL.Interfaces;
using esham.BLL.Services;
using esham.DAL.Data;
using esham.PL.Endpoints;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Xunit;
using static esham.Tests.AccountFinalizationTests;
namespace esham.Tests;

public sealed class EnrollmentApiTests
{
    [Fact] public async Task Http_auth_origin_account_binding_gate_and_replay_contracts_are_enforced()
    {
        using var fixture = Services(); using var scope = fixture.CreateScope(); var s = scope.ServiceProvider;
        var d = await EnrollmentTests.Setup(s); var gate = new MemoryGate(s.GetRequiredService<AppDbContext>());
        var builder = WebApplication.CreateBuilder(); builder.WebHost.UseUrls("http://127.0.0.1:0");
        builder.Logging.ClearProviders();
        builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?> { ["Cors:AllowedOrigins:0"] = "http://localhost:5175" });
        builder.Services.AddAuthentication("fixture").AddScheme<AuthenticationSchemeOptions, FixtureAuthentication>("fixture", _ => { });
        builder.Services.AddAuthorization();
        builder.Services.AddSingleton<IEnrollmentService>(EnrollmentTests.Service(s, gate));
        builder.Services.AddSingleton<IWalletService>(new WalletService(s.GetRequiredService<AppDbContext>(), s.GetRequiredService<Microsoft.AspNetCore.Identity.UserManager<esham.DAL.Entities.ApplicationUser>>()));
        await using var app = builder.Build(); app.UseAuthentication(); app.UseAuthorization(); app.MapEnrollmentEndpoints(); app.MapWalletEndpoints(); await app.StartAsync();
        try
        {
            var address = app.Services.GetRequiredService<IServer>().Features.Get<IServerAddressesFeature>()!.Addresses.Single();
            using var client = new HttpClient { BaseAddress = new Uri(address) };
            Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/me/wallet")).StatusCode);
            client.DefaultRequestHeaders.Add("X-Fixture-User", d.Owner);
            Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/me/enrollments")).StatusCode);
            client.DefaultRequestHeaders.Remove("X-Fixture-User"); client.DefaultRequestHeaders.Add("X-Fixture-User", d.Learner);
            var privateWallet = await client.GetAsync("/me/wallet");
            Assert.True(privateWallet.Headers.CacheControl!.NoStore); Assert.True(privateWallet.Headers.CacheControl.Private);
            var request = d.Request();
            Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync("/me/enrollments", request)).StatusCode);
            client.DefaultRequestHeaders.Add("X-Requested-With", "XMLHttpRequest"); client.DefaultRequestHeaders.Add("Origin", "https://untrusted.example");
            client.DefaultRequestHeaders.Add("X-Esham-Account-Id", d.Learner);
            Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync("/me/enrollments", request)).StatusCode);
            client.DefaultRequestHeaders.Remove("Origin"); client.DefaultRequestHeaders.Add("Origin", "http://localhost:5175");
            client.DefaultRequestHeaders.Remove("X-Esham-Account-Id"); client.DefaultRequestHeaders.Add("X-Esham-Account-Id", d.Owner);
            Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync("/me/enrollments", request)).StatusCode);
            client.DefaultRequestHeaders.Remove("X-Esham-Account-Id"); client.DefaultRequestHeaders.Add("X-Esham-Account-Id", d.Learner);
            Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync("/me/enrollments", request)).StatusCode); // Gate off.
            gate.Enabled = true;
            Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/me/enrollments", new { request.CourseId, request.ExpectedPublishedVersionId, request.RequestId, UserId = d.Owner, Price = 0 })).StatusCode);
            var first = await client.PostAsJsonAsync("/me/enrollments", request); Assert.Equal(HttpStatusCode.Created, first.StatusCode);
            Assert.NotNull(first.Headers.Location); Assert.DoesNotContain("operationKey", await first.Content.ReadAsStringAsync(), StringComparison.OrdinalIgnoreCase);
            Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync("/me/enrollments", request)).StatusCode);
            Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync("/me/enrollments", d.Request())).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await client.GetAsync(first.Headers.Location)).StatusCode);
            Assert.DoesNotContain("operationKey", await client.GetStringAsync("/me/wallet/transactions"), StringComparison.OrdinalIgnoreCase);
        }
        finally { await app.StopAsync(); }
    }
    private sealed class MemoryGate(AppDbContext db) : IEnrollmentPurchaseGate
    {
        public bool Enabled;
        public Task<bool> IsEnabledAsync(CancellationToken ct = default) => db.Database.IsInMemory() ? Task.FromResult(Enabled) : throw new InvalidOperationException("InMemory only.");
    }
    public sealed class FixtureAuthentication(IOptionsMonitor<AuthenticationSchemeOptions> options, ILoggerFactory logger, UrlEncoder encoder)
        : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
    {
        protected override Task<AuthenticateResult> HandleAuthenticateAsync()
        {
            var id = Request.Headers["X-Fixture-User"].ToString();
            return Task.FromResult(string.IsNullOrEmpty(id) ? AuthenticateResult.NoResult() : AuthenticateResult.Success(new AuthenticationTicket(Principal(id), Scheme.Name)));
        }
    }
}
