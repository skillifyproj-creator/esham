using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
namespace esham.Tests;
public sealed class Phase5RecoveryChildFact:FactAttribute{public Phase5RecoveryChildFact(){if(Environment.GetEnvironmentVariable("ESHAM_PHASE5_RECOVERY_ACTION")!="resume"||!EnrollmentSqlServerTests.Configured())Skip="Explicit guarded Phase5 recovery child action only.";}}
public sealed class Phase5RecoveryChildTests
{
    [Phase5RecoveryChildFact]public async Task Resume(){
        using var provider=await CompletionSqlServerTests.Provider();var file=Path.GetFullPath(Environment.GetEnvironmentVariable("ESHAM_PHASE5_RECOVERY_FILE")!);
        if(!file.StartsWith(Phase5SqlTests.Artifacts()+Path.DirectorySeparatorChar,StringComparison.OrdinalIgnoreCase)||!System.Text.RegularExpressions.Regex.IsMatch(Path.GetFileName(file),@"^delivery-restart-[0-9a-f]{32}\.json$"))throw new InvalidOperationException("Dedicated isolated recovery fixture required.");
        using var data=JsonDocument.Parse(await File.ReadAllTextAsync(file));var id=data.RootElement.GetProperty("Id").GetGuid();var recipients=data.RootElement.GetProperty("Recipients").EnumerateArray().Select(x=>x.GetString()!).ToArray();using var s=provider.CreateScope();Assert.Equal(7,await Phase5SqlTests.Delivery(s.ServiceProvider,id,recipients).RecoverAsync());
    }
}
