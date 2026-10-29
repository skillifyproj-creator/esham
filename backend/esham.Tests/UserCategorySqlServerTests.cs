using esham.BLL.DTOs;
using esham.DAL.Data;
using esham.DAL.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
using static esham.Tests.AccountFinalizationTests;
using static esham.Tests.UserCategoryServiceTests;
using static esham.Tests.AccountFinalizationSqlServerTests;

namespace esham.Tests;

// Uses the existing explicit isolated-database opt-in. No schema/database creation.
public sealed class UserCategorySqlServerTests
{
    [AccountSqlServerFact]
    public async Task Concurrent_replacements_are_whole_sets_and_do_not_merge_or_overwrite_other_kinds()
    {
        using var provider = DatabaseServices();
        string id;
        Guid a, b, c;
        using (var setup = provider.CreateScope())
        {
            var services = setup.ServiceProvider;
            id = await Seed(services);
            await Grant(services, id, "Learner", "Instructor");
            var db = services.GetRequiredService<AppDbContext>();
            a = (await CategoryAsync(db)).Id; b = (await CategoryAsync(db)).Id; c = (await CategoryAsync(db)).Id;
            Assert.Equal(ServiceFailure.None, (await Service(services).ReplaceCurrentAsync(Principal(id), "teaching", new([c]))).Failure);
        }
        var gate = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var requests = Enumerable.Range(0, 8).Select(async index =>
        {
            await gate.Task;
            using var scope = provider.CreateScope();
            var requested = index % 2 == 0 ? new[] { a, b } : new[] { c };
            var result = await Service(scope.ServiceProvider).ReplaceCurrentAsync(Principal(id), "learning", new(requested));
            Assert.Equal(ServiceFailure.None, result.Failure);
            Assert.Equal(requested.Order(), result.Value!.LearningCategoryIds);
            Assert.Equal(new[] { c }, result.Value.TeachingCategoryIds);
        }).ToArray();
        gate.SetResult();
        await Task.WhenAll(requests);
        using var verify = provider.CreateScope();
        var selected = (await Service(verify.ServiceProvider).GetCurrentAsync(Principal(id))).Value!;
        Assert.True(selected.LearningCategoryIds.SequenceEqual(new[] { a, b }.Order())
            || selected.LearningCategoryIds.SequenceEqual(new[] { c }));
        Assert.Equal(new[] { c }, selected.TeachingCategoryIds);
    }

    [AccountSqlServerFact]
    public async Task Failure_after_save_rolls_back_replacement_and_legacy_profile_changes()
    {
        var failure = new AfterSelectionSaveFailure(transient: false);
        using var provider = DatabaseServices(failure);
        using var scope = provider.CreateScope();
        var services = scope.ServiceProvider;
        var id = await Seed(services);
        await Grant(services, id, "Learner");
        var db = services.GetRequiredService<AppDbContext>();
        var original = await CategoryAsync(db); var replacement = await CategoryAsync(db);
        db.UserCategories.Add(new UserCategory { UserId = id, CategoryId = original.Id, Kind = "learning" });
        var user = await db.Users.SingleAsync(x => x.Id == id);
        user.Interests = [0];
        await db.SaveChangesAsync();
        var stamp = user.ConcurrencyStamp;
        failure.Armed = true;
        await Assert.ThrowsAsync<InvalidOperationException>(() => Service(services)
            .ReplaceCurrentAsync(Principal(id), "learning", new([replacement.Id])));
        Assert.Empty(db.ChangeTracker.Entries());
        Assert.Equal(original.Id, (await db.UserCategories.SingleAsync(x => x.UserId == id)).CategoryId);
        user = await db.Users.SingleAsync(x => x.Id == id);
        Assert.Equal(new[] { 0 }, user.Interests);
        Assert.Equal(stamp, user.ConcurrencyStamp);
    }

    [AccountSqlServerFact]
    public async Task Transient_failure_after_save_retries_replacement_with_fresh_tracking()
    {
        var failure = new AfterSelectionSaveFailure(transient: true);
        using var provider = DatabaseServices(failure);
        using var scope = provider.CreateScope();
        var services = scope.ServiceProvider;
        var id = await Seed(services);
        await Grant(services, id, "Learner");
        var db = services.GetRequiredService<AppDbContext>();
        var original = await CategoryAsync(db); var replacement = await CategoryAsync(db);
        db.UserCategories.Add(new UserCategory { UserId = id, CategoryId = original.Id, Kind = "learning" });
        await db.SaveChangesAsync();
        failure.Armed = true;
        var result = await Service(services).ReplaceCurrentAsync(Principal(id), "learning", new([replacement.Id]));
        Assert.Equal(ServiceFailure.None, result.Failure);
        Assert.Equal(1, failure.InjectedFailures);
        Assert.Equal(replacement.Id, (await db.UserCategories.SingleAsync(x => x.UserId == id)).CategoryId);
    }

    private sealed class AfterSelectionSaveFailure(bool transient) : SaveChangesInterceptor
    {
        public bool Armed { get; set; }
        public int InjectedFailures { get; private set; }
        public override ValueTask<int> SavedChangesAsync(SaveChangesCompletedEventData eventData,
            int result, CancellationToken cancellationToken = default)
        {
            if (Armed)
            {
                Armed = false;
                InjectedFailures++;
                if (transient) throw new TimeoutException("Injected category test transient failure after save.");
                throw new InvalidOperationException("Injected category test failure after save.");
            }
            return ValueTask.FromResult(result);
        }
    }
}
