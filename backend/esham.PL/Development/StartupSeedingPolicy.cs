using esham.BLL.Services;
using esham.DAL.Data;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Options;

namespace esham.PL.Development;

// Explicit development tooling only. Normal startup never seeds by default.
public static class StartupSeedingPolicy
{
    public static bool Requested(IConfiguration configuration) => configuration.GetValue("SeedData:Enabled", false);
    public static bool DemoRequested(IConfiguration configuration) => configuration.GetValue("SeedData:DemoCourses", false);

    public static void ValidateTarget(bool development, string? connectionString)
    {
        var target = new SqlConnectionStringBuilder(connectionString);
        if (!development || !target.IntegratedSecurity
            || target.InitialCatalog != CompletionMutationGate.Catalog
            || !target.DataSource.Equals(@"(localdb)\MSSQLLocalDB", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Startup seeding requires the explicitly approved isolated development LocalDB.");
    }

    public static async Task VerifyIdentityAsync(AppDbContext db)
    {
        var gate = new CompletionMutationGate(db, Options.Create(new CourseCompletionOptions {
            Enabled = true, ApprovedIsolatedDatabase = CompletionMutationGate.Catalog }));
        if (!await gate.IsEnabledAsync()) throw new InvalidOperationException("Startup seeding refused: isolated database identity verification failed.");
    }
}
