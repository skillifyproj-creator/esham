using System.Security.Cryptography;
using esham.BLL.DTOs;
using esham.BLL.DTOs.Courses;
using esham.BLL.Interfaces;
using esham.BLL.Services;
using esham.DAL.Data;
using esham.DAL.Entities;
using esham.PL.Storage;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Xunit;
namespace esham.Tests;

public sealed class CourseCoverServiceTests
{
    private static readonly CourseActor Owner = new("owner", true, false);
    private static AppDbContext Context() => new(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString())
        .ReplaceService<IDbContextTransactionManager, TestTransactionManager>().Options);
    private static async Task<(Course Course, CourseVersion Draft)> Seed(AppDbContext db)
    {
        var course = new Course { OwnerUserId = Owner.UserId };
        var draft = new CourseVersion { CourseId = course.Id, TitleAr = "دورة", DescriptionEn = "Existing description", Objectives = [new("هدف", null)] };
        course.DraftVersionId = draft.Id; db.AddRange(course, draft); await db.SaveChangesAsync(); return (course, draft);
    }
    private sealed class Store : IMediaStorage
    {
        public Dictionary<string, byte[]> Files { get; } = [];
        public Func<Task>? BeforeSave { get; set; }
        public async Task<StoredMediaFile> SaveAsync(Stream input, string contentType, CancellationToken ct)
        {
            if (BeforeSave != null) await BeforeSave();
            using var output = new MemoryStream(); await input.CopyToAsync(output, ct);
            var bytes = output.ToArray(); var key = Guid.NewGuid().ToString("N"); Files[key] = bytes;
            return new(key, Convert.ToHexString(SHA256.HashData(bytes)), bytes.Length, contentType);
        }
        public Task<Stream?> OpenAsync(string key, CancellationToken ct) => Task.FromResult<Stream?>(Files.TryGetValue(key, out var bytes) ? new MemoryStream(bytes) : null);
        public Task DeleteAsync(string key, CancellationToken ct) { Files.Remove(key); return Task.CompletedTask; }
    }
    private static CoverUploadRequest Request() => new(Guid.NewGuid(), "cover.png", "image/png");
    private static MemoryStream Bytes(byte value = 1) => new([value, 2, 3, 4]);

    [Fact] public async Task Upload_sets_current_version_cover_and_reloads_real_bytes_without_changing_metadata()
    {
        await using var db = Context(); var d = await Seed(db); var store = new Store(); var service = new CourseCoverService(db, store);
        Assert.Null((await service.GetAsync(d.Course.Id, Owner)).Value);
        var request = Request(); var uploaded = (await service.UploadAsync(d.Course.Id, Owner, request, Bytes())).Value!;
        Assert.Equal(d.Draft.Id, uploaded.CourseVersionId);
        var reloaded = (await service.GetAsync(d.Course.Id, Owner)).Value!; Assert.Equal(uploaded, reloaded);
        var draft = await db.CourseVersions.AsNoTracking().SingleAsync();
        Assert.Equal(request.UploadId, draft.CoverMediaAssetId); Assert.Equal("دورة", draft.TitleAr); Assert.Equal("Existing description", draft.DescriptionEn);
        Assert.Equal("هدف", Assert.Single(draft.Objectives).Ar); Assert.Null(draft.SubmittedAt); Assert.Equal("draft", draft.ReviewStatus);
        var asset = await db.MediaAssets.SingleAsync(); Assert.Equal("image", asset.MediaType); Assert.Equal(Owner.UserId, asset.OwnerUserId);
        var content = await service.OpenAsync(d.Course.Id, uploaded.MediaAssetId, Owner);
        await using (var stream = content.Value.Stream) Assert.Equal(1, stream.ReadByte());
        Assert.Equal(ServiceFailure.None, (await service.UploadAsync(d.Course.Id, Owner, request, Bytes())).Failure);
        Assert.Single(await db.MediaAssets.ToListAsync()); Assert.Single(store.Files);
        var replacement = (await service.UploadAsync(d.Course.Id, Owner, Request(), Bytes(5))).Value!;
        Assert.Equal(2, await db.MediaAssets.CountAsync()); Assert.Equal(2, store.Files.Count);
        Assert.Equal(replacement.MediaAssetId, (await service.GetAsync(d.Course.Id, Owner)).Value!.MediaAssetId);
        Assert.Equal(ServiceFailure.NotFound, (await service.OpenAsync(d.Course.Id, uploaded.MediaAssetId, Owner)).Failure);
    }
    [Theory] [InlineData(false, "owner")] [InlineData(true, "other")] [InlineData(false, "")]
    public async Task Ownership_and_role_are_checked_before_file_storage(bool instructor, string user)
    {
        await using var db = Context(); var d = await Seed(db); var store = new Store(); var service = new CourseCoverService(db, store);
        var actor = new CourseActor(user, instructor, false);
        Assert.Equal(ServiceFailure.Forbidden, (await service.UploadAsync(d.Course.Id, actor, Request(), Bytes())).Failure);
        Assert.Equal(ServiceFailure.Forbidden, (await service.GetAsync(d.Course.Id, actor)).Failure);
        Assert.Equal(ServiceFailure.Forbidden, (await service.OpenAsync(d.Course.Id, Guid.NewGuid(), actor)).Failure);
        Assert.Empty(store.Files);
    }
    [Theory] [InlineData("approved")] [InlineData("pending")] [InlineData("published-pointer")] [InlineData("no-draft")] [InlineData("approved-at")]
    public async Task Noneditable_versions_reject_cover_changes(string state)
    {
        await using var db = Context(); var d = await Seed(db);
        if (state == "published-pointer") d.Course.PublishedVersionId = d.Draft.Id;
        else if (state == "no-draft") d.Course.DraftVersionId = null;
        else if (state == "approved-at") d.Draft.ApprovedAt = DateTimeOffset.UtcNow;
        else d.Draft.ReviewStatus = state;
        await db.SaveChangesAsync(); var store = new Store(); var service = new CourseCoverService(db, store);
        Assert.Equal(ServiceFailure.Conflict, (await service.UploadAsync(d.Course.Id, Owner, Request(), Bytes())).Failure); Assert.Empty(store.Files);
    }
    [Fact] public async Task Invalid_metadata_oversize_and_foreign_upload_identity_are_rejected()
    {
        await using var db = Context(); var d = await Seed(db); var other = await Seed(db); var store = new Store(); var service = new CourseCoverService(db, store);
        var request = Request();
        foreach (var invalid in new[] { request with { UploadId = Guid.Empty }, request with { ContentType = "image/svg+xml" }, request with { FileName = "../cover.png" } })
            Assert.Equal(ServiceFailure.Validation, (await service.UploadAsync(d.Course.Id, Owner, invalid, Bytes())).Failure);
        Assert.Equal(ServiceFailure.Validation, (await service.UploadAsync(d.Course.Id, Owner, request, new MemoryStream(new byte[2 * 1024 * 1024 + 1]))).Failure);
        Assert.Empty(store.Files);
        var saved = (await service.UploadAsync(d.Course.Id, Owner, request, Bytes())).Value!;
        Assert.Equal(ServiceFailure.Conflict, (await service.UploadAsync(other.Course.Id, Owner, request, Bytes())).Failure);
        Assert.Equal(ServiceFailure.NotFound, (await service.OpenAsync(other.Course.Id, saved.MediaAssetId, Owner)).Failure);
        Assert.Single(await db.MediaAssets.ToListAsync()); Assert.Single(store.Files);
    }
    [Fact] public async Task Changing_current_draft_during_streaming_cannot_attach_to_a_different_version()
    {
        await using var db = Context(); var d = await Seed(db); var store = new Store();
        store.BeforeSave = async () => {
            var version = new CourseVersion { CourseId = d.Course.Id, VersionNumber = 2 };
            db.CourseVersions.Add(version); var course = await db.Courses.SingleAsync(); course.DraftVersionId = version.Id; await db.SaveChangesAsync();
        };
        Assert.Equal(ServiceFailure.Conflict, (await new CourseCoverService(db, store).UploadAsync(d.Course.Id, Owner, Request(), Bytes())).Failure);
        Assert.Empty(await db.MediaAssets.ToListAsync()); Assert.Empty(store.Files);
        Assert.All(await db.CourseVersions.ToListAsync(), version => Assert.Null(version.CoverMediaAssetId));
    }
    [Theory] [InlineData("image/png")] [InlineData("image/jpeg")] [InlineData("image/webp")]
    public async Task Private_storage_supports_image_signatures_and_rejects_wrong_bytes(string mime)
    {
        var root = Path.Combine(Path.GetTempPath(), "esham-cover-test-" + Guid.NewGuid().ToString("N"));
        try
        {
            var store = new LocalMediaStorage(root);
            byte[] bytes = mime switch { "image/png" => [137, 80, 78, 71, 13, 10, 26, 10], "image/jpeg" => [255, 216, 255], _ => [82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80] };
            var saved = await store.SaveAsync(new MemoryStream(bytes), mime, default); Assert.Equal(bytes.Length, saved.SizeBytes);
            await Assert.ThrowsAsync<InvalidDataException>(() => store.SaveAsync(Bytes(), mime, default));
            await Assert.ThrowsAsync<InvalidDataException>(() => store.SaveAsync(new MemoryStream(new byte[2 * 1024 * 1024 + 1]), mime, default));
            Assert.Single(Directory.GetFiles(root)); await store.DeleteAsync(saved.Key, default);
        }
        finally { if (Directory.Exists(root)) Directory.Delete(root, true); }
    }
}
