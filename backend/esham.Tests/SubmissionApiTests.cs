using System.Net;
using System.Net.Http.Json;
using System.Net.Http.Headers;
using esham.BLL.DTOs.Submissions;
using esham.BLL.Interfaces;
using esham.BLL.Services;
using esham.DAL.Data;
using esham.PL.Endpoints;
using esham.PL.Storage;
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
public sealed class SubmissionApiTests
{
    [Fact] public async Task Http_contracts_multipart_ownership_draft_privacy_and_assessment_notifications() {
        using var provider=Services();using var scope=provider.CreateScope();var s=scope.ServiceProvider;var f=await LearnerLearningTests.Setup(s,"both");var task=await LearnerSubmissionTests.AddTask(s,f.Purchase.Version);
        var db=s.GetRequiredService<AppDbContext>();var gate=new LearnerSubmissionTests.MemoryGate(db);var root=Path.Combine(AppContext.BaseDirectory,"api-unit",Guid.NewGuid().ToString("N"),"artifacts/phase2-isolated/media");
        using var writer=new SubmissionAttachmentWriter(db,gate,root);
        var builder=WebApplication.CreateBuilder();builder.WebHost.UseUrls("http://127.0.0.1:0");builder.Logging.ClearProviders();
        builder.Configuration.AddInMemoryCollection(new Dictionary<string,string?>{["Cors:AllowedOrigins:0"]="http://localhost:5175"});
        builder.Services.AddAuthentication("fixture").AddScheme<AuthenticationSchemeOptions,EnrollmentApiTests.FixtureAuthentication>("fixture",_=>{});builder.Services.AddAuthorization();
        builder.Services.AddSingleton<ILearnerSubmissionService>(LearnerSubmissionTests.Service(s,gate,writer));builder.Services.AddSingleton<ISubmissionMutationGate>(gate);
        builder.Services.AddSingleton(new InstructorInsightsService(db));builder.Services.AddSingleton<IMediaStorage>(new LocalMediaStorage(root));
        await using var app=builder.Build();app.UseAuthentication();app.UseAuthorization();app.MapLearnerSubmissionEndpoints();app.MapInstructorInsightsEndpoints();await app.StartAsync();
        try {
            using var client=new HttpClient{BaseAddress=new Uri(app.Services.GetRequiredService<IServer>().Features.Get<IServerAddressesFeature>()!.Addresses.Single())};
            var prefix=$"/me/enrollments/{f.Enrollment}";Assert.Equal(HttpStatusCode.Unauthorized,(await client.GetAsync(prefix+"/tasks")).StatusCode);
            client.DefaultRequestHeaders.Add("X-Fixture-User",f.Purchase.Owner);Assert.Equal(HttpStatusCode.Forbidden,(await client.GetAsync(prefix+"/tasks")).StatusCode);
            client.DefaultRequestHeaders.Remove("X-Fixture-User");client.DefaultRequestHeaders.Add("X-Fixture-User",f.Purchase.Learner);
            var create=prefix+$"/tasks/{task}/submissions";var payload=new CreateAttempt(Guid.NewGuid(),f.Purchase.Version);
            Assert.Equal(HttpStatusCode.Forbidden,(await client.PostAsJsonAsync(create,payload)).StatusCode);
            client.DefaultRequestHeaders.Add("X-Requested-With","XMLHttpRequest");client.DefaultRequestHeaders.Add("Origin","http://evil.test");client.DefaultRequestHeaders.Add("X-Esham-Account-Id",f.Purchase.Learner);
            Assert.Equal(HttpStatusCode.Forbidden,(await client.PostAsJsonAsync(create,payload)).StatusCode);
            client.DefaultRequestHeaders.Remove("Origin");client.DefaultRequestHeaders.Add("Origin","http://localhost:5175");
            Assert.Equal(HttpStatusCode.BadRequest,(await client.PostAsJsonAsync(create,new{payload.RequestId,payload.ExpectedCourseVersionId,AttemptNumber=99})).StatusCode);
            var response=await client.PostAsJsonAsync(create,payload);Assert.Equal(HttpStatusCode.OK,response.StatusCode);var draft=(await response.Content.ReadFromJsonAsync<SubmissionDetail>())!;
            var attempt=prefix+$"/submissions/{draft.Id}";
            using var form=new MultipartFormDataContent();form.Add(new StringContent(Guid.NewGuid().ToString()),"uploadId");form.Add(new StringContent(f.Purchase.Version.ToString()),"expectedTaskVersionId");form.Add(new StringContent(draft.DraftToken),"expectedDraftToken");
            var file=new ByteArrayContent("real private text"u8.ToArray());file.Headers.ContentType=new MediaTypeHeaderValue("text/plain");form.Add(file,"file","../work.txt");
            var upload=await client.PostAsync(attempt+"/attachments",form);Assert.Equal(HttpStatusCode.OK,upload.StatusCode);draft=(await upload.Content.ReadFromJsonAsync<SubmissionDetail>())!;
            Assert.Single(draft.Attachments);Assert.DoesNotContain("storageKey",await upload.Content.ReadAsStringAsync(),StringComparison.OrdinalIgnoreCase);
            var path=draft.Attachments[0].ContentUrl;
            // This test service uses memory media; ownership and headers are still exercised.
            var read=await client.GetAsync(path);Assert.Equal(HttpStatusCode.OK,read.StatusCode);Assert.True(read.Headers.CacheControl!.NoStore);Assert.Equal("attachment",read.Content.Headers.ContentDisposition!.DispositionType);
            var head=await client.SendAsync(new HttpRequestMessage(HttpMethod.Head,path));Assert.Empty(await head.Content.ReadAsByteArrayAsync());
            var foreign=await Seed(s);await s.GetRequiredService<AccountService>().UpdateCurrentProfileAsync(Principal(foreign),Profile("learner","foreign_api"));
            client.DefaultRequestHeaders.Remove("X-Fixture-User");client.DefaultRequestHeaders.Add("X-Fixture-User",foreign);Assert.Equal(HttpStatusCode.NotFound,(await client.GetAsync(path)).StatusCode);
            client.DefaultRequestHeaders.Remove("X-Fixture-User");client.DefaultRequestHeaders.Add("X-Fixture-User",f.Purchase.Owner);
            Assert.Equal(HttpStatusCode.NotFound,(await client.GetAsync($"/api/instructor/submissions/{draft.Id}")).StatusCode);
            client.DefaultRequestHeaders.Remove("X-Fixture-User");client.DefaultRequestHeaders.Add("X-Fixture-User",f.Purchase.Learner);
            Assert.Equal(HttpStatusCode.OK,(await client.PostAsJsonAsync(attempt+"/submit",new FinalizeAttempt(f.Purchase.Version,draft.DraftToken))).StatusCode);
            client.DefaultRequestHeaders.Remove("X-Fixture-User");client.DefaultRequestHeaders.Add("X-Fixture-User",f.Purchase.Owner);
            var detail=await client.GetStringAsync($"/api/instructor/submissions/{draft.Id}");Assert.Contains("instructions",detail);Assert.Contains("courseVersionId",detail);
            Assert.Equal(HttpStatusCode.OK,(await client.PostAsJsonAsync($"/api/instructor/submissions/{draft.Id}/review",new InstructorReviewInput("approved","Reviewed"))).StatusCode);
            Assert.Equal(HttpStatusCode.Conflict,(await client.PostAsJsonAsync($"/api/instructor/submissions/{draft.Id}/review",new InstructorReviewInput("rejected","Cannot revoke"))).StatusCode);
        } finally {await app.StopAsync();}
    }
}
