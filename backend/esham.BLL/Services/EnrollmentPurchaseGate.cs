using System.Data;
using esham.BLL.Interfaces;
using esham.DAL.Data;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
namespace esham.BLL.Services;

public sealed class EnrollmentPurchaseOptions
{
    public bool Enabled { get; set; } // Fail closed in every environment, including Production.
    public string? ApprovedIsolatedDatabase { get; set; }
}

// Phase 1 write gate. Enabling a flag alone cannot enable hosted database purchases.
// Removing the isolated-only restriction for deployment requires a separate approval.
public sealed class EnrollmentPurchaseGate(AppDbContext db, IOptions<EnrollmentPurchaseOptions> options) : IEnrollmentPurchaseGate
{
    public async Task<bool> IsEnabledAsync(CancellationToken ct = default) => options.Value.Enabled && await VerifyTargetAsync(ct);
    public async Task<bool> VerifyTargetAsync(CancellationToken ct = default)
    {
        var approved = options.Value.ApprovedIsolatedDatabase;
        if (approved is null || !approved.StartsWith("Esham_AccountTests_", StringComparison.Ordinal)
            || !db.Database.IsSqlServer()) return false;
        var target = new SqlConnectionStringBuilder(db.Database.GetConnectionString());
        if (!target.DataSource.StartsWith(@"(localdb)\", StringComparison.OrdinalIgnoreCase)
            || !string.Equals(target.InitialCatalog, approved, StringComparison.OrdinalIgnoreCase)) return false;
        var connection = db.Database.GetDbConnection();
        var opened = connection.State != ConnectionState.Open;
        try
        {
            if (opened) await db.Database.OpenConnectionAsync(ct);
            await using var command = connection.CreateCommand();
            command.CommandText = "SELECT DB_NAME()";
            var actual = await command.ExecuteScalarAsync(ct) as string;
            return string.Equals(actual, approved, StringComparison.OrdinalIgnoreCase) && actual != "db75401";
        }
        finally { if (opened) await db.Database.CloseConnectionAsync(); }
    }
}
