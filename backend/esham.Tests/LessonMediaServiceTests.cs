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

public sealed class LessonMediaServiceTests
{
    private static readonly CourseActor Owner = new("teacher", true, false);
    private static AppDbContext Context() => new(new DbContextOptionsBuilder<AppDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString()).ReplaceService<IDbContextTransactionManager, TestTransactionManager>().Options);
    private static async Task<(Course Course, CourseVersion Draft, CourseSection Section, Lesson Lesson)> Seed(AppDbContext db)
    {
        var course = new Course { OwnerUserId = Owner.UserId };
        var version = new CourseVersion { CourseId = course.Id };
        var section = new CourseSection { CourseVersionId = version.Id, TitleEn = "Section" };
        var lesson = new Lesson { CourseSectionId = section.Id, TitleEn = "Video", ContentType = "video" };
        course.DraftVersionId = version.Id; db.AddRange(course, version, section, lesson); await db.SaveChangesAsync();
        return (course, version, section, lesson);
    }
    private sealed class MemoryStorage : IMediaStorage
    {
        public Dictionary<string, byte[]> Files { get; } = [];
        public Func<Task>? BeforeSave { get; set; }
        public async Task<StoredMediaFile> SaveAsync(Stream input, string contentType, CancellationToken ct)
        {
            if (BeforeSave != null) await BeforeSave();
            using var output = new MemoryStream(); await input.CopyToAsync(output, ct);
            var bytes = output.ToArray(); var key = Guid.NewGuid().ToString("N"); Files[key] = bytes;
            return new(key, Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant(), bytes.Length, contentType);
        }
        public Task<Stream?> OpenAsync(string key, CancellationToken ct) => Task.FromResult<Stream?>(Files.TryGetValue(key, out var bytes) ? new MemoryStream(bytes) : null);
        public Task DeleteAsync(string key, CancellationToken ct) { Files.Remove(key); return Task.CompletedTask; }
    }
    private static VideoUploadRequest Request(Guid? id = null, Guid? source = null) => new(id ?? Guid.NewGuid(), "lesson.webm", "video/webm", 5, source);
    private static MemoryStream Bytes(byte value = 1) => new([value, 2, 3, 4]);

    [Fact] public async Task Second_video_requires_explicit_current_relationship_and_remove_allows_new_add()
    {
        await using var db = Context(); var d = await Seed(db); var store = new MemoryStorage(); var service = new LessonMediaService(db, store);
        var first = (await service.UploadAsync(d.Course.Id, d.Section.Id, d.Lesson.Id, Owner, Request(), Bytes())).Value!;
        var second = Request();
        Assert.Equal(ServiceFailure.Conflict, (await service.UploadAsync(d.Course.Id, d.Section.Id, d.Lesson.Id, Owner, second, Bytes(5))).Failure);
        Assert.Single(store.Files); Assert.Single(await db.LessonAttachments.ToListAsync());
        Assert.Equal(ServiceFailure.Conflict, (await service.UploadAsync(d.Course.Id, d.Section.Id, d.Lesson.Id, Owner, second with { ReplaceAttachmentId = Guid.NewGuid() }, Bytes(5))).Failure);
        var replaced = (await service.UploadAsync(d.Course.Id, d.Section.Id, d.Lesson.Id, Owner, second with { ReplaceAttachmentId = first.AttachmentId }, Bytes(5))).Value!;
        Assert.NotNull(replaced); Assert.Single(await db.LessonAttachments.ToListAsync()); Assert.Equal(2, store.Files.Count);
        Assert.Equal(replaced.MediaAssetId, (await db.Lessons.AsNoTracking().SingleAsync()).PrimaryVideoMediaAssetId);
        Assert.True((await service.DetachAsync(d.Course.Id, d.Section.Id, d.Lesson.Id, replaced.AttachmentId, Owner)).Value);
        Assert.Null((await db.Lessons.AsNoTracking().SingleAsync()).PrimaryVideoMediaAssetId);
        Assert.Equal(ServiceFailure.None, (await service.UploadAsync(d.Course.Id, d.Section.Id, d.Lesson.Id, Owner, Request(), Bytes(9))).Failure);
        Assert.Single(await db.LessonAttachments.ToListAsync()); Assert.Equal(3, await db.MediaAssets.CountAsync());
    }
    [Fact] public async Task Legacy_normalization_keeps_selected_primary_and_all_media_and_source_history()
    {
        await using var db = Context(); var d = await Seed(db); var store = new MemoryStorage(); var service = new LessonMediaService(db, store);
        var first = (await service.UploadAsync(d.Course.Id, d.Section.Id, d.Lesson.Id, Owner, Request(), Bytes())).Value!;
        var extra = new MediaAsset { OwnerUserId = Owner.UserId, MediaType = "video", MimeType = "video/webm", StorageKey = "legacy", ContentHash = "legacy", SizeBytes = 5 };
        db.AddRange(extra, new LessonAttachment { LessonId = d.Lesson.Id, MediaAssetId = extra.Id, DisplayName = "legacy" }); await db.SaveChangesAsync();
        Assert.Equal(ServiceFailure.Conflict, (await service.UploadAsync(d.Course.Id, d.Section.Id, d.Lesson.Id, Owner, Request(), Bytes())).Failure);
        var normalized = (await service.NormalizeAsync(d.Course.Id, d.Section.Id, d.Lesson.Id, Owner)).Value!;
        Assert.Equal(first.MediaAssetId, Assert.Single(normalized).MediaAssetId);
        Assert.Single(await db.LessonAttachments.ToListAsync()); Assert.Equal(2, await db.MediaAssets.CountAsync()); Assert.Single(store.Files);
        Assert.Equal(first.MediaAssetId, Assert.Single((await service.NormalizeAsync(d.Course.Id, d.Section.Id, d.Lesson.Id, Owner)).Value!).MediaAssetId);
        Assert.Equal(ServiceFailure.Forbidden, (await service.NormalizeAsync(d.Course.Id, d.Section.Id, d.Lesson.Id, new("other", true, false))).Failure);
        var version = await db.CourseVersions.SingleAsync(); version.ReviewStatus = "approved"; await db.SaveChangesAsync();
        Assert.Equal(ServiceFailure.Conflict, (await service.NormalizeAsync(d.Course.Id, d.Section.Id, d.Lesson.Id, Owner)).Failure);
    }

    [Theory] [InlineData(false, "teacher")] [InlineData(true, "stranger")] [InlineData(false, "")]
    public async Task All_media_operations_require_owner_instructor_before_storage(bool instructor, string user)
    {
        await using var db = Context(); var d = await Seed(db); var store = new MemoryStorage(); var service = new LessonMediaService(db, store);
        var actor = new CourseActor(user, instructor, false);
        Assert.Equal(ServiceFailure.Forbidden, (await service.GetAsync(d.Course.Id, d.Section.Id, d.Lesson.Id, actor)).Failure);
        Assert.Equal(ServiceFailure.Forbidden, (await service.UploadAsync(d.Course.Id, d.Section.Id, d.Lesson.Id, actor, Request(), Bytes())).Failure);
        Assert.Equal(ServiceFailure.Forbidden, (await service.DetachAsync(d.Course.Id, d.Section.Id, d.Lesson.Id, Guid.NewGuid(), actor)).Failure);
        Assert.Equal(ServiceFailure.Forbidden, (await service.OpenAsync(d.Course.Id, d.Section.Id, d.Lesson.Id, Guid.NewGuid(), actor)).Failure);
        Assert.Empty(store.Files); Assert.Empty(await db.MediaAssets.ToListAsync());
    }
    [Theory] [InlineData("approved")] [InlineData("pending")] [InlineData("rejected")] [InlineData("published")]
    [InlineData("no-draft")] [InlineData("approved-at")]
    public async Task Immutable_or_missing_drafts_reject_media(string state)
    {
        await using var db = Context(); var d = await Seed(db);
        if (state == "published") d.Course.PublishedVersionId = d.Draft.Id;
        else if (state == "no-draft") d.Course.DraftVersionId = null;
        else if (state == "approved-at") d.Draft.ApprovedAt = DateTimeOffset.UtcNow;
        else d.Draft.ReviewStatus = state;
        await db.SaveChangesAsync(); var store = new MemoryStorage(); var service = new LessonMediaService(db, store);
        Assert.Equal(ServiceFailure.Conflict, (await service.UploadAsync(d.Course.Id, d.Section.Id, d.Lesson.Id, Owner, Request(), Bytes())).Failure);
        Assert.Equal(ServiceFailure.Conflict, (await service.DetachAsync(d.Course.Id, d.Section.Id, d.Lesson.Id, Guid.NewGuid(), Owner)).Failure);
        Assert.Equal(ServiceFailure.Conflict, (await service.OpenAsync(d.Course.Id, d.Section.Id, d.Lesson.Id, Guid.NewGuid(), Owner)).Failure);
        Assert.Empty(store.Files);
    }
    [Theory] [InlineData(true)] [InlineData(false)]
    public async Task Foreign_course_or_historical_version_lessons_are_rejected(bool historical)
    {
        await using var db = Context(); var d = await Seed(db); var other = await Seed(db);
        if (historical)
        {
            var version = new CourseVersion { CourseId = d.Course.Id, VersionNumber = 2, ReviewStatus = "approved" };
            var section = new CourseSection { CourseVersionId = version.Id };
            var lesson = new Lesson { CourseSectionId = section.Id };
            db.AddRange(version, section, lesson); await db.SaveChangesAsync();
            other = (d.Course, version, section, lesson);
        }
        var store = new MemoryStorage(); var service = new LessonMediaService(db, store);
        Assert.Equal(ServiceFailure.NotFound, (await service.UploadAsync(d.Course.Id, other.Section.Id, other.Lesson.Id, Owner, Request(), Bytes())).Failure);
        Assert.Equal(ServiceFailure.NotFound, (await service.GetAsync(d.Course.Id, d.Section.Id, other.Lesson.Id, Owner)).Failure);
        Assert.Empty(store.Files);
    }
    [Fact] public async Task Upload_retry_derivation_stream_and_detach_preserve_source_bytes_and_pending_screening()
    {
        await using var db = Context(); var d = await Seed(db); var store = new MemoryStorage(); var service = new LessonMediaService(db, store);
        var request = Request();
        var original = (await service.UploadAsync(d.Course.Id, d.Section.Id, d.Lesson.Id, Owner, request, Bytes())).Value!;
        var retry = (await service.UploadAsync(d.Course.Id, d.Section.Id, d.Lesson.Id, Owner, request, Bytes())).Value!;
        Assert.Equal(original.AttachmentId, retry.AttachmentId); Assert.Single(store.Files); Assert.Single(await db.MediaAssets.ToListAsync());
        var derived = (await service.UploadAsync(d.Course.Id, d.Section.Id, d.Lesson.Id, Owner, Request(source: original.MediaAssetId) with { ReplaceAttachmentId = original.AttachmentId }, Bytes(5))).Value!;
        Assert.Equal(original.MediaAssetId, derived.SourceMediaAssetId);
        Assert.Equal(1, await db.LessonAttachments.CountAsync()); Assert.Equal(2, store.Files.Count);
        Assert.All(await db.ScreeningResults.ToListAsync(), result => { Assert.Equal("pending", result.Status); Assert.False(result.IsTrustedServerResult); Assert.Equal(0, result.SampleCount); });
        var stream = await service.OpenAsync(d.Course.Id, d.Section.Id, d.Lesson.Id, derived.AttachmentId, Owner);
        Assert.Equal(ServiceFailure.None, stream.Failure);
        await using (var content = stream.Value.Stream) Assert.Equal(5, content.ReadByte());
        Assert.True((await service.DetachAsync(d.Course.Id, d.Section.Id, d.Lesson.Id, derived.AttachmentId, Owner)).Value);
        Assert.Null((await db.Lessons.AsNoTracking().SingleAsync()).PrimaryVideoMediaAssetId);
        Assert.Equal(2, await db.MediaAssets.CountAsync()); Assert.Equal(2, store.Files.Count);
        Assert.Equal(ServiceFailure.NotFound, (await service.OpenAsync(d.Course.Id, d.Section.Id, d.Lesson.Id, derived.AttachmentId, Owner)).Failure);
        Assert.Equal(ServiceFailure.NotFound, (await service.DetachAsync(d.Course.Id, d.Section.Id, d.Lesson.Id, derived.AttachmentId, Owner)).Failure);
        Assert.Equal(ServiceFailure.NotFound, (await service.DetachAsync(d.Course.Id, d.Section.Id, d.Lesson.Id, original.AttachmentId, Owner)).Failure);
    }
    [Fact] public async Task Foreign_source_upload_identity_and_attachment_cannot_cross_lessons_or_versions()
    {
        await using var db = Context(); var d = await Seed(db); var other = await Seed(db); var store = new MemoryStorage(); var service = new LessonMediaService(db, store);
        var request = Request(); var original = (await service.UploadAsync(d.Course.Id, d.Section.Id, d.Lesson.Id, Owner, request, Bytes())).Value!;
        Assert.Equal(ServiceFailure.Validation, (await service.UploadAsync(other.Course.Id, other.Section.Id, other.Lesson.Id, Owner, Request(source: original.MediaAssetId), Bytes())).Failure);
        Assert.Equal(ServiceFailure.Conflict, (await service.UploadAsync(other.Course.Id, other.Section.Id, other.Lesson.Id, Owner, request, Bytes())).Failure);
        Assert.Equal(ServiceFailure.NotFound, (await service.DetachAsync(other.Course.Id, other.Section.Id, other.Lesson.Id, original.AttachmentId, Owner)).Failure);
        Assert.Equal(ServiceFailure.NotFound, (await service.OpenAsync(other.Course.Id, other.Section.Id, other.Lesson.Id, original.AttachmentId, Owner)).Failure);
        Assert.Equal(ServiceFailure.Conflict, (await service.UploadAsync(d.Course.Id, d.Section.Id, d.Lesson.Id, Owner, request, Bytes(8))).Failure);
        Assert.Single(store.Files); Assert.Single(await db.MediaAssets.ToListAsync());
        var metadata = await new CurriculumService(db).SaveLessonAsync(other.Course.Id, other.Section.Id, other.Lesson.Id, Owner,
            new(null, "Cross reference", 0, PrimaryVideoMediaAssetId: original.MediaAssetId));
        Assert.Equal(ServiceFailure.Validation, metadata.Failure);
    }
    [Fact] public async Task Draft_is_rechecked_after_streaming_and_failed_upload_file_is_removed()
    {
        await using var db = Context(); var d = await Seed(db); var store = new MemoryStorage();
        store.BeforeSave = async () => { var draft = await db.CourseVersions.SingleAsync(); draft.ReviewStatus = "approved"; await db.SaveChangesAsync(); };
        var result = await new LessonMediaService(db, store).UploadAsync(d.Course.Id, d.Section.Id, d.Lesson.Id, Owner, Request(), Bytes());
        Assert.Equal(ServiceFailure.Conflict, result.Failure); Assert.Empty(store.Files); Assert.Empty(await db.MediaAssets.ToListAsync());
    }
    [Fact] public async Task Invalid_metadata_and_article_upload_do_not_create_assets()
    {
        await using var db = Context(); var d = await Seed(db); var store = new MemoryStorage(); var service = new LessonMediaService(db, store); var valid = Request();
        foreach (var request in new[] { valid with { FileName = "../video.webm" }, valid with { ContentType = "text/html" },
            valid with { DurationSeconds = double.NaN }, valid with { DurationSeconds = 0 }, valid with { UploadId = Guid.Empty }, valid with { SourceMediaAssetId = valid.UploadId } })
            Assert.Equal(ServiceFailure.Validation, (await service.UploadAsync(d.Course.Id, d.Section.Id, d.Lesson.Id, Owner, request, Bytes())).Failure);
        var lesson = await db.Lessons.SingleAsync(); lesson.ContentType = "article"; await db.SaveChangesAsync();
        Assert.Equal(ServiceFailure.Conflict, (await service.UploadAsync(d.Course.Id, d.Section.Id, d.Lesson.Id, Owner, valid, Bytes())).Failure);
        Assert.Empty(store.Files); Assert.Empty(await db.MediaAssets.ToListAsync());
    }
    [Fact] public async Task Local_storage_hashes_streams_enforces_limit_signature_and_opaque_keys()
    {
        var root = Path.Combine(Path.GetTempPath(), "esham-media-test-" + Guid.NewGuid().ToString("N"));
        try
        {
            var store = new LocalMediaStorage(root, 20);
            byte[] bytes = [0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3];
            var saved = await store.SaveAsync(new MemoryStream(bytes), "video/webm", default);
            Assert.Equal(Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant(), saved.ContentHash);
            await using (var stream = await store.OpenAsync(saved.Key, default)) Assert.Equal(bytes.Length, stream!.Length);
            await Assert.ThrowsAsync<InvalidDataException>(() => store.OpenAsync("../secret", default));
            await Assert.ThrowsAsync<InvalidDataException>(() => store.SaveAsync(new MemoryStream(new byte[21]), "video/webm", default));
            await Assert.ThrowsAsync<InvalidDataException>(() => store.SaveAsync(new MemoryStream(bytes), "video/mp4", default));
            Assert.Single(Directory.GetFiles(root)); await store.DeleteAsync(saved.Key, default); Assert.Empty(Directory.GetFiles(root));
        }
        finally { if (Directory.Exists(root)) Directory.Delete(root, true); }
    }
}
