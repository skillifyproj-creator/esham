using esham.BLL.Interfaces;
using esham.BLL.Services;
using esham.DAL.Data;
using esham.DAL.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
using static esham.Tests.AccountFinalizationTests;
namespace esham.Tests;

public sealed class AccountPersonaSynchronizationTests
{
    [Theory] [InlineData("learner", "Learner")] [InlineData("instructor", "Instructor")]
    [InlineData("both", "Instructor,Learner")]
    public async Task Newly_registered_accounts_finalize_idempotently_and_repair_missing_memberships(string persona, string expected)
    {
        using var provider = Services(); using var scope = provider.CreateScope(); var services = scope.ServiceProvider;
        await esham.PL.Development.DevelopmentIdentityRoles.SeedAsync(services.GetRequiredService<RoleManager<IdentityRole>>());
        Http(services, "registration");
        var account = services.GetRequiredService<AccountService>();
        var email = $"{Guid.NewGuid():N}@example.test";
        var registration = await account.RegisterAsync(new("New UI user", email, Password));
        Assert.Equal(AccountFailure.None, registration.Failure); Assert.True(registration.OnboardingRequired);
        var id = registration.Profile!.Id; Http(services, id);
        var db = services.GetRequiredService<AppDbContext>(); var users = services.GetRequiredService<UserManager<ApplicationUser>>();
        Assert.Empty(await db.UserRoles.ToListAsync()); // Registration cannot guess a persona before selection.
        var category = new Category { NameAr = "مجال", NameEn = "Category" }; db.Categories.Add(category); await db.SaveChangesAsync();
        var command = Profile(persona, "new_user") with { Interests = null, TeachingAreas = null,
            LearningCategoryIds = persona == "instructor" ? null : [category.Id],
            TeachingCategoryIds = persona == "learner" ? null : [category.Id] };
        for (var attempt = 0; attempt < 3; attempt++)
        {
            var result = await account.UpdateCurrentProfileAsync(Principal(id), command);
            Assert.Equal(AccountFailure.None, result.Failure);
            Assert.Equal(expected, string.Join(',', result.Profile!.Roles.Order()));
            Assert.Equal(persona, result.Profile.Role);
        }
        var welcomeId = (await db.PointTransactions.SingleAsync()).Id;
        var user = await users.FindByIdAsync(id); var stamp = user!.SecurityStamp;
        var beforeSession = await account.GetCurrentSessionAsync(Principal(id));
        Assert.False(beforeSession.OnboardingRequired);
        Assert.Equal(stamp, (await users.FindByIdAsync(id))!.SecurityStamp); // Session reads never grant/change roles.
        Assert.True((await users.RemoveFromRolesAsync(user, expected.Split(','))).Succeeded);
        Assert.True((await account.GetCurrentSessionAsync(Principal(id))).OnboardingRequired);
        Assert.Equal(AccountFailure.None, (await account.UpdateCurrentProfileAsync(Principal(id), command)).Failure);
        var login = await account.LoginAsync(new(email, Password));
        Assert.Equal(AccountFailure.None, login.Failure); Assert.False(login.OnboardingRequired);
        Assert.Equal(expected, string.Join(',', login.Profile!.Roles.Order()));
        Assert.Equal(expected.Split(',').Length, await db.UserRoles.CountAsync());
        Assert.Equal(welcomeId, (await db.PointTransactions.SingleAsync()).Id);
        Assert.Equal(4, await db.Roles.CountAsync()); Assert.False(await db.Roles.AnyAsync(x => x.NormalizedName == "COMBINED"));
    }

    [Theory] [InlineData(false)] [InlineData(true)]
    public async Task Persona_transitions_respect_identity_normalization_and_preserve_administrative_memberships(bool lowerCaseNames)
    {
        using var provider = Services(); using var scope = provider.CreateScope(); var services = scope.ServiceProvider;
        var id = await Seed(services, administrator: true); var db = services.GetRequiredService<AppDbContext>();
        if (lowerCaseNames)
        {
            foreach (var role in await db.Roles.Where(x => x.Name == "Learner" || x.Name == "Instructor").ToListAsync())
                role.Name = role.Name!.ToLowerInvariant();
            await db.SaveChangesAsync();
        }
        var account = services.GetRequiredService<AccountService>();
        foreach (var persona in new[] { "both", "learner", "instructor", "both", "both" })
        {
            Assert.Equal(AccountFailure.None, (await account.UpdateCurrentProfileAsync(Principal(id), Profile(persona))).Failure);
            var session = await account.GetCurrentSessionAsync(Principal(id)); Assert.False(session.OnboardingRequired);
            var roles = session.Profile!.Roles.ToHashSet(StringComparer.OrdinalIgnoreCase);
            Assert.Contains("GeneralAdmin", roles); Assert.Contains("CategoryAdmin", roles);
            Assert.Equal(persona != "instructor", roles.Contains("Learner"));
            Assert.Equal(persona != "learner", roles.Contains("Instructor"));
            Assert.Equal(persona == "both" ? 4 : 3, await db.UserRoles.CountAsync());
        }
        Assert.False(await db.Roles.AnyAsync(x => x.NormalizedName == "COMBINED"));
    }
}
