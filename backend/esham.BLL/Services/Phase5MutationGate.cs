using esham.BLL.Interfaces;
using esham.DAL.Data;
using Microsoft.Extensions.Options;
namespace esham.BLL.Services;

public enum Phase5Capability { Reviews, AccountSecurity, AnnouncementDelivery }
public sealed class Phase5Options
{
    public bool ReviewsEnabled { get; set; }
    public bool AccountSecurityEnabled { get; set; }
    public bool AnnouncementDeliveryEnabled { get; set; }
    public bool RecoveryEnabled { get; set; }
    public bool PrivateRecoveryCaptureEnabled { get; set; }
    public string? ApprovedIsolatedDatabase { get; set; }
    public Guid[] AnnouncementIds { get; set; } = [];
    public string[] AnnouncementRecipientIds { get; set; } = [];
}
public interface IPhase5MutationGate { Task<bool> IsEnabledAsync(Phase5Capability capability, CancellationToken ct=default); }
public sealed class Phase5MutationGate(AppDbContext db,IOptions<Phase5Options> options):IPhase5MutationGate
{
    public async Task<bool> IsEnabledAsync(Phase5Capability capability,CancellationToken ct=default)
    {
        var o=options.Value;
        var enabled=capability switch{Phase5Capability.Reviews=>o.ReviewsEnabled,Phase5Capability.AccountSecurity=>o.AccountSecurityEnabled,_=>o.AnnouncementDeliveryEnabled};
        return enabled && await new CompletionMutationGate(db,Options.Create(new CourseCompletionOptions{Enabled=true,ApprovedIsolatedDatabase=o.ApprovedIsolatedDatabase})).IsEnabledAsync(ct);
    }
}
