using System.Security.Claims;
using System.Text.Json;
using esham.BLL.DTOs;
using esham.BLL.DTOs.UserCategories;
using esham.BLL.Interfaces;
using esham.BLL.Services;
using esham.DAL.Data;
using esham.DAL.Entities;
using esham.PL.Endpoints;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Routing;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
using static esham.Tests.AccountFinalizationTests;

namespace esham.Tests;

public sealed class UserCategoryServiceTests
{
    internal static async Task<Category> CategoryAsync(AppDbContext db, bool active = true)
    {
        // Identifiers are deliberately unrelated to frontend order/names.
        var category = new Category { NameAr = "تصنيف", NameEn = "Category", DisplayOrder = 90, IsActive = active };
        db.Categories.Add(category);
        await db.SaveChangesAsync();
        return category;
    }

    internal static UserCategoryService Service(IServiceProvider services) =>
        new(services.GetRequiredService<AppDbContext>(), services.GetRequiredService<UserManager<ApplicationUser>>());

    internal static async Task Grant(IServiceProvider services, string id, params string[] roles)
    {
        var users = services.GetRequiredService<UserManager<ApplicationUser>>();
        Assert.True((await users.AddToRolesAsync((await users.FindByIdAsync(id))!, roles)).Succeeded);
    }

    [Theory]
    [InlineData("learning", "Learner")]
    [InlineData("teaching", "Instructor")]
    public async Task Selects_active_guid_categories_using_membership_even_with_a_different_persona(string kind, string role)
    {
        using var provider = Services();
        using var scope = provider.CreateScope();
        var services = scope.ServiceProvider;
        var id = await Seed(services);
        await Grant(services, id, role);
        var db = services.GetRequiredService<AppDbContext>();
        var user = await db.Users.SingleAsync();
        user.Role = role == "Learner" ? "instructor" : "learner";
        user.Interests = [2]; user.TeachingAreas = [4];
        await db.SaveChangesAsync();
        var category = await CategoryAsync(db);
        var result = await Service(services).ReplaceCurrentAsync(Principal(id), kind, new([category.Id]));
        Assert.Equal(ServiceFailure.None, result.Failure);
        var selected = await db.UserCategories.SingleAsync();
        Assert.Equal(id, selected.UserId);
        Assert.Equal(category.Id, selected.CategoryId);
        Assert.Equal(kind, selected.Kind);
        user = await db.Users.SingleAsync();
        Assert.Equal(kind == "learning" ? [] : new[] { 2 }, user.Interests);
        Assert.Equal(kind == "teaching" ? [] : new[] { 4 }, user.TeachingAreas);
        Assert.Empty(await db.Wallets.ToListAsync());
        Assert.Empty(await db.PointTransactions.ToListAsync());
    }

    [Theory]
    [InlineData("inactive")]
    [InlineData("missing")]
    [InlineData("duplicate")]
    [InlineData("emptyGuid")]
    [InlineData("null")]
    public async Task Invalid_selection_preserves_previous_rows_and_profile(string invalid)
    {
        using var provider = Services();
        using var scope = provider.CreateScope();
        var services = scope.ServiceProvider;
        var id = await Seed(services);
        await Grant(services, id, "Learner");
        var db = services.GetRequiredService<AppDbContext>();
        var original = await CategoryAsync(db);
        var inactive = await CategoryAsync(db, active: false);
        db.UserCategories.Add(new UserCategory { UserId = id, CategoryId = original.Id, Kind = "learning" });
        (await db.Users.SingleAsync()).Interests = [0];
        await db.SaveChangesAsync();
        Guid[]? ids = invalid switch
        {
            "inactive" => [original.Id, inactive.Id], "missing" => [original.Id, Guid.NewGuid()],
            "duplicate" => [original.Id, original.Id], "emptyGuid" => [Guid.Empty], _ => null,
        };
        var result = await Service(services).ReplaceCurrentAsync(Principal(id), "learning", new(ids));
        Assert.Equal(ServiceFailure.Validation, result.Failure);
        Assert.Equal(original.Id, (await db.UserCategories.SingleAsync()).CategoryId);
        Assert.Equal(new[] { 0 }, (await db.Users.SingleAsync()).Interests);
    }

    [Theory]
    [InlineData("both", "Instructor", "learning")]
    [InlineData("both", "Learner", "teaching")]
    [InlineData("learner", "GeneralAdmin", "learning")]
    [InlineData("instructor", "CategoryAdmin", "teaching")]
    public async Task Persona_admin_and_forged_claims_do_not_replace_actual_required_membership(string persona, string role, string kind)
    {
        using var provider = Services();
        using var scope = provider.CreateScope();
        var services = scope.ServiceProvider;
        var id = await Seed(services);
        await Grant(services, id, role);
        var db = services.GetRequiredService<AppDbContext>();
        (await db.Users.SingleAsync()).Role = persona;
        await db.SaveChangesAsync();
        var category = await CategoryAsync(db);
        var forged = new ClaimsPrincipal(new ClaimsIdentity([
            new Claim(ClaimTypes.NameIdentifier, id), new Claim(ClaimTypes.Role, kind == "learning" ? "Learner" : "Instructor")], "test"));
        var result = await Service(services).ReplaceCurrentAsync(forged, kind, new([category.Id]));
        Assert.Equal(ServiceFailure.Forbidden, result.Failure);
        Assert.Empty(await db.UserCategories.ToListAsync());
    }

    [Fact]
    public async Task Both_memberships_allow_the_same_category_in_both_kinds_and_get_only_own_history()
    {
        using var provider = Services();
        using var scope = provider.CreateScope();
        var services = scope.ServiceProvider;
        var id = await Seed(services);
        var otherId = await Seed(services);
        await Grant(services, id, "Learner", "Instructor");
        var db = services.GetRequiredService<AppDbContext>();
        var selected = await CategoryAsync(db);
        var other = await CategoryAsync(db);
        db.UserCategories.Add(new UserCategory { UserId = otherId, CategoryId = other.Id, Kind = "learning" });
        await db.SaveChangesAsync();
        var service = Service(services);
        foreach (var kind in new[] { "learning", "teaching" })
            Assert.Equal(ServiceFailure.None, (await service.ReplaceCurrentAsync(Principal(id), kind, new([selected.Id]))).Failure);
        var result = await service.GetCurrentAsync(Principal(id));
        Assert.Equal(new[] { selected.Id }, result.Value!.LearningCategoryIds);
        Assert.Equal(new[] { selected.Id }, result.Value.TeachingCategoryIds);
        Assert.Equal(other.Id, (await db.UserCategories.SingleAsync(x => x.UserId == otherId)).CategoryId);
        // Reads retain history after deactivation or membership removal.
        (await db.Categories.SingleAsync(x => x.Id == selected.Id)).IsActive = false;
        await db.SaveChangesAsync();
        var users = services.GetRequiredService<UserManager<ApplicationUser>>();
        Assert.True((await users.RemoveFromRolesAsync((await users.FindByIdAsync(id))!, ["Learner", "Instructor"])).Succeeded);
        Assert.Equal(new[] { selected.Id }, (await service.GetCurrentAsync(Principal(id))).Value!.LearningCategoryIds);
    }

    [Fact]
    public async Task Replacements_are_idempotent_preserve_retained_timestamps_and_leave_other_kind_untouched()
    {
        using var provider = Services();
        using var scope = provider.CreateScope();
        var services = scope.ServiceProvider;
        var id = await Seed(services);
        await Grant(services, id, "Learner", "Instructor");
        var db = services.GetRequiredService<AppDbContext>();
        var a = await CategoryAsync(db); var b = await CategoryAsync(db); var c = await CategoryAsync(db);
        var service = Service(services);
        Assert.Equal(ServiceFailure.None, (await service.ReplaceCurrentAsync(Principal(id), "learning", new([a.Id, b.Id]))).Failure);
        Assert.Equal(ServiceFailure.None, (await service.ReplaceCurrentAsync(Principal(id), "teaching", new([a.Id]))).Failure);
        var retainedAt = (await db.UserCategories.SingleAsync(x => x.CategoryId == b.Id)).CreatedAt;
        for (var retry = 0; retry < 3; retry++)
            Assert.Equal(ServiceFailure.None, (await service.ReplaceCurrentAsync(Principal(id), "learning", new([b.Id, c.Id]))).Failure);
        Assert.Equal(retainedAt, (await db.UserCategories.SingleAsync(x => x.CategoryId == b.Id)).CreatedAt);
        Assert.Equal(3, await db.UserCategories.CountAsync());
        var response = (await service.ReplaceCurrentAsync(Principal(id), "learning", new([]))).Value!;
        Assert.Empty(response.LearningCategoryIds);
        Assert.Equal(new[] { a.Id }, response.TeachingCategoryIds);
    }

    [Theory]
    [InlineData("anonymous")]
    [InlineData("forgedIdentifier")]
    [InlineData("deletedUser")]
    public async Task Unauthenticated_or_missing_users_cannot_read_or_replace(string actor)
    {
        using var provider = Services();
        using var scope = provider.CreateScope();
        var id = await Seed(scope.ServiceProvider);
        var principal = actor switch
        {
            "anonymous" => new ClaimsPrincipal(new ClaimsIdentity()),
            "forgedIdentifier" => new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, id)])),
            _ => Principal("does-not-exist"),
        };
        var service = Service(scope.ServiceProvider);
        Assert.Equal(ServiceFailure.Forbidden, (await service.GetCurrentAsync(principal)).Failure);
        Assert.Equal(ServiceFailure.Forbidden, (await service.ReplaceCurrentAsync(principal, "learning", new([]))).Failure);
    }

    [Fact]
    public async Task Guid_selections_are_consistent_in_login_session_and_profile_edits_without_touching_wallet()
    {
        using var provider = Services();
        using var scope = provider.CreateScope();
        var services = scope.ServiceProvider;
        var id = await Seed(services);
        var account = services.GetRequiredService<AccountService>();
        Assert.Equal(AccountFailure.None, (await account.UpdateCurrentProfileAsync(Principal(id), Profile("both"))).Failure);
        var db = services.GetRequiredService<AppDbContext>();
        var ledgerId = (await db.PointTransactions.SingleAsync()).Id;
        var category = await CategoryAsync(db);
        var service = Service(services);
        foreach (var kind in new[] { "learning", "teaching" })
            Assert.Equal(ServiceFailure.None, (await service.ReplaceCurrentAsync(Principal(id), kind, new([category.Id]))).Failure);
        var session = await account.GetCurrentSessionAsync(Principal(id));
        Assert.False(session.OnboardingRequired);
        Assert.Empty(session.Profile!.Interests);
        Assert.Empty(session.Profile.TeachingAreas);
        Assert.Equal(new[] { category.Id }, session.Profile.LearningCategoryIds);
        Assert.Equal(new[] { category.Id }, session.Profile.TeachingCategoryIds);
        var user = await db.Users.SingleAsync();
        var login = await account.LoginAsync(new(user.Email, Password));
        Assert.Equal(AccountFailure.None, login.Failure);
        Assert.Equal(session.Profile.LearningCategoryIds, login.Profile!.LearningCategoryIds);
        // Current frontend indexes cannot overwrite GUID selections through PATCH /me.
        Assert.Equal(AccountFailure.Conflict, (await account.UpdateCurrentProfileAsync(Principal(id), Profile("both"))).Failure);
        var edit = Profile("both") with { Name = "Edited name", Interests = [], TeachingAreas = [] };
        Assert.Equal(AccountFailure.None, (await account.UpdateCurrentProfileAsync(Principal(id), edit)).Failure);
        Assert.Equal(2, await db.UserCategories.CountAsync());
        Assert.Equal(ledgerId, (await db.PointTransactions.SingleAsync()).Id);
        Assert.Equal(20, (await db.Wallets.SingleAsync()).Balance);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Clearing_or_deactivating_required_guid_interests_requires_onboarding_again(bool deactivate)
    {
        using var provider = Services();
        using var scope = provider.CreateScope();
        var services = scope.ServiceProvider;
        var id = await Seed(services);
        var account = services.GetRequiredService<AccountService>();
        Assert.Equal(AccountFailure.None, (await account.UpdateCurrentProfileAsync(Principal(id), Profile("learner"))).Failure);
        var db = services.GetRequiredService<AppDbContext>();
        var category = await CategoryAsync(db);
        var service = Service(services);
        Assert.Equal(ServiceFailure.None, (await service.ReplaceCurrentAsync(Principal(id), "learning", new([category.Id]))).Failure);
        if (deactivate)
        {
            (await db.Categories.SingleAsync()).IsActive = false;
            await db.SaveChangesAsync();
        }
        else Assert.Equal(ServiceFailure.None, (await service.ReplaceCurrentAsync(Principal(id), "learning", new([]))).Failure);
        Assert.True((await account.GetCurrentSessionAsync(Principal(id))).OnboardingRequired);
        var user = await db.Users.SingleAsync();
        var login = await account.LoginAsync(new(user.Email, Password));
        Assert.Equal(AccountFailure.None, login.Failure);
        Assert.True(login.OnboardingRequired);
    }

    [Fact]
    public async Task Legacy_indexes_are_not_guessed_from_names_order_or_new_guids()
    {
        using var provider = Services();
        using var scope = provider.CreateScope();
        var services = scope.ServiceProvider;
        var id = await Seed(services);
        var db = services.GetRequiredService<AppDbContext>();
        db.Categories.Add(new Category { NameEn = "Programming", NameAr = "البرمجة", DisplayOrder = 0 });
        await db.SaveChangesAsync();
        var account = services.GetRequiredService<AccountService>();
        Assert.Equal(AccountFailure.None, (await account.UpdateCurrentProfileAsync(Principal(id), Profile("learner"))).Failure);
        var session = await account.GetCurrentSessionAsync(Principal(id));
        Assert.Equal(new[] { 0 }, session.Profile!.Interests);
        Assert.Empty(session.Profile.LearningCategoryIds);
        Assert.Empty((await Service(services).GetCurrentAsync(Principal(id))).Value!.LearningCategoryIds);
    }

    [Fact]
    public async Task Replacement_prevents_a_stale_identity_profile_write_from_restoring_legacy_indexes()
    {
        using var provider = Services();
        using var staleScope = provider.CreateScope();
        var staleServices = staleScope.ServiceProvider;
        var id = await Seed(staleServices);
        await Grant(staleServices, id, "Learner");
        var staleUsers = staleServices.GetRequiredService<UserManager<ApplicationUser>>();
        var staleUser = (await staleUsers.FindByIdAsync(id))!;
        staleUser.Interests = [0];
        Assert.True((await staleUsers.UpdateAsync(staleUser)).Succeeded);
        using (var updateScope = provider.CreateScope())
        {
            var db = updateScope.ServiceProvider.GetRequiredService<AppDbContext>();
            var category = await CategoryAsync(db);
            Assert.Equal(ServiceFailure.None, (await Service(updateScope.ServiceProvider)
                .ReplaceCurrentAsync(Principal(id), "learning", new([category.Id]))).Failure);
        }
        staleUser.Name = "Stale profile";
        var result = await staleUsers.UpdateAsync(staleUser);
        Assert.False(result.Succeeded);
        Assert.Contains(result.Errors, x => x.Code == "ConcurrencyFailure");
        using var verifyScope = provider.CreateScope();
        Assert.Empty((await verifyScope.ServiceProvider.GetRequiredService<AppDbContext>().Users.SingleAsync()).Interests);
    }

    [Theory]
    [InlineData("Learner")]
    [InlineData("Learning")]
    [InlineData("other")]
    public async Task Invalid_kinds_are_rejected(string kind)
    {
        using var provider = Services();
        using var scope = provider.CreateScope();
        var id = await Seed(scope.ServiceProvider);
        Assert.Equal(ServiceFailure.Validation, (await Service(scope.ServiceProvider).ReplaceCurrentAsync(Principal(id), kind, new([]))).Failure);
    }

    [Theory]
    [InlineData("{}")]
    [InlineData("{\"categoryIds\":[0]}")]
    [InlineData("{\"categoryIds\":[\"not-a-guid\"]}")]
    [InlineData("{\"categoryIds\":[],\"userId\":\"another-user\"}")]
    public void Http_contract_rejects_missing_or_invalid_identifiers_and_ownership_fields(string json)
    {
        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<ReplaceUserCategoriesRequest>(json, new JsonSerializerOptions(JsonSerializerDefaults.Web)));
    }

    [Fact]
    public async Task All_user_category_endpoints_require_authentication_and_have_no_user_identifier_route()
    {
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions { EnvironmentName = "Testing" });
        builder.Services.AddScoped<IUserCategoryService, UserCategoryService>();
        await using var app = builder.Build();
        app.MapUserCategoryEndpoints();
        var endpoints = ((IEndpointRouteBuilder)app).DataSources.SelectMany(x => x.Endpoints).Cast<RouteEndpoint>().ToArray();
        Assert.Equal(2, endpoints.Length);
        Assert.All(endpoints, endpoint =>
        {
            Assert.NotEmpty(endpoint.Metadata.GetOrderedMetadata<IAuthorizeData>());
            Assert.DoesNotContain(endpoint.RoutePattern.Parameters, x => x.Name == "userId");
        });
    }
}
