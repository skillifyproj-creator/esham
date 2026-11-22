using System.Text.Json;
using esham.DAL.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
namespace esham.Tests;
public sealed class RecoveryChildFactAttribute:FactAttribute{
    public RecoveryChildFactAttribute(){if(Environment.GetEnvironmentVariable("ESHAM_PHASE4_RECOVERY_ACTION")!="resume"||!EnrollmentSqlServerTests.Configured())Skip="Explicit guarded child-process recovery action only.";}
}
public sealed class Phase4RecoveryResumeTests
{
    [RecoveryChildFact]public async Task Resume_in_new_process(){
        using var provider=await CompletionSqlServerTests.Provider();
        var file=Path.GetFullPath(Environment.GetEnvironmentVariable("ESHAM_PHASE4_RECOVERY_FILE")??throw new InvalidOperationException("Fresh recovery fixture required."));
        if(!file.StartsWith(Phase4HardeningSqlTests.Artifacts()+Path.DirectorySeparatorChar,StringComparison.OrdinalIgnoreCase)||!System.Text.RegularExpressions.Regex.IsMatch(Path.GetFileName(file),@"^restart-[0-9a-f]{32}\.json$"))throw new InvalidOperationException("Refusing an unrelated recovery artifact.");
        using var json=JsonDocument.Parse(await File.ReadAllTextAsync(file));var course=json.RootElement.GetProperty("courseId").GetGuid();var ids=json.RootElement.GetProperty("enrollments").EnumerateArray().Select(x=>x.GetGuid()).ToArray();
        using var scope=provider.CreateScope();await CompletionSqlServerTests.Service(scope.ServiceProvider).RecoverAsync(default,null,course);
        var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();Assert.Equal(ids.Length,await db.Certificates.CountAsync(x=>ids.Contains(x.EnrollmentId)));
    }
}
