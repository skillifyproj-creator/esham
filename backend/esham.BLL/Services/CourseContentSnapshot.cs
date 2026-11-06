using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using esham.DAL.Data;
using esham.DAL.Entities;
using Microsoft.EntityFrameworkCore;

namespace esham.BLL.Services;

// Reviewed versions are immutable; revision cloning retains them as the persisted baseline.
// Hash content, never row identities or operational/readiness metadata.
internal static class CourseContentSnapshot
{
    private static string Text(string? value) => (value ?? "").Replace("\r\n", "\n").Replace("\r", "\n").Trim().Normalize(NormalizationForm.FormC);
    private static object Localized(LocalizedText? value) => new { Ar = Text(value?.Ar), En = Text(value?.En) };
    private static object[] LocalizedList(IEnumerable<LocalizedText>? values) => (values ?? []).Select(Localized).ToArray();

    internal static async Task<string> Fingerprint(AppDbContext db, Guid versionId, CancellationToken ct)
    {
        var version = await db.CourseVersions.AsNoTracking().SingleAsync(x => x.Id == versionId, ct);
        var sections = await db.CourseSections.AsNoTracking().Include(x => x.Lessons).ThenInclude(x => x.Attachments)
            .Where(x => x.CourseVersionId == versionId).ToListAsync(ct);
        var tasks = await db.CourseTasks.AsNoTracking().Include(x => x.Attachments).Where(x => x.CourseVersionId == versionId).ToListAsync(ct);
        var ids = sections.SelectMany(x => x.Lessons).SelectMany(x => x.Attachments).Select(x => x.MediaAssetId)
            .Concat(sections.SelectMany(x => x.Lessons).Where(x => x.PrimaryVideoMediaAssetId.HasValue).Select(x => x.PrimaryVideoMediaAssetId!.Value))
            .Concat(tasks.SelectMany(x => x.Attachments).Select(x => x.MediaAssetId)).ToHashSet();
        if (version.CoverMediaAssetId.HasValue) ids.Add(version.CoverMediaAssetId.Value);
        var media = await db.MediaAssets.AsNoTracking().Where(x => ids.Contains(x.Id)).ToDictionaryAsync(x => x.Id, ct);
        object? Asset(Guid? id) => id == null ? null : media.TryGetValue(id.Value, out var m)
            ? new { Hash = Text(m.ContentHash).ToUpperInvariant(), m.SizeBytes, Type = Text(m.MediaType), Mime = Text(m.MimeType),
                // An absent hash must not hide a genuine replacement.
                Fallback = string.IsNullOrWhiteSpace(m.ContentHash) ? m.Id.ToString("D") : "" } : throw new InvalidOperationException("Course media is missing.");
        // Tie breaks use meaningful content rather than clone-generated IDs.
        var ordered = sections.OrderBy(x => x.SortOrder).ThenBy(x => Text(x.TitleAr), StringComparer.Ordinal).ThenBy(x => Text(x.TitleEn), StringComparer.Ordinal).ToList();
        var placements = ordered.Select((x, index) => (x.Id, index)).ToDictionary(x => x.Id, x => x.index);
        var content = new {
            version.CategoryId, TitleAr = Text(version.TitleAr), TitleEn = Text(version.TitleEn),
            DescriptionAr = Text(version.DescriptionAr), DescriptionEn = Text(version.DescriptionEn),
            Objectives = LocalizedList(version.Objectives), Language = Text(version.Language), Level = Text(version.Level), Cover = Asset(version.CoverMediaAssetId),
            Sections = ordered.Select(section => new {
                TitleAr = Text(section.TitleAr), TitleEn = Text(section.TitleEn),
                Lessons = section.Lessons.OrderBy(x => x.SortOrder).ThenBy(x => x.LogicalLessonId).Select(lesson => new {
                    TitleAr = Text(lesson.TitleAr), TitleEn = Text(lesson.TitleEn), DescriptionAr = Text(lesson.DescriptionAr), DescriptionEn = Text(lesson.DescriptionEn),
                    Objectives = LocalizedList(lesson.Objectives), ContentType = Text(lesson.ContentType), lesson.IsPreview,
                    Video = Asset(lesson.PrimaryVideoMediaAssetId),
                    Attachments = lesson.Attachments.OrderBy(x => x.SortOrder).ThenBy(x => Text(x.DisplayName), StringComparer.Ordinal)
                        .Select(x => new { Name = Text(x.DisplayName), Media = Asset(x.MediaAssetId) }).ToArray()
                }).ToArray()
            }).ToArray(),
            Tasks = tasks.OrderBy(x => x.SortOrder).ThenBy(x => x.LogicalTaskId).Select(task => new {
                Section = task.DisplaySectionId.HasValue ? (int?)placements[task.DisplaySectionId.Value] : null,
                TitleAr = Text(task.TitleAr), TitleEn = Text(task.TitleEn), DescriptionAr = Text(task.DescriptionAr), DescriptionEn = Text(task.DescriptionEn),
                Instructions = Localized(task.Instructions), Requirements = LocalizedList(task.Requirements),
                Attachments = task.Attachments.OrderBy(x => x.SortOrder).ThenBy(x => Text(x.DisplayName), StringComparer.Ordinal)
                    .Select(x => new { Name = Text(x.DisplayName), Media = Asset(x.MediaAssetId) }).ToArray()
            }).ToArray()
        };
        return Convert.ToHexString(SHA256.HashData(JsonSerializer.SerializeToUtf8Bytes(content)));
    }
}
