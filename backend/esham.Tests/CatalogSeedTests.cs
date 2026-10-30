using esham.BLL.Services;
using esham.DAL.Data;
using esham.DAL.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.EntityFrameworkCore;
using Xunit;
using static esham.Tests.AccountFinalizationTests;
namespace esham.Tests;

public sealed class CatalogSeedTests
{
    [Fact] public async Task Categories_reuse_existing_programming_preserve_custom_records_and_are_idempotent()
    {
        using var provider = Services(); using var scope = provider.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var programming = new Category { NameAr = "البرمجة", NameEn = " programming ", IsActive = false, DisplayOrder = 99 };
        var custom = new Category { NameAr = "فئة خاصة", NameEn = "Custom", DisplayOrder = 50, DescriptionEn = "Preserved" };
        db.AddRange(programming, custom); await db.SaveChangesAsync();
        var first = await DefaultCategorySeeder.SeedAsync(db); Assert.Equal(programming.Id, first[1]);
        var timestamps = await db.Categories.AsNoTracking().ToDictionaryAsync(x => x.Id, x => x.UpdatedAt);
        var again = await DefaultCategorySeeder.SeedAsync(db); Assert.Equal(first.OrderBy(x => x.Key), again.OrderBy(x => x.Key));
        Assert.Equal(7, await db.Categories.CountAsync());
        foreach (var item in DefaultCategorySeeder.Defaults)
        {
            var row = await db.Categories.SingleAsync(x => x.Id == first[item.Order]);
            Assert.Equal(item.Ar, row.NameAr); Assert.Equal(item.En, row.NameEn); Assert.True(row.IsActive); Assert.Equal(item.Order, row.DisplayOrder);
            Assert.Equal(timestamps[row.Id], row.UpdatedAt);
        }
        Assert.Equal("Preserved", (await db.Categories.SingleAsync(x => x.Id == custom.Id)).DescriptionEn);
    }
    [Theory] [InlineData(true)] [InlineData(false)]
    public async Task Ambiguous_names_and_reserved_id_collisions_never_merge_or_take_over_user_categories(bool ambiguous)
    {
        using var provider = Services(); using var scope = provider.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        if (ambiguous) db.AddRange(new Category { NameAr = "البرمجة", NameEn = "Programming" }, new Category { NameAr = "البرمجة", NameEn = "Programming" });
        else db.Categories.Add(new() { Id = DefaultCategorySeeder.Defaults[0].Id, NameAr = "خاص", NameEn = "Custom" });
        await db.SaveChangesAsync();
        await Assert.ThrowsAsync<InvalidOperationException>(() => DefaultCategorySeeder.SeedAsync(db));
        Assert.Equal(ambiguous ? 2 : 1, await db.Categories.AsNoTracking().CountAsync());
    }
    [Fact] public async Task Demo_seeding_uses_dedicated_locked_owner_publishes_each_category_and_preserves_real_courses()
    {
        using var provider = Services(); using var scope = provider.CreateScope(); var s = scope.ServiceProvider;
        var db = s.GetRequiredService<AppDbContext>(); var users = s.GetRequiredService<UserManager<ApplicationUser>>(); var roles = s.GetRequiredService<RoleManager<IdentityRole>>();
        await esham.PL.Development.DevelopmentIdentityRoles.SeedAsync(roles);
        var categories = await DefaultCategorySeeder.SeedAsync(db);
        var real = new Course { OwnerUserId = "real-user" }; var draft = new CourseVersion { CourseId = real.Id, CategoryId = categories[1], TitleEn = "Real draft" };
        db.AddRange(real, draft); await db.SaveChangesAsync(); real.DraftVersionId = draft.Id; await db.SaveChangesAsync();
        var originalTime = real.UpdatedAt;
        await DemoCourseSeeder.SeedAsync(db, users, roles, categories);
        var demo = await users.FindByIdAsync(DemoCourseSeeder.OwnerId); Assert.NotNull(demo); Assert.Null(demo.PasswordHash);
        Assert.True(await users.IsLockedOutAsync(demo)); Assert.True(await users.IsInRoleAsync(demo, "Instructor"));
        var published = await new CourseService(db).GetPublicAsync(); Assert.Equal(12, published.Count);
        foreach (var category in categories.Values) Assert.Equal(2, published.Count(x => x.CategoryId == category));
        Assert.All(published, x => { Assert.Equal(DemoCourseSeeder.OwnerId, x.Instructor.Id); Assert.StartsWith("[Demo]", x.TitleEn); });
        var version = await db.CourseVersions.SingleAsync(x => x.Id == DemoCourseSeeder.Id(4, 0)); version.TitleEn = "[Demo] Preserved edit"; await db.SaveChangesAsync();
        await DemoCourseSeeder.SeedAsync(db, users, roles, categories);
        Assert.Equal(13, await db.Courses.CountAsync()); Assert.Equal(13, await db.CourseVersions.CountAsync());
        Assert.Equal(12, await db.CourseSections.CountAsync()); Assert.Equal(12, await db.Lessons.CountAsync()); Assert.Equal(12, await db.CourseTasks.CountAsync());
        Assert.Equal("[Demo] Preserved edit", (await db.CourseVersions.SingleAsync(x => x.Id == version.Id)).TitleEn);
        var unchanged = await db.Courses.SingleAsync(x => x.Id == real.Id); Assert.Equal(originalTime, unchanged.UpdatedAt); Assert.Equal(draft.Id, unchanged.DraftVersionId);
        Assert.Equal("Real draft", (await db.CourseVersions.SingleAsync(x => x.Id == draft.Id)).TitleEn);
        Assert.All(await db.Courses.Where(x => x.OwnerUserId == DemoCourseSeeder.OwnerId).ToListAsync(), x => { Assert.NotNull(x.PublishedVersionId); Assert.Null(x.DraftVersionId); Assert.True(x.EnrollmentPaused); });
        Assert.Empty(await db.Wallets.ToListAsync()); Assert.Empty(await db.Notifications.ToListAsync());
    }
    [Fact] public async Task Existing_account_with_reserved_email_is_not_adopted_as_demo_owner()
    {
        using var provider = Services(); using var scope = provider.CreateScope(); var s = scope.ServiceProvider; var db = s.GetRequiredService<AppDbContext>();
        var users = s.GetRequiredService<UserManager<ApplicationUser>>(); var roles = s.GetRequiredService<RoleManager<IdentityRole>>();
        await esham.PL.Development.DevelopmentIdentityRoles.SeedAsync(roles); var categories = await DefaultCategorySeeder.SeedAsync(db);
        var realUser = new ApplicationUser { UserName = "real_user", Email = DemoCourseSeeder.OwnerEmail }; Assert.True((await users.CreateAsync(realUser)).Succeeded);
        await Assert.ThrowsAsync<InvalidOperationException>(() => DemoCourseSeeder.SeedAsync(db, users, roles, categories));
        Assert.Empty(await db.Courses.ToListAsync()); Assert.Empty(await users.GetRolesAsync(realUser));
    }
}
