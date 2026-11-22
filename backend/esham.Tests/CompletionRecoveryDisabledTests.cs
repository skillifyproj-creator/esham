using esham.BLL.Services;
using esham.PL.Services;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Xunit;
namespace esham.Tests;
public sealed class CompletionRecoveryDisabledTests
{
    private sealed class ForbiddenScopes:IServiceScopeFactory{
        public int Calls;
        public IServiceScope CreateScope(){Calls++;throw new InvalidOperationException("Disabled recovery must not resolve database services.");}
    }
    [Theory][InlineData(false,true)][InlineData(true,false)][InlineData(false,false)]
    public async Task Disabled_background_recovery_never_resolves_a_database_scope(bool enabled,bool recovery){
        var scopes=new ForbiddenScopes();using var worker=new CompletionRecoveryService(scopes,Options.Create(new CourseCompletionOptions{Enabled=enabled,RecoveryEnabled=recovery}),NullLogger<CompletionRecoveryService>.Instance);
        await worker.StartAsync(CancellationToken.None);await worker.StopAsync(CancellationToken.None);Assert.Equal(0,scopes.Calls);
    }
}
