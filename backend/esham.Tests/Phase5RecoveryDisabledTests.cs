using esham.BLL.Services;
using esham.PL.Services;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Xunit;
namespace esham.Tests;
public sealed class Phase5RecoveryDisabledTests
{
    private sealed class ForbiddenScope:IServiceScopeFactory{public int Calls;public IServiceScope CreateScope(){Calls++;throw new InvalidOperationException("Disabled delivery must not resolve database services.");}}
    [Theory][InlineData(false,true,true)][InlineData(true,false,true)][InlineData(true,true,false)]public async Task Disabled_or_unselected_delivery_never_opens_database_scope(bool enabled,bool recovery,bool selected){
        var scopes=new ForbiddenScope();using var worker=new AnnouncementDeliveryRecoveryService(scopes,Options.Create(new Phase5Options{AnnouncementDeliveryEnabled=enabled,RecoveryEnabled=recovery,AnnouncementIds=selected?[Guid.NewGuid()]:[]}),NullLogger<AnnouncementDeliveryRecoveryService>.Instance);await worker.StartAsync(default);await worker.StopAsync(default);Assert.Equal(0,scopes.Calls);
    }
}
