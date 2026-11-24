using Microsoft.Data.SqlClient;
using Xunit;
namespace esham.Tests;

public sealed class Phase6ADiagnosticsSqlTests
{
    [Phase1SqlFact]
    public async Task Controlled_mixed_workloads_record_connections_blocking_and_empty_SQL_errors()
    {
        using var stop = new CancellationTokenSource(); var ready = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var errors = new System.Collections.Concurrent.ConcurrentBag<int>();
        var monitor=Task.Run(async()=> {
            try {
                while(!stop.IsCancellationRequested) {
                    await using var connection=new SqlConnection(Environment.GetEnvironmentVariable("ESHAM_ACCOUNT_TEST_SQLSERVER"));
                    var timer=System.Diagnostics.Stopwatch.StartNew();await connection.OpenAsync(stop.Token);
                    IsolatedSqlMutationGuard.Verify(connection);
                    await using var command=connection.CreateCommand();command.CommandTimeout=5;
                    command.CommandText="SELECT DB_NAME(),CONVERT(int,SERVERPROPERTY('IsLocalDB')),CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')); SELECT session_id,blocking_session_id,wait_type,wait_time FROM sys.dm_exec_requests WHERE database_id=DB_ID() AND session_id<>@@SPID";
                    await using var reader=await command.ExecuteReaderAsync(stop.Token);Assert.True(await reader.ReadAsync(stop.Token));
                    var database=reader.GetString(0);var isLocalDb=reader.GetInt32(1);var server=reader.GetString(2);
                    Assert.Equal("Esham_AccountTests_Phase1_20261114",database);Assert.Equal(1,isLocalDb);
                    await reader.NextResultAsync(stop.Token);var waits=new List<object>();
                    while(await reader.ReadAsync(stop.Token))waits.Add(new{session=reader.GetInt16(0),blockedBy=reader.GetInt16(1),wait=reader.IsDBNull(2)?null:reader.GetString(2),milliseconds=reader.GetInt32(3)});
                    Phase6ASqlDiagnostics.Record(new{kind="blocking-sample",database,isLocalDb,server,connectionAndSampleMilliseconds=timer.Elapsed.TotalMilliseconds,waits});
                    ready.TrySetResult();await Task.Delay(250,stop.Token);
                }
            }catch(OperationCanceledException)when(stop.IsCancellationRequested){}catch(SqlException ex){foreach(SqlError e in ex.Errors)errors.Add(e.Number);ready.TrySetException(ex);throw;}
        });
        try {
            await ready.Task.WaitAsync(TimeSpan.FromSeconds(20));
            foreach(var wave in new[]{7,8,9})await new Phase4HardeningSqlTests().RunMixed(wave,true);
        } finally {stop.Cancel();await monitor;}
        Assert.Empty(errors);
    }
}
