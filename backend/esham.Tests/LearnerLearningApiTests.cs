using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using esham.BLL.Interfaces;
using esham.BLL.Services;
using esham.DAL.Data;
using esham.PL.Endpoints;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Xunit;
using static esham.Tests.AccountFinalizationTests;
namespace esham.Tests;
public sealed class LearnerLearningApiTests
{
    [Fact] public async Task Protected_http_media_range_head_origin_account_and_completion_contracts()
    {
        using var provider = Services(); using var scope = provider.CreateScope(); var s = scope.ServiceProvider; var f = await LearnerLearningTests.Setup(s, "both");
        var builder = WebApplication.CreateBuilder(); builder.WebHost.UseUrls("http://127.0.0.1:0"); builder.Logging.ClearProviders();
        builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?> { ["Cors:AllowedOrigins:0"] = "http://localhost:5175" });
        builder.Services.AddAuthentication("fixture").AddScheme<AuthenticationSchemeOptions, EnrollmentApiTests.FixtureAuthentication>("fixture", _ => { }); builder.Services.AddAuthorization();
        builder.Services.AddSingleton<ILearnerLearningService>(LearnerLearningTests.Reads(s)); builder.Services.AddSingleton<ILessonProgressService>(LearnerLearningTests.Writes(s));
        await using var app = builder.Build(); app.UseAuthentication(); app.UseAuthorization(); app.MapLearnerLearningEndpoints(); await app.StartAsync();
        try
        {
            using var client = new HttpClient { BaseAddress = new Uri(app.Services.GetRequiredService<IServer>().Features.Get<IServerAddressesFeature>()!.Addresses.Single()) };
            var root = $"/me/enrollments/{f.Enrollment}/learning/lessons/{f.Lesson}";
            Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync(root + "/video")).StatusCode);
            client.DefaultRequestHeaders.Add("X-Fixture-User", f.Purchase.Owner);
            Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync(root + "/video")).StatusCode);
            client.DefaultRequestHeaders.Remove("X-Fixture-User"); client.DefaultRequestHeaders.Add("X-Fixture-User", f.Purchase.Learner);
            var lesson = await client.GetStringAsync(root); Assert.DoesNotContain("storageKey", lesson, StringComparison.OrdinalIgnoreCase); Assert.DoesNotContain("ContentHash", lesson, StringComparison.OrdinalIgnoreCase);
            using var range = new HttpRequestMessage(HttpMethod.Get, root + "/video"); range.Headers.Range = new RangeHeaderValue(0, 9);
            var response = await client.SendAsync(range); Assert.Equal(HttpStatusCode.PartialContent, response.StatusCode); Assert.Equal(10, (await response.Content.ReadAsByteArrayAsync()).Length); Assert.True(response.Headers.CacheControl!.NoStore);
            var head = await client.SendAsync(new HttpRequestMessage(HttpMethod.Head, root + "/video")); Assert.Equal(HttpStatusCode.OK, head.StatusCode); Assert.Empty(await head.Content.ReadAsByteArrayAsync()); Assert.Equal(512, head.Content.Headers.ContentLength);
            var download = await client.GetAsync(root + $"/attachments/{f.Attachment}/content"); Assert.Equal("attachment", download.Content.Headers.ContentDisposition!.DispositionType);
            Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync(root + $"/attachments/{Guid.NewGuid()}/content")).StatusCode);
            var complete = root + "/completion"; var payload = new { expectedCourseVersionId = f.Purchase.Version };
            Assert.Equal(HttpStatusCode.Forbidden, (await client.PutAsJsonAsync(complete, payload)).StatusCode);
            client.DefaultRequestHeaders.Add("X-Requested-With", "XMLHttpRequest"); client.DefaultRequestHeaders.Add("Origin", "http://evil.test"); client.DefaultRequestHeaders.Add("X-Esham-Account-Id", f.Purchase.Learner);
            Assert.Equal(HttpStatusCode.Forbidden, (await client.PutAsJsonAsync(complete, payload)).StatusCode);
            client.DefaultRequestHeaders.Remove("Origin"); client.DefaultRequestHeaders.Add("Origin", "http://localhost:5175");
            client.DefaultRequestHeaders.Remove("X-Esham-Account-Id"); client.DefaultRequestHeaders.Add("X-Esham-Account-Id", f.Purchase.Owner);
            Assert.Equal(HttpStatusCode.Conflict, (await client.PutAsJsonAsync(complete, payload)).StatusCode);
            client.DefaultRequestHeaders.Remove("X-Esham-Account-Id"); client.DefaultRequestHeaders.Add("X-Esham-Account-Id", f.Purchase.Learner);
            Assert.Equal(HttpStatusCode.OK, (await client.PutAsJsonAsync(complete, payload)).StatusCode);
        }
        finally { await app.StopAsync(); }
    }
}
