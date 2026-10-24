using System.Text.Json;
using esham.BLL.DTOs;
using esham.BLL.DTOs.Categories;
using esham.BLL.DTOs.Courses;
using esham.BLL.Services;
using esham.DAL.Data;
using esham.DAL.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Xunit;
namespace esham.Tests;

public sealed class ContentApiServiceTests
{
    private static AppDbContext Context() => new(new DbContextOptionsBuilder<AppDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString()).ReplaceService<IDbContextTransactionManager, TestTransactionManager>().Options);
    private static readonly CourseActor Owner = new("owner", true, false);
    private static async Task<(Category Category, Course Course, CourseVersion Draft, CourseVersion Published)> Seed(AppDbContext db)
    {
        var category = new Category { NameAr = "تصميم", NameEn = "Design" };
        var course = new Course { OwnerUserId = Owner.UserId };
        var draft = new CourseVersion { CourseId = course.Id, CategoryId = category.Id, VersionNumber = 2, TitleEn = "PRIVATE DRAFT" };
        var published = new CourseVersion { CourseId = course.Id, CategoryId = category.Id, VersionNumber = 1,
            TitleEn = "Published", DescriptionEn = new string('a', 350), ReviewStatus = "approved", ApprovedAt = DateTimeOffset.UtcNow,
            Objectives = [new LocalizedText(En: "Public objective")] };
        course.DraftVersionId = draft.Id; course.PublishedVersionId = published.Id;
        db.Users.Add(new ApplicationUser { Id = Owner.UserId, Name = "Teacher" });
        db.Categories.Add(category); db.Courses.Add(course); db.CourseVersions.AddRange(draft, published);
        await db.SaveChangesAsync(); return (category, course, draft, published);
    }
    [Fact] public async Task Public_reads_only_the_approved_version_and_card_previews()
    {
        await using var db = Context(); var data = await Seed(db); var service = new CourseService(db);
        var cards = await service.GetPublicAsync(); Assert.Single(cards); Assert.Equal("Published", cards[0].TitleEn);
        Assert.Equal(300, cards[0].DescriptionEn!.Length); Assert.Null(cards[0].Objectives);
        var detail = await service.GetPublicAsync(data.Course.Id); Assert.Equal(ServiceFailure.None, detail.Failure);
        Assert.Equal(350, detail.Value!.DescriptionEn!.Length); Assert.Equal("Public objective", Assert.Single(detail.Value.Objectives!).En);
        Assert.DoesNotContain("PRIVATE DRAFT", JsonSerializer.Serialize(detail.Value));
    }
    [Theory] [InlineData("suspended")] [InlineData("archived")]
    public async Task Public_hides_unsafe_courses(string status)
    {
        await using var db = Context(); var data = await Seed(db); data.Course.SafetyStatus = status; await db.SaveChangesAsync();
        Assert.Empty(await new CourseService(db).GetPublicAsync());
    }
    [Fact] public async Task Public_hides_pending_public_pointer_and_inactive_category()
    {
        await using var db = Context(); var data = await Seed(db); data.Published.ReviewStatus = "pending"; await db.SaveChangesAsync();
        var service = new CourseService(db); Assert.Empty(await service.GetPublicAsync());
        data.Published.ReviewStatus = "approved"; data.Category.IsActive = false; await db.SaveChangesAsync(); Assert.Empty(await service.GetPublicAsync());
    }
    [Fact] public async Task Mine_and_private_detail_enforce_ownership()
    {
        await using var db = Context(); var data = await Seed(db); var service = new CourseService(db); var stranger = new CourseActor("stranger", true, false);
        Assert.Empty((await service.GetMineAsync(stranger)).Value!);
        Assert.Equal(ServiceFailure.Forbidden, (await service.GetDraftAsync(data.Course.Id, stranger)).Failure);
        Assert.Equal(ServiceFailure.Forbidden, (await service.GetAsync(data.Course.Id, stranger)).Failure);
        Assert.Equal(ServiceFailure.None, (await service.GetAsync(data.Course.Id, new("admin", false, true))).Failure);
    }
    [Fact] public async Task Patch_preserves_omitted_fields_clears_explicit_null_and_does_not_edit_publication()
    {
        await using var db = Context(); var data = await Seed(db); var oldTime = data.Course.UpdatedAt;
        var patch = JsonSerializer.Deserialize<UpdateCourseDraftRequest>("{\"titleEn\":\"Edited\",\"descriptionAr\":null}", new JsonSerializerOptions(JsonSerializerDefaults.Web))!;
        var result = await new CourseService(db).UpdateDraftAsync(data.Course.Id, Owner, patch);
        Assert.Equal(ServiceFailure.None, result.Failure); Assert.Equal("Edited", result.Value!.TitleEn);
        Assert.Equal(data.Category.Id, result.Value.CategoryId); Assert.Null(result.Value.DescriptionAr);
        var publicVersion = await db.CourseVersions.AsNoTracking().SingleAsync(x => x.Id == data.Published.Id);
        Assert.Equal("Published", publicVersion.TitleEn); Assert.Equal("approved", publicVersion.ReviewStatus);
        Assert.True((await db.Courses.FindAsync(data.Course.Id))!.UpdatedAt >= oldTime);
    }
    [Theory] [InlineData("pending")] [InlineData("approved")] [InlineData("rejected")] [InlineData("changes_requested")]
    public async Task Non_draft_versions_cannot_be_patched(string status)
    {
        await using var db = Context(); var data = await Seed(db); data.Draft.ReviewStatus = status; await db.SaveChangesAsync();
        var result = await new CourseService(db).UpdateDraftAsync(data.Course.Id, Owner, new() { TitleEn = "Changed" });
        Assert.Equal(ServiceFailure.Conflict, result.Failure);
    }
    [Fact] public async Task Foreign_owner_and_null_required_fields_are_rejected()
    {
        await using var db = Context(); var data = await Seed(db); var service = new CourseService(db);
        Assert.Equal(ServiceFailure.Forbidden, (await service.UpdateDraftAsync(data.Course.Id, new("other", true, false), new())).Failure);
        Assert.Equal(ServiceFailure.Validation, (await service.UpdateDraftAsync(data.Course.Id, Owner, new() { CategoryId = null })).Failure);
    }
    [Fact] public async Task Create_assigns_owner_and_server_controlled_version_without_publication()
    {
        await using var db = Context(); var data = await Seed(db);
        var result = await new CourseService(db).CreateAsync(Owner, new(data.Category.Id, "عنوان", "Draft", null, null, []));
        Assert.Equal(ServiceFailure.None, result.Failure); Assert.Equal(Owner.UserId, result.Value!.Owner.Id);
        Assert.Null(result.Value.PublishedVersionId); Assert.Equal(1, result.Value.Draft!.VersionNumber);
        Assert.Equal("draft", result.Value.Draft.ReviewStatus); Assert.Equal(result.Value.Draft.Id, result.Value.DraftVersionId);
    }
    [Fact] public async Task Create_rejects_inactive_category_and_another_users_cover()
    {
        await using var db = Context(); var data = await Seed(db); var service = new CourseService(db);
        data.Category.IsActive = false; await db.SaveChangesAsync();
        Assert.Equal(ServiceFailure.Validation, (await service.CreateAsync(Owner, new(data.Category.Id, null, null, null, null, []))).Failure);
        data.Category.IsActive = true; db.Categories.Update(data.Category);
        var asset = new MediaAsset { OwnerUserId = "other", MediaType = "image", MimeType = "image/jpeg", SizeBytes = 10,
            ContentHash = "hash", StorageKey = "image" }; db.MediaAssets.Add(asset); await db.SaveChangesAsync();
        Assert.Equal(ServiceFailure.Validation, (await service.CreateAsync(Owner, new(data.Category.Id, null, null, null, null, [], CoverMediaAssetId: asset.Id))).Failure);
    }
    [Fact] public async Task Category_tree_rejects_self_and_descendant_parents()
    {
        await using var db = Context(); var parent = new Category { NameAr = "أ", NameEn = "A" };
        var child = new Category { NameAr = "ب", NameEn = "B", ParentCategoryId = parent.Id };
        db.Categories.AddRange(parent, child); await db.SaveChangesAsync(); var service = new CategoryService(db);
        Assert.Equal(ServiceFailure.Validation, (await service.UpdateAsync(parent.Id, new("أ", "A", null, null, parent.Id, 0))).Failure);
        Assert.Equal(ServiceFailure.Validation, (await service.UpdateAsync(parent.Id, new("أ", "A", null, null, child.Id, 0))).Failure);
    }
    [Fact] public async Task Category_validation_missing_parent_and_status_reads()
    {
        await using var db = Context(); var service = new CategoryService(db);
        Assert.Equal(ServiceFailure.Validation, (await service.CreateAsync(new("أ", "A", null, null, null, -1))).Failure);
        Assert.Equal(ServiceFailure.Validation, (await service.CreateAsync(new("أ", null, null, null, null, 0))).Failure);
        Assert.Equal(ServiceFailure.Validation, (await service.CreateAsync(new("أ", "A", null, null, Guid.NewGuid(), 0))).Failure);
        Assert.Equal(ServiceFailure.NotFound, (await service.UpdateAsync(Guid.NewGuid(), new("أ", "A", null, null, null, 0))).Failure);
        var created = await service.CreateAsync(new("أ", "A", null, null, null, 0)); Assert.Equal(ServiceFailure.None, created.Failure);
        Assert.Single(await service.GetActiveAsync()); await service.ChangeStatusAsync(created.Value!.Id, false);
        Assert.Empty(await service.GetActiveAsync()); Assert.Equal(ServiceFailure.NotFound, (await service.GetAsync(created.Value.Id)).Failure);
        Assert.Equal(ServiceFailure.None, (await service.ChangeStatusAsync(created.Value.Id, true)).Failure);
    }
    [Fact] public void Patch_rejects_server_controlled_fields_and_tracks_nullable_cover()
    {
        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web);
        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<ChangeCategoryStatusRequest>("{}", options));
        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<CreateCourseRequest>("{\"ownerUserId\":\"attacker\"}", options));
        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<UpdateCourseDraftRequest>("{\"reviewStatus\":\"approved\"}", options));
        var patch = JsonSerializer.Deserialize<UpdateCourseDraftRequest>("{\"coverMediaAssetId\":null}", options)!;
        Assert.Contains(nameof(patch.CoverMediaAssetId), patch.ProvidedFields); Assert.Null(patch.CoverMediaAssetId);
    }
}
