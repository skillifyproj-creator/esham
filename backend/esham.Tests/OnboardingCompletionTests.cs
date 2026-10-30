using esham.BLL.Services;
using esham.DAL.Data;
using esham.DAL.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
using static esham.Tests.AccountFinalizationTests;
namespace esham.Tests;

public sealed class OnboardingCompletionTests
{
    [Theory] [InlineData("instructor", false)] [InlineData("learner", false)]
    [InlineData("both", false)] [InlineData("instructor", true)]
    public async Task Persisted_legacy_and_guid_profiles_use_the_same_existing_completion_rules(string persona, bool guidSelection)
    {
        using var provider = Services(); using var scope = provider.CreateScope(); var services = scope.ServiceProvider;
        var id = await Seed(services); var db = services.GetRequiredService<AppDbContext>();
        var users = services.GetRequiredService<UserManager<ApplicationUser>>(); var user = (await users.FindByIdAsync(id))!;
        user.UserName = "completed_profile"; user.Name = "Completed account"; user.Role = persona; user.Goal = 0;
        // NameEn, avatar and bio are optional. This matches the real baseline/Rahaf records.
        user.NameEn = null; user.Avatar = null; user.Bio = null;
        if (!guidSelection)
        {
            user.Interests = persona is "learner" or "both" ? [3] : [];
            user.TeachingAreas = persona is "instructor" or "both" ? [1] : [];
        }
        else
        {
            var category = new Category { NameAr = "برمجة", NameEn = "Programming" };
            db.Categories.Add(category); db.UserCategories.Add(new() { UserId = id, CategoryId = category.Id, Kind = "teaching" });
        }
        Assert.True((await users.UpdateAsync(user)).Succeeded);
        Assert.True((await users.AddToRolesAsync(user, persona == "both" ? ["Learner", "Instructor"] : [persona == "learner" ? "Learner" : "Instructor"])).Succeeded);
        var account = services.GetRequiredService<AccountService>();
        var login = await account.LoginAsync(new(user.Email, Password));
        var session = await account.GetCurrentSessionAsync(Principal(id));
        Assert.False(login.OnboardingRequired); Assert.False(session.OnboardingRequired);
        Assert.Equal(user.Interests, session.Profile!.Interests); Assert.Equal(user.TeachingAreas, session.Profile.TeachingAreas);
        Assert.Empty(await db.Wallets.ToListAsync()); // Reading completeness never finalizes/grants anything.
    }

    [Theory] [InlineData("name")] [InlineData("username")] [InlineData("goal")] [InlineData("categories")]
    public async Task Genuinely_incomplete_profiles_still_require_onboarding(string missing)
    {
        using var provider = Services(); using var scope = provider.CreateScope(); var services = scope.ServiceProvider;
        var id = await Seed(services); var users = services.GetRequiredService<UserManager<ApplicationUser>>();
        var user = (await users.FindByIdAsync(id))!;
        user.Name = missing == "name" ? " " : "Incomplete test";
        user.UserName = missing == "username" ? "initial@example.test" : "incomplete_test";
        user.Goal = missing == "goal" ? null : 0; user.Role = "learner"; user.Interests = missing == "categories" ? [] : [3];
        Assert.True((await users.UpdateAsync(user)).Succeeded); Assert.True((await users.AddToRoleAsync(user, "Learner")).Succeeded);
        var account = services.GetRequiredService<AccountService>();
        Assert.True((await account.LoginAsync(new(user.Email, Password))).OnboardingRequired);
        Assert.True((await account.GetCurrentSessionAsync(Principal(id))).OnboardingRequired);
    }
}
