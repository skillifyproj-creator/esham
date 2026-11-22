using esham.BLL.Services;
using Microsoft.Extensions.Options;
namespace esham.PL.Services;
// Repeated database scans survive missed publication signals and application restarts.
public sealed class CompletionRecoveryService(IServiceScopeFactory scopes,IOptions<CourseCompletionOptions> options,ILogger<CompletionRecoveryService> log) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while(!stoppingToken.IsCancellationRequested) {
            try {
                if(options.Value.Enabled && options.Value.RecoveryEnabled) {
                    using var scope=scopes.CreateScope();
                    await scope.ServiceProvider.GetRequiredService<EnrollmentCompletionService>().RecoverAsync(stoppingToken,
                        id=>log.LogWarning("Completion recovery deferred enrollment {EnrollmentId}; no partial finalization committed.",id));
                }
            } catch(OperationCanceledException) when(stoppingToken.IsCancellationRequested) {break;}
            catch(Exception) {log.LogError("Completion recovery pass failed; durable enrollment rows will be reconsidered on the next pass.");}
            await Task.Delay(TimeSpan.FromSeconds(45),stoppingToken);
        }
    }
}
