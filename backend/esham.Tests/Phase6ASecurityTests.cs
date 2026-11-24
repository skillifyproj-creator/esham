using System.Net;
using System.Net.Http.Json;
using esham.PL.Development;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace esham.Tests;
public sealed class Phase6ASecurityTests
{
    [Fact] public void Startup_seeding_is_opt_in_and_rejects_nonisolated_targets_without_opening_them()
    {
        var empty = new ConfigurationBuilder().Build();
        Assert.False(StartupSeedingPolicy.Requested(empty)); Assert.False(StartupSeedingPolicy.DemoRequested(empty));
        const string local = @"Server=(localdb)\MSSQLLocalDB;Database=Esham_AccountTests_Phase1_20261114;Integrated Security=true";
        StartupSeedingPolicy.ValidateTarget(true, local);
        Assert.Throws<InvalidOperationException>(() => StartupSeedingPolicy.ValidateTarget(false, local));
        Assert.Throws<InvalidOperationException>(() => StartupSeedingPolicy.ValidateTarget(true, @"Server=(localdb)\MSSQLLocalDB;Database=unapproved;Integrated Security=true"));
        Assert.Throws<InvalidOperationException>(() => StartupSeedingPolicy.ValidateTarget(true, "Server=remote.invalid;Database=db75401;Integrated Security=true"));
    }

    [Fact] public async Task Authentication_routes_enforce_origin_rate_limits_and_private_session_responses()
    {
        var server = await SessionRenewalTests.Server(new(), new(), 3); await using var app = server.App;
        using var client = new HttpClient(new HttpClientHandler { CookieContainer = new(), AllowAutoRedirect = false }) { BaseAddress = server.Address };
        try
        {
            Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync("/auth/login", new { email=server.A.Email, password=AccountFinalizationTests.Password })).StatusCode);
            client.DefaultRequestHeaders.Add("X-Requested-With", "XMLHttpRequest"); client.DefaultRequestHeaders.Add("Origin", "https://foreign.invalid");
            Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsync("/auth/logout", null)).StatusCode);
            client.DefaultRequestHeaders.Remove("Origin"); await SessionRenewalTests.Login(client, server.A);
            var session = await client.GetAsync("/auth/session"); Assert.Equal(HttpStatusCode.OK, session.StatusCode);
            Assert.True(session.Headers.CacheControl!.NoStore);
            Assert.Equal(HttpStatusCode.TooManyRequests, (await client.PostAsync("/auth/logout", null)).StatusCode);
        }
        finally { await app.StopAsync(); }
    }
}
