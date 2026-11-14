using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using esham.BLL.DTOs;
using esham.BLL.DTOs.Learning;
using esham.BLL.Interfaces;
using esham.DAL.Data;
using esham.DAL.Entities;
using Microsoft.EntityFrameworkCore;
namespace esham.BLL.Services;

public sealed class LearnerLearningService(AppDbContext db, LearnerLearningAccess access, ICourseVersionUpdates versions,
    IMediaStorage storage, ILearningProgressWriteGate gate) : ILearnerLearningService
{
    internal static ServiceResult<T> Failure<T>(ServiceFailure failure, string? message, string? code) => ServiceResult<T>.Fail(failure, message ?? "Learning unavailable.", code);
    internal static string Token(Guid enrollmentId, Guid lessonId, LessonProgress? p) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(
        $"{enrollmentId:N}|{lessonId:N}|{p?.Id:N}|{p?.UpdatedAt.UtcTicks}|{p?.CompletedAt?.UtcTicks}|{p?.IsCompleted}|{(p == null ? 0 : BitConverter.DoubleToInt64Bits(p.LastPositionSeconds))}")));
    internal static ProgressState State(LearningAccess a, LessonProgress? p, double? inheritedResume = null, bool inheritedComplete = false) => new(
        a.Enrollment.LearnerUserId, a.Enrollment.Id, a.Version.Id, a.Lesson!.Id, inheritedComplete || p?.IsCompleted == true,
        p?.CompletedAt, p?.LastPositionSeconds ?? 0, SafeResume(a.Lesson, p?.LastPositionSeconds ?? inheritedResume),
        Token(a.Enrollment.Id, a.Lesson.Id, p), p?.UpdatedAt);
    internal static double? SafeResume(Lesson lesson, double? position) => lesson.ContentType == "video"
        && lesson.PrimaryVideoMediaAsset?.DurationSeconds is double duration && double.IsFinite(duration) && duration > 0
        && position is double p && double.IsFinite(p) && p >= 0 ? Math.Min(p, duration) : null;

    public async Task<ServiceResult<LearningCourse>> GetAsync(ClaimsPrincipal actor, Guid enrollmentId, CancellationToken ct = default)
    {
        var result = await access.ResolveAsync(actor, enrollmentId, ct: ct);
        if (result.Value is not { } a) return Failure<LearningCourse>(result.Failure, result.Message, result.Code);
        var state = await versions.GetStateAsync(enrollmentId, a.Enrollment.LearnerUserId, ct);
        if (state.Value is not { } v) return Failure<LearningCourse>(state.Failure, state.Message, state.Code);
        if (v.AvailableCourseVersionId != a.Version.Id) return ServiceResult<LearningCourse>.Fail(ServiceFailure.Conflict, "Publication changed. Refresh learning.", "publication_changed");
        var sections = await db.CourseSections.AsNoTracking().Include(x => x.Lessons).Where(x => x.CourseVersionId == a.Version.Id)
            .OrderBy(x => x.SortOrder).ThenBy(x => x.Id).ToListAsync(ct);
        var states = v.Lessons.ToDictionary(x => x.LessonId);
        var ordered = sections.Select(s => new LearningSection(s.Id, s.TitleAr, s.TitleEn, s.SortOrder,
            s.Lessons.OrderBy(x => x.SortOrder).ThenBy(x => x.Id).Select(l => new LearningLesson(l.Id, l.LogicalLessonId,
                l.TitleAr, l.TitleEn, l.ContentType, l.SortOrder, states[l.Id].IsCompleted, states[l.Id].IsInherited, states[l.Id].IsOptional)).ToList())).ToList();
        var activity = await db.LessonProgressRecords.AsNoTracking().Where(x => x.EnrollmentId == enrollmentId
            && x.Lesson.CourseSection.CourseVersion.CourseId == a.Enrollment.CourseId && x.Lesson.CourseSection.CourseVersion.ReviewStatus == "approved")
            .OrderByDescending(x => x.UpdatedAt).ThenBy(x => x.Id).Select(x => x.Lesson.LogicalLessonId).ToListAsync(ct);
        var lessons = ordered.SelectMany(x => x.Lessons).ToList();
        var resume = activity.Select(id => lessons.FirstOrDefault(x => x.LogicalLessonId == id)).FirstOrDefault(x => x != null)
            ?? lessons.FirstOrDefault(x => !x.IsCompleted && !x.IsOptional) ?? lessons.FirstOrDefault();
        return ServiceResult<LearningCourse>.Ok(new(a.Enrollment.LearnerUserId, enrollmentId, a.Enrollment.CourseId, a.Enrollment.CourseVersionId,
            a.Version.Id, a.Version.TitleAr, a.Version.TitleEn, await gate.IsEnabledAsync(ct), resume?.Id,
            lessons.Count == 0 ? 0 : (int)Math.Round(100d * lessons.Count(x => x.IsCompleted) / lessons.Count), v with { LearnerContentApiAvailable = true }, ordered));
    }
    public async Task<ServiceResult<LessonContent>> LessonAsync(ClaimsPrincipal actor, Guid enrollmentId, Guid lessonId, CancellationToken ct = default)
    {
        var result = await access.ResolveAsync(actor, enrollmentId, lessonId, ct);
        if (result.Value is not { } a) return Failure<LessonContent>(result.Failure, result.Message, result.Code);
        var version = await versions.GetStateAsync(enrollmentId, a.Enrollment.LearnerUserId, ct);
        if (version.Value is not { } v) return Failure<LessonContent>(version.Failure, version.Message, version.Code);
        var state = v.Lessons.SingleOrDefault(x => x.LessonId == lessonId);
        if (state is null || v.AvailableCourseVersionId != a.Version.Id) return ServiceResult<LessonContent>.Fail(ServiceFailure.Conflict, "Publication changed.", "publication_changed");
        var p = await db.LessonProgressRecords.AsNoTracking().SingleOrDefaultAsync(x => x.EnrollmentId == enrollmentId && x.LessonId == lessonId, ct);
        var l = a.Lesson!; var root = $"/me/enrollments/{enrollmentId:D}/learning/lessons/{lessonId:D}";
        return ServiceResult<LessonContent>.Ok(new(a.Enrollment.LearnerUserId, enrollmentId, a.Version.Id, lessonId,
            l.TitleAr, l.TitleEn, l.DescriptionAr, l.DescriptionEn, l.ContentType, l.PrimaryVideoMediaAsset?.DurationSeconds,
            l.PrimaryVideoMediaAssetId.HasValue ? root + "/video" : null,
            l.Attachments.OrderBy(x => x.SortOrder).ThenBy(x => x.Id).Select(x => new LearningAttachment(x.Id, x.DisplayName,
                x.MediaAsset.MimeType, root + $"/attachments/{x.Id:D}/content")).ToList(), State(a, p, state.ResumePositionSeconds, state.IsCompleted)));
    }
    public async Task<ServiceResult<LearningMedia>> MediaAsync(ClaimsPrincipal actor, Guid enrollmentId, Guid lessonId, Guid? attachmentId, CancellationToken ct = default)
    {
        var result = await access.ResolveAsync(actor, enrollmentId, lessonId, ct);
        if (result.Value is not { } a) return Failure<LearningMedia>(result.Failure, result.Message, result.Code);
        var link = attachmentId.HasValue ? a.Lesson!.Attachments.SingleOrDefault(x => x.Id == attachmentId) : null;
        var asset = attachmentId.HasValue ? link?.MediaAsset : a.Lesson!.PrimaryVideoMediaAsset;
        if (asset is null || !attachmentId.HasValue && (asset.MediaType != "video" || asset.MimeType is not ("video/mp4" or "video/webm" or "video/quicktime")))
            return ServiceResult<LearningMedia>.Fail(ServiceFailure.NotFound, "Media not found.");
        var stream = await storage.OpenAsync(asset.StorageKey, ct);
        return stream is null ? ServiceResult<LearningMedia>.Fail(ServiceFailure.NotFound, "Media file is unavailable.", "media_missing")
            : ServiceResult<LearningMedia>.Ok(new(stream, attachmentId.HasValue ? "application/octet-stream" : asset.MimeType,
                attachmentId.HasValue ? SafeName(link!.DisplayName) : null));
    }
    private static string SafeName(string name)
    {
        var safe = new string(name.Where(c => !char.IsControl(c) && c is not ('/' or '\\' or '"')).Take(160).ToArray());
        return string.IsNullOrWhiteSpace(safe) ? "attachment" : safe;
    }
}
