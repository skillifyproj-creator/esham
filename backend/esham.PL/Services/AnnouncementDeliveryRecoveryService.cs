using esham.BLL.Services;
using Microsoft.Extensions.Options;
namespace esham.PL.Services;
public sealed class AnnouncementDeliveryRecoveryService(IServiceScopeFactory scopes,IOptions<Phase5Options> options,ILogger<AnnouncementDeliveryRecoveryService> log):BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken ct){while(!ct.IsCancellationRequested){
        try{if(options.Value.AnnouncementDeliveryEnabled&&options.Value.RecoveryEnabled&&options.Value.AnnouncementIds.Length>0){using var scope=scopes.CreateScope();await scope.ServiceProvider.GetRequiredService<AnnouncementDeliveryService>().RecoverAsync(ct,id=>log.LogWarning("Isolated announcement delivery deferred {AnnouncementId}.",id));}}
        catch(OperationCanceledException)when(ct.IsCancellationRequested){break;}catch(Exception){log.LogError("Isolated announcement delivery pass deferred; no partial batch committed.");}
        await Task.Delay(TimeSpan.FromSeconds(45),ct);
    }}
}
