using esham.BLL.Interfaces;
using esham.BLL.Services;
using esham.DAL.Data;
using esham.DAL.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
using static esham.Tests.AccountFinalizationTests;
using static esham.Tests.UserCategoryServiceTests;

namespace esham.Tests;

public sealed class AccountCategoryIntegrationTests
{
    [Theory]
    [InlineData("learner")]
    [InlineData("instructor")]
    [InlineData("both")]
    public async Task Guid_onboarding_bootstraps_memberships_and_selections_in_the_existing_finalization(string role)
    {
        using var provider = Services();
        using var scope = provider.CreateScope();
        var services = scope.ServiceProvider;
        var id = await Seed(services);
        var db = services.GetRequiredService<AppDbContext>();
        var category = await CategoryAsync(db);
        var command = Profile(role) with { Interests = null, TeachingAreas = null,
            LearningCategoryIds = role == "instructor" ? null : [category.Id],
            TeachingCategoryIds = role == "learner" ? null : [category.Id] };
        var account = services.GetRequiredService<AccountService>();
        var result = await account.UpdateCurrentProfileAsync(Principal(id), command);
        Assert.Equal(AccountFailure.None, result.Failure);
        Assert.Equal(id, result.Profile!.Id);
        Assert.Equal(role == "both" ? 2 : 1, await db.UserCategories.CountAsync());
        Assert.Empty(result.Profile.Interests); Assert.Empty(result.Profile.TeachingAreas);
        var ledgerId = (await db.PointTransactions.SingleAsync()).Id;
        var session = await account.GetCurrentSessionAsync(Principal(id));
        Assert.False(session.OnboardingRequired);
        Assert.Equal(role != "instructor", session.Profile!.Roles.Contains("Learner"));
        Assert.Equal(role != "learner", session.Profile.Roles.Contains("Instructor"));
        var selected = (await Service(services).GetCurrentAsync(Principal(id))).Value!;
        Assert.Equal(selected.LearningCategoryIds, session.Profile.LearningCategoryIds);
        Assert.Equal(selected.TeachingCategoryIds, session.Profile.TeachingCategoryIds);
        var user = await db.Users.SingleAsync();
        var login = await account.LoginAsync(new(user.Email, Password));
        Assert.False(login.OnboardingRequired);
        Assert.Equal(selected.LearningCategoryIds, login.Profile!.LearningCategoryIds);
        Assert.Equal(AccountFailure.None, (await account.UpdateCurrentProfileAsync(Principal(id), command)).Failure);
        Assert.Equal(ledgerId, (await db.PointTransactions.SingleAsync()).Id);
        Assert.Equal(20, (await db.Wallets.SingleAsync()).Balance);
    }

    [Theory]
    [InlineData("inactive")]
    [InlineData("missing")]
    [InlineData("duplicate")]
    [InlineData("wrongKind")]
    [InlineData("emptyGuid")]
    [InlineData("mixedIndexes")]
    public async Task Invalid_guid_onboarding_leaves_no_profile_membership_wallet_or_selection_writes(string invalid)
    {
        using var provider = Services();
        using var scope = provider.CreateScope();
        var services = scope.ServiceProvider;
        var id = await Seed(services);
        var db = services.GetRequiredService<AppDbContext>();
        var active = await CategoryAsync(db);
        var inactive = await CategoryAsync(db, active: false);
        var ids = invalid switch
        {
            "inactive" => new[] { inactive.Id }, "missing" => [Guid.NewGuid()],
            "duplicate" => [active.Id, active.Id], "emptyGuid" => [Guid.Empty], _ => [active.Id],
        };
        var command = Profile("learner") with { Interests = invalid == "mixedIndexes" ? [0] : null,
            TeachingAreas = null, LearningCategoryIds = ids,
            TeachingCategoryIds = invalid == "wrongKind" ? [active.Id] : null };
        var result = await services.GetRequiredService<AccountService>().UpdateCurrentProfileAsync(Principal(id), command);
        Assert.Equal(AccountFailure.Validation, result.Failure);
        Assert.Null((await db.Users.SingleAsync()).Role);
        Assert.Empty(await db.UserCategories.ToListAsync());
        Assert.Empty(await db.UserRoles.ToListAsync());
        Assert.Empty(await db.Wallets.ToListAsync());
        Assert.Empty(await db.PointTransactions.ToListAsync());
    }

    [Fact]
    public async Task Legacy_account_reselection_replaces_indexes_with_guids_and_preserves_other_profile_data()
    {
        using var provider = Services();
        using var scope = provider.CreateScope();
        var services = scope.ServiceProvider;
        var id = await Seed(services, administrator: true);
        var account = services.GetRequiredService<AccountService>();
        var old = Profile("learner") with { Bio = "Keep my bio", NameEn = "Keep English Name" };
        Assert.Equal(AccountFailure.None, (await account.UpdateCurrentProfileAsync(Principal(id), old)).Failure);
        var db = services.GetRequiredService<AppDbContext>();
        var category = await CategoryAsync(db);
        var ledger = (await db.PointTransactions.SingleAsync()).Id;
        var updated = await account.UpdateCurrentProfileAsync(Principal(id), old with {
            Interests = null, TeachingAreas = null, LearningCategoryIds = [category.Id],
        });
        Assert.Equal(AccountFailure.None, updated.Failure);
        Assert.Empty(updated.Profile!.Interests);
        Assert.Equal(new[] { category.Id }, updated.Profile.LearningCategoryIds);
        Assert.Equal("Keep my bio", updated.Profile.Bio);
        Assert.Equal("Keep English Name", updated.Profile.NameEn);
        Assert.Contains("GeneralAdmin", updated.Profile.Roles);
        Assert.Contains("CategoryAdmin", updated.Profile.Roles);
        Assert.Equal(ledger, (await db.PointTransactions.SingleAsync()).Id);
    }

    [Fact]
    public async Task Incomplete_password_login_restores_metadata_for_reselection_without_granting_roles_or_points()
    {
        using var provider = Services();
        using var scope = provider.CreateScope();
        var services = scope.ServiceProvider;
        var id = await Seed(services);
        var users = services.GetRequiredService<UserManager<ApplicationUser>>();
        var user = (await users.FindByIdAsync(id))!;
        user.Name = "Saved Name"; user.Bio = "Saved Bio"; user.NameEn = "English Name";
        Assert.True((await users.UpdateAsync(user)).Succeeded);
        var login = await services.GetRequiredService<AccountService>().LoginAsync(new(user.Email, Password));
        Assert.Equal(AccountFailure.None, login.Failure);
        Assert.True(login.OnboardingRequired);
        Assert.Equal("Saved Bio", login.Profile!.Bio);
        Assert.Equal("English Name", login.Profile.NameEn);
        Assert.Empty(login.Profile.Roles);
        Assert.Empty(await services.GetRequiredService<AppDbContext>().Wallets.ToListAsync());
        Assert.Empty(await services.GetRequiredService<AppDbContext>().PointTransactions.ToListAsync());
    }
}
