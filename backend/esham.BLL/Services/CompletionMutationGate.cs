using System.Data;
using esham.BLL.Interfaces;
using esham.DAL.Data;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.Options;
namespace esham.BLL.Services;
public sealed class CourseCompletionOptions
{
    public bool Enabled { get; set; }
    public string? ApprovedIsolatedDatabase { get; set; }
    public bool RecoveryEnabled { get; set; }
}
public sealed class CompletionMutationGate(AppDbContext db, IOptions<CourseCompletionOptions> options) : ICompletionMutationGate
{
    public const string Catalog = "Esham_AccountTests_Phase1_20261114";
    public async Task<bool> IsEnabledAsync(CancellationToken ct = default)
    {
        if (!options.Value.Enabled || options.Value.ApprovedIsolatedDatabase != Catalog || !db.Database.IsSqlServer()) return false;
        var target = new SqlConnectionStringBuilder(db.Database.GetConnectionString());
        if (!target.DataSource.Equals(@"(localdb)\MSSQLLocalDB", StringComparison.OrdinalIgnoreCase)
            || target.InitialCatalog != Catalog || !target.IntegratedSecurity) return false;
        var connection = db.Database.GetDbConnection(); var opened = connection.State != ConnectionState.Open;
        try
        {
            if (opened) await db.Database.OpenConnectionAsync(ct);
            await using var command = connection.CreateCommand();
            command.Transaction = db.Database.CurrentTransaction?.GetDbTransaction();
            command.CommandText = "SELECT DB_NAME(), CONVERT(int,SERVERPROPERTY('IsLocalDB')), CONVERT(nvarchar(128),SERVERPROPERTY('ServerName'))";
            await using var r = await command.ExecuteReaderAsync(ct);
            return await r.ReadAsync(ct) && r.GetString(0) == Catalog && !r.IsDBNull(1) && r.GetInt32(1) == 1
                && !r.IsDBNull(2) && r.GetString(2).StartsWith(Environment.MachineName + @"\LOCALDB#", StringComparison.OrdinalIgnoreCase);
        }
        finally { if (opened) await db.Database.CloseConnectionAsync(); }
    }
}
