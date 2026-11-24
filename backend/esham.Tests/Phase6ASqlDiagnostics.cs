using System.Data.Common;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace esham.Tests;

// Test-only, opt-in timings. Never log SQL text, parameters, cookies or connection strings.
internal static class Phase6ASqlDiagnostics
{
    private static readonly object Sync = new();
    internal static IInterceptor[] Interceptors => Environment.GetEnvironmentVariable("ESHAM_PHASE6_SQL_DIAGNOSTICS") == "1"
        ? [new Connections(), new Commands()] : [];
    internal static void Record(object value)
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory != null && !Directory.Exists(Path.Combine(directory.FullName, "backend", "esham.Tests"))) directory = directory.Parent;
        if (directory == null) throw new InvalidOperationException("Repository diagnostic directory unavailable.");
        var path = Path.Combine(directory.FullName, "artifacts", "phase6a-results"); Directory.CreateDirectory(path);
        lock (Sync) File.AppendAllText(Path.Combine(path, "sql-timings.jsonl"), JsonSerializer.Serialize(new { at=DateTimeOffset.UtcNow, run=Environment.GetEnvironmentVariable("ESHAM_PHASE6_DIAGNOSTICS_RUN"), data=value })+Environment.NewLine);
    }
    private sealed class Connections : DbConnectionInterceptor
    {
        public override Task ConnectionOpenedAsync(DbConnection c, ConnectionEndEventData e, CancellationToken ct=default)
        { Record(new {kind="connection-open",milliseconds=e.Duration.TotalMilliseconds}); return Task.CompletedTask; }
        public override Task ConnectionFailedAsync(DbConnection c, ConnectionErrorEventData e, CancellationToken ct=default)
        { Record(new {kind="connection-error",exceptionType=e.Exception.GetType().FullName,milliseconds=e.Duration.TotalMilliseconds,errors=(e.Exception as SqlException)?.Errors.Cast<SqlError>().Select(x=>x.Number).ToArray()});return Task.CompletedTask; }
    }
    private sealed class Commands : DbCommandInterceptor
    {
        private static string Fingerprint(DbCommand c)=>Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(c.CommandText)))[..16];
        public override ValueTask<DbDataReader> ReaderExecutedAsync(DbCommand c, CommandExecutedEventData e, DbDataReader result,CancellationToken ct=default)
        { if(e.Duration.TotalSeconds>=1)Record(new {kind="slow-command",milliseconds=e.Duration.TotalMilliseconds,fingerprint=Fingerprint(c)});return ValueTask.FromResult(result); }
        public override Task CommandFailedAsync(DbCommand c,CommandErrorEventData e,CancellationToken ct=default)
        { Record(new {kind="command-error",exceptionType=e.Exception.GetType().FullName,milliseconds=e.Duration.TotalMilliseconds,fingerprint=Fingerprint(c),errors=(e.Exception as SqlException)?.Errors.Cast<SqlError>().Select(x=>x.Number).ToArray()});return Task.CompletedTask; }
    }
}
