using System.Data.Common;
using esham.BLL.DTOs;
using esham.BLL.Services;
using esham.DAL.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;
using Xunit;
namespace esham.Tests;

public sealed class RelationalQueryTests
{
    private static AppDbContext Context() => new(new DbContextOptionsBuilder<AppDbContext>()
        .UseSqlServer("Server=query-check.invalid;Database=Offline;Integrated Security=True")
        .AddInterceptors(new SuppressConnectionOpening(), new CaptureCommand()).Options);
    [Theory] [InlineData("mine")] [InlineData("detail")] [InlineData("draft")]
    [InlineData("public")] [InlineData("publicDetail")] [InlineData("categories")] [InlineData("children")]
    public async Task Read_queries_translate_to_sql_server_without_opening_a_connection(string query)
    {
        await using var db = Context(); var courses = new CourseService(db); var categories = new CategoryService(db);
        var actor = new CourseActor("owner", true, false); var id = Guid.NewGuid();
        var exception = await Assert.ThrowsAsync<CapturedSqlException>(async () =>
        {
            switch (query)
            {
                case "mine": await courses.GetMineAsync(actor); break;
                case "detail": await courses.GetAsync(id, actor); break;
                case "draft": await courses.GetDraftAsync(id, actor); break;
                case "public": await courses.GetPublicAsync(); break;
                case "publicDetail": await courses.GetPublicAsync(id); break;
                case "categories": await categories.GetActiveAsync(); break;
                case "children": await categories.GetChildrenAsync(id); break;
            }
        });
        Assert.Contains("SELECT", exception.Sql);
        if (query == "mine") Assert.Contains("OwnerUserId", exception.Sql);
        if (query.StartsWith("public", StringComparison.Ordinal))
        {
            Assert.Contains("approved", exception.Sql); Assert.Contains("SafetyStatus", exception.Sql);
            Assert.DoesNotContain("DraftVersionId", exception.Sql);
            Assert.DoesNotContain("StorageKey", exception.Sql);
        }
    }
    [Fact] public void Current_model_still_matches_the_applied_domain_snapshot()
    {
        using var db = Context();
        var migrations = db.GetService<IMigrationsAssembly>();
        Assert.Equal(2, migrations.Migrations.Count);
        var snapshot = db.GetService<IModelRuntimeInitializer>().Initialize(migrations.ModelSnapshot!.Model, designTime: true);
        var target = db.GetService<IDesignTimeModel>().Model;
        Assert.False(db.GetService<IMigrationsModelDiffer>().HasDifferences(snapshot.GetRelationalModel(), target.GetRelationalModel()));
    }
    private sealed class SuppressConnectionOpening : DbConnectionInterceptor
    {
        public override ValueTask<InterceptionResult> ConnectionOpeningAsync(DbConnection connection,
            ConnectionEventData eventData, InterceptionResult result, CancellationToken cancellationToken = default)
            => ValueTask.FromResult(InterceptionResult.Suppress());
    }
    private sealed class CaptureCommand : DbCommandInterceptor
    {
        public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(DbCommand command,
            CommandEventData eventData, InterceptionResult<DbDataReader> result, CancellationToken cancellationToken = default)
            => throw new CapturedSqlException(command.CommandText);
    }
    private sealed class CapturedSqlException(string sql) : Exception("SQL captured without execution.")
    {
        public string Sql { get; } = sql;
    }
}
