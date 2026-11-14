using esham.BLL.Interfaces;
using esham.DAL.Data;
using Microsoft.Extensions.Options;
namespace esham.BLL.Services;
public sealed class SubmissionMutationOptions
{
    public bool Enabled { get; set; }
    public string? ApprovedIsolatedDatabase { get; set; }
}
// Independent opt-in, reusing the actual database/instance verifier, not the progress flag.
public sealed class SubmissionMutationGate(AppDbContext db, IOptions<SubmissionMutationOptions> options) : ISubmissionMutationGate
{
    public Task<bool> IsEnabledAsync(CancellationToken ct = default) => new LearningProgressWriteGate(db,
        Options.Create(new LearningProgressOptions { Enabled = options.Value.Enabled, ApprovedIsolatedDatabase = options.Value.ApprovedIsolatedDatabase })).IsEnabledAsync(ct);
}
