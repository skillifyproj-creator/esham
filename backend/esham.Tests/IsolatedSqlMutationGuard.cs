using System.Data.Common;
using System.Text.RegularExpressions;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore.Diagnostics;
namespace esham.Tests;

// Test-only guard shared by all relational fixtures. Raw/bulk DML is covered as well as SaveChanges.
public sealed class IsolatedSqlMutationGuard:DbCommandInterceptor
{
    public static void Verify(DbConnection connection,DbTransaction? transaction=null)
    {
        var c=new SqlConnectionStringBuilder(connection.ConnectionString);
        if(Environment.GetEnvironmentVariable("ESHAM_RUN_ISOLATED_SQL_TESTS")!="1"
            || Environment.GetEnvironmentVariable("ESHAM_APPROVED_ISOLATED_DATABASE")!=ApprovedCatalog
            || c.InitialCatalog!=ApprovedCatalog||!c.DataSource.Equals(@"(localdb)\MSSQLLocalDB",StringComparison.OrdinalIgnoreCase)||!c.IntegratedSecurity)
            throw new InvalidOperationException("Mutation test refused: exact approved LocalDB configuration required.");
        using var command=connection.CreateCommand();command.Transaction=transaction;
        command.CommandText="SELECT DB_NAME(),CONVERT(int,SERVERPROPERTY('IsLocalDB')),CONVERT(nvarchar(128),SERVERPROPERTY('ServerName'))";
        using var reader=command.ExecuteReader();
        if(!reader.Read()||reader.GetString(0)!=ApprovedCatalog||reader.IsDBNull(1)||reader.GetInt32(1)!=1||reader.IsDBNull(2)
            ||!reader.GetString(2).StartsWith(Environment.MachineName+@"\LOCALDB#",StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Mutation test refused: actual database identity is not the approved LocalDB.");
    }
    private const string ApprovedCatalog="Esham_AccountTests_Phase1_20261114";
    private static void Check(DbCommand command)
    {
        if(Regex.IsMatch(command.CommandText,@"\b(CREATE|ALTER|DROP|TRUNCATE)\s+(TABLE|DATABASE|INDEX|SCHEMA)\b",RegexOptions.IgnoreCase))
            throw new InvalidOperationException("Schema operations are prohibited in these regression tests.");
        if(Regex.IsMatch(command.CommandText,@"\b(INSERT|UPDATE|DELETE|MERGE|EXEC)\b",RegexOptions.IgnoreCase))Verify(command.Connection!,command.Transaction);
    }
    public override InterceptionResult<DbDataReader> ReaderExecuting(DbCommand c,CommandEventData e,InterceptionResult<DbDataReader> r){Check(c);return r;}
    public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(DbCommand c,CommandEventData e,InterceptionResult<DbDataReader> r,CancellationToken ct=default){Check(c);return ValueTask.FromResult(r);}
    public override InterceptionResult<int> NonQueryExecuting(DbCommand c,CommandEventData e,InterceptionResult<int> r){Check(c);return r;}
    public override ValueTask<InterceptionResult<int>> NonQueryExecutingAsync(DbCommand c,CommandEventData e,InterceptionResult<int> r,CancellationToken ct=default){Check(c);return ValueTask.FromResult(r);}
}
