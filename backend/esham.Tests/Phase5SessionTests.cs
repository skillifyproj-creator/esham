using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;
namespace esham.Tests;
public sealed class Phase5SessionTests
{
    [Theory][InlineData(false)][InlineData(true)]public async Task Password_or_revoke_all_rejects_old_cookies_and_delayed_response_cannot_replace_new_account(bool revoke){
        var entered=new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);var release=new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);var server=await SessionRenewalTests.Server(entered,release);await using var app=server.App;
        var jar=new CookieContainer();using var c=new HttpClient(new HttpClientHandler{CookieContainer=jar,AllowAutoRedirect=false}){BaseAddress=server.Address};var oldJar=new CookieContainer();using var old=new HttpClient(new HttpClientHandler{CookieContainer=oldJar,AllowAutoRedirect=false}){BaseAddress=server.Address};
        try{await SessionRenewalTests.Login(c,server.A);foreach(Cookie cookie in jar.GetCookies(server.Address))oldJar.Add(server.Address,new Cookie(cookie.Name,cookie.Value,cookie.Path));
            var delayed=c.GetAsync("/delayed");await entered.Task.WaitAsync(TimeSpan.FromSeconds(10));c.DefaultRequestHeaders.Add("X-Requested-With","XMLHttpRequest");c.DefaultRequestHeaders.Add("X-Esham-Account-Id",server.A.Id);
            var response=revoke?await c.PostAsJsonAsync("/me/sessions/revoke-all",new{currentPassword=AccountFinalizationTests.Password}):await c.PostAsJsonAsync("/me/password",new{currentPassword=AccountFinalizationTests.Password,password="NewSessionPassword456!"});Assert.Equal(HttpStatusCode.NoContent,response.StatusCode);
            Assert.Equal(HttpStatusCode.Unauthorized,(await old.GetAsync("/auth/session")).StatusCode);await SessionRenewalTests.Login(c,server.B);release.TrySetResult();Assert.False((await delayed).Headers.Contains("Set-Cookie"));
            var session=await c.GetFromJsonAsync<JsonElement>("/auth/session");Assert.Equal(server.B.Id,session.GetProperty("profile").GetProperty("id").GetString());
        }finally{release.TrySetResult();await app.StopAsync();}
    }
}
