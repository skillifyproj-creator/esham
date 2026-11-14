using System.Data;
using esham.BLL.Interfaces;
using esham.DAL.Data;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
namespace esham.BLL.Services;
public sealed class LearningProgressOptions
{
    public bool Enabled { get; set; }
    public string? ApprovedIsolatedDatabase { get; set; }
}
public sealed class LearningProgressWriteGate(AppDbContext db, IOptions<LearningProgressOptions> options) : ILearningProgressWriteGate
{
    public async Task<bool> IsEnabledAsync(CancellationToken ct = default)
    {
        if (!options.Value.Enabled || options.Value.ApprovedIsolatedDatabase != "Esham_AccountTests_Phase1_20261114" || !db.Database.IsSqlServer()) return false;
        var target = new SqlConnectionStringBuilder(db.Database.GetConnectionString());
        if (!string.Equals(target.DataSource, @"(localdb)\MSSQLLocalDB", StringComparison.OrdinalIgnoreCase)
            || target.InitialCatalog != options.Value.ApprovedIsolatedDatabase) return false;
        var connection = db.Database.GetDbConnection(); var opened = connection.State != ConnectionState.Open;
        try
        {
            if (opened) await db.Database.OpenConnectionAsync(ct);
            await using var command = connection.CreateCommand();
            command.CommandText = "SELECT DB_NAME(), CONVERT(int, SERVERPROPERTY('IsLocalDB')), CONVERT(nvarchar(128), SERVERPROPERTY('ServerName'))";
            await using var reader = await command.ExecuteReaderAsync(ct);
            return await reader.ReadAsync(ct) && reader.GetString(0) == options.Value.ApprovedIsolatedDatabase
                && !reader.IsDBNull(1) && reader.GetInt32(1) == 1 && !reader.IsDBNull(2)
                && reader.GetString(2).StartsWith(Environment.MachineName + @"\LOCALDB#", StringComparison.OrdinalIgnoreCase);
        }
        finally { if (opened) await db.Database.CloseConnectionAsync(); }
    }
}
