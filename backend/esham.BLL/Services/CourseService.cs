using System.Data;
using System.Linq.Expressions;
using esham.BLL.DTOs;
using esham.BLL.DTOs.Courses;
using esham.BLL.Interfaces;
using esham.DAL.Data;
using esham.DAL.Entities;
using Microsoft.EntityFrameworkCore;
namespace esham.BLL.Services;

public sealed class CourseService(AppDbContext db) : ICourseService
{
    private static CourseVersionResponseDto Map(CourseVersion x) => new(x.Id, x.VersionNumber, x.CategoryId,
        x.TitleAr, x.TitleEn, x.DescriptionAr, x.DescriptionEn,
        x.Objectives.Select(o => new ObjectiveDto(o.Ar, o.En)).ToList(), x.Language, x.Level,
        x.CoverMediaAssetId, x.ReviewStatus, x.CreatedAt, x.UpdatedAt, x.SubmittedAt, x.ApprovedAt);
    private static ServiceResult<T> Denied<T>() => ServiceResult<T>.Fail(ServiceFailure.Forbidden, "Instructor access is required.");
    private static string? Validate(CreateCourseRequest x)
    {
        if (x.CategoryId == Guid.Empty) return "CategoryId is required.";
        if (x.TitleAr?.Length > 200 || x.TitleEn?.Length > 200) return "Course titles must not exceed 200 characters.";
        if (x.DescriptionAr?.Length > 10000 || x.DescriptionEn?.Length > 10000) return "Descriptions must not exceed 10000 characters.";
        if (x.Language is not ("ar" or "en")) return "Language must be ar or en.";
        if (x.Level is not ("beginner" or "intermediate" or "advanced")) return "Level must be beginner, intermediate or advanced.";
        if (x.Objectives?.Count > 50 || x.Objectives?.Any(o => o is null || (string.IsNullOrWhiteSpace(o.Ar) && string.IsNullOrWhiteSpace(o.En)) || o.Ar?.Length > 2000 || o.En?.Length > 2000) == true)
            return "Provide at most 50 objectives, each with localized text of at most 2000 characters.";
        return null;
    }
    private async Task<string?> ValidateReferences(CreateCourseRequest request, string ownerId, CancellationToken ct)
    {
        if (!await db.Categories.AsNoTracking().AnyAsync(x => x.Id == request.CategoryId && x.IsActive, ct)) return "Category does not exist or is inactive.";
        if (request.CoverMediaAssetId.HasValue && !await db.MediaAssets.AsNoTracking().AnyAsync(x =>
            x.Id == request.CoverMediaAssetId && x.OwnerUserId == ownerId && x.MediaType == "image" && x.MimeType.StartsWith("image/"), ct))
            return "Cover media must be an existing image owned by the instructor.";
        return null;
    }
    private static void Apply(CourseVersion version, CreateCourseRequest request)
    {
        version.CategoryId = request.CategoryId; version.TitleAr = request.TitleAr?.Trim(); version.TitleEn = request.TitleEn?.Trim();
        version.DescriptionAr = request.DescriptionAr?.Trim(); version.DescriptionEn = request.DescriptionEn?.Trim();
        version.Objectives = request.Objectives?.Select(o => new LocalizedText(o.Ar?.Trim(), o.En?.Trim())).ToList() ?? [];
        version.Language = request.Language!; version.Level = request.Level!; version.CoverMediaAssetId = request.CoverMediaAssetId;
    }
    public async Task<ServiceResult<CourseDetailResponseDto>> CreateAsync(CourseActor actor, CreateCourseRequest request, CancellationToken ct = default)
    {
        if (!actor.IsInstructor || string.IsNullOrWhiteSpace(actor.UserId)) return Denied<CourseDetailResponseDto>();
        var error = Validate(request);
        if (error is not null) return ServiceResult<CourseDetailResponseDto>.Fail(ServiceFailure.Validation, error);
        // Stable generated IDs allow recovery if a commit succeeded but acknowledgement was lost.
        var courseId = Guid.NewGuid(); var versionId = Guid.NewGuid();
        return await db.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
        {
            db.ChangeTracker.Clear();
            await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
            if (await db.Courses.AsNoTracking().AnyAsync(x => x.Id == courseId && x.OwnerUserId == actor.UserId && x.DraftVersionId == versionId, ct))
                return await GetAsync(courseId, actor, ct);
            var referenceError = await ValidateReferences(request, actor.UserId, ct);
            if (referenceError is not null) return ServiceResult<CourseDetailResponseDto>.Fail(ServiceFailure.Validation, referenceError);
            var now = DateTimeOffset.UtcNow;
            var course = new Course { Id = courseId, OwnerUserId = actor.UserId, CreatedAt = now, UpdatedAt = now };
            db.Courses.Add(course);
            await db.SaveChangesAsync(ct);
            var version = new CourseVersion { Id = versionId, CourseId = courseId, VersionNumber = 1,
                ReviewStatus = CourseReviewStatuses.Draft, CreatedAt = now, UpdatedAt = now };
            Apply(version, request); db.CourseVersions.Add(version);
            await db.SaveChangesAsync(ct);
            course.DraftVersionId = versionId;
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            return await GetAsync(courseId, actor, ct);
        });
    }
    public async Task<ServiceResult<IReadOnlyList<InstructorCourseSummaryDto>>> GetMineAsync(CourseActor actor, CancellationToken ct = default)
    {
        if (!actor.IsInstructor || string.IsNullOrWhiteSpace(actor.UserId)) return Denied<IReadOnlyList<InstructorCourseSummaryDto>>();
        var values = await db.Courses.AsNoTracking().Where(x => x.OwnerUserId == actor.UserId).OrderByDescending(x => x.UpdatedAt).ThenBy(x => x.Id)
            .Select(x => new InstructorCourseSummaryDto(x.Id, x.DraftVersionId, x.PublishedVersionId,
                x.DraftVersion != null ? x.DraftVersion.TitleAr : null, x.DraftVersion != null ? x.DraftVersion.TitleEn : null,
                x.DraftVersion != null ? x.DraftVersion.CategoryId : null,
                x.DraftVersion != null ? x.DraftVersion.Category.NameAr : null, x.DraftVersion != null ? x.DraftVersion.Category.NameEn : null,
                x.DraftVersion != null ? x.DraftVersion.Language : null, x.DraftVersion != null ? x.DraftVersion.Level : null,
                x.DraftVersion != null ? x.DraftVersion.ReviewStatus : null, x.SafetyStatus, x.EnrollmentPaused, x.CreatedAt, x.UpdatedAt)).ToListAsync(ct);
        return ServiceResult<IReadOnlyList<InstructorCourseSummaryDto>>.Ok(values);
    }
    public async Task<ServiceResult<CourseVersionResponseDto>> GetDraftAsync(Guid id, CourseActor actor, CancellationToken ct = default)
    {
        if (!actor.IsInstructor || string.IsNullOrWhiteSpace(actor.UserId)) return Denied<CourseVersionResponseDto>();
        var course = await db.Courses.AsNoTracking().Include(x => x.DraftVersion).SingleOrDefaultAsync(x => x.Id == id, ct);
        if (course is null) return ServiceResult<CourseVersionResponseDto>.Fail(ServiceFailure.NotFound, "Course not found.");
        if (course.OwnerUserId != actor.UserId) return ServiceResult<CourseVersionResponseDto>.Fail(ServiceFailure.Forbidden, "Only the course owner can access its draft.");
        return course.DraftVersion is null ? ServiceResult<CourseVersionResponseDto>.Fail(ServiceFailure.NotFound, "No draft exists. Version cloning is not available in this phase.") : ServiceResult<CourseVersionResponseDto>.Ok(Map(course.DraftVersion));
    }
    public async Task<ServiceResult<CourseVersionResponseDto>> UpdateDraftAsync(Guid id, CourseActor actor, UpdateCourseDraftRequest request, CancellationToken ct = default)
    {
        if (!actor.IsInstructor || string.IsNullOrWhiteSpace(actor.UserId)) return Denied<CourseVersionResponseDto>();
        return await db.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
        {
            db.ChangeTracker.Clear();
            await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
            var course = await db.Courses.Include(x => x.DraftVersion).SingleOrDefaultAsync(x => x.Id == id, ct);
            if (course is null) return ServiceResult<CourseVersionResponseDto>.Fail(ServiceFailure.NotFound, "Course not found.");
            if (course.OwnerUserId != actor.UserId) return ServiceResult<CourseVersionResponseDto>.Fail(ServiceFailure.Forbidden, "Only the course owner can edit its draft.");
            var draft = course.DraftVersion;
            if (draft is null || draft.Id == course.PublishedVersionId || draft.ReviewStatus != CourseReviewStatuses.Draft)
                return ServiceResult<CourseVersionResponseDto>.Fail(ServiceFailure.Conflict, "An editable draft is required. Pending/published versions cannot be edited; cloning or reopening is outside this phase.");
            if ((request.ProvidedFields.Contains(nameof(request.CategoryId)) && request.CategoryId is null)
                || (request.ProvidedFields.Contains(nameof(request.Language)) && request.Language is null)
                || (request.ProvidedFields.Contains(nameof(request.Level)) && request.Level is null)
                || (request.ProvidedFields.Contains(nameof(request.Objectives)) && request.Objectives is null))
                return ServiceResult<CourseVersionResponseDto>.Fail(ServiceFailure.Validation, "CategoryId, Language, Level and Objectives cannot be null; use an empty objectives list for a draft.");
            bool Has(string name) => request.ProvidedFields.Contains(name);
            var merged = new CreateCourseRequest(Has(nameof(request.CategoryId)) ? request.CategoryId!.Value : draft.CategoryId,
                Has(nameof(request.TitleAr)) ? request.TitleAr : draft.TitleAr, Has(nameof(request.TitleEn)) ? request.TitleEn : draft.TitleEn,
                Has(nameof(request.DescriptionAr)) ? request.DescriptionAr : draft.DescriptionAr, Has(nameof(request.DescriptionEn)) ? request.DescriptionEn : draft.DescriptionEn,
                Has(nameof(request.Objectives)) ? request.Objectives : draft.Objectives.Select(o => new ObjectiveDto(o.Ar, o.En)).ToList(),
                Has(nameof(request.Language)) ? request.Language : draft.Language, Has(nameof(request.Level)) ? request.Level : draft.Level,
                Has(nameof(request.CoverMediaAssetId)) ? request.CoverMediaAssetId : draft.CoverMediaAssetId);
            var error = Validate(merged) ?? await ValidateReferences(merged, actor.UserId, ct);
            if (error is not null) return ServiceResult<CourseVersionResponseDto>.Fail(ServiceFailure.Validation, error);
            if (request.ProvidedFields.Count > 0)
            {
                Apply(draft, merged);
                course.UpdatedAt = draft.UpdatedAt = DateTimeOffset.UtcNow;
                await db.SaveChangesAsync(ct);
            }
            await transaction.CommitAsync(ct);
            return ServiceResult<CourseVersionResponseDto>.Ok(Map(draft));
        });
    }
    public async Task<ServiceResult<CourseDetailResponseDto>> GetAsync(Guid id, CourseActor actor, CancellationToken ct = default)
    {
        var course = await db.Courses.AsNoTracking().Include(x => x.OwnerUser).Include(x => x.DraftVersion)
            .Include(x => x.PublishedVersion).SingleOrDefaultAsync(x => x.Id == id, ct);
        if (course is null) return ServiceResult<CourseDetailResponseDto>.Fail(ServiceFailure.NotFound, "Course not found.");
        if (!actor.IsGeneralAdmin && (!actor.IsInstructor || course.OwnerUserId != actor.UserId))
            return ServiceResult<CourseDetailResponseDto>.Fail(ServiceFailure.Forbidden, "Only the owner instructor or GeneralAdmin can access this course.");
        return ServiceResult<CourseDetailResponseDto>.Ok(new(course.Id,
            new(course.OwnerUser.Id, course.OwnerUser.Name, course.OwnerUser.NameEn), course.DraftVersionId, course.PublishedVersionId,
            course.DraftVersion is null ? null : Map(course.DraftVersion), course.PublishedVersion is null ? null : Map(course.PublishedVersion),
            course.SafetyStatus, course.EnrollmentPaused, course.CreatedAt, course.UpdatedAt, Convert.ToBase64String(course.RowVersion)));
    }
    private IQueryable<Course> PublicQuery() => db.Courses.AsNoTracking().Where(x => x.PublishedVersion != null
        && x.PublishedVersion.ReviewStatus == CourseReviewStatuses.Approved
        && x.SafetyStatus == CourseSafetyStatuses.Active && x.PublishedVersion.Category.IsActive);
    private static readonly Expression<Func<Course, PublicCourseResponseDto>> PublicProjection = x => new(
        x.Id, x.PublishedVersion!.Id, x.PublishedVersion.TitleAr, x.PublishedVersion.TitleEn,
        x.PublishedVersion.DescriptionAr, x.PublishedVersion.DescriptionEn, x.PublishedVersion.CategoryId,
        x.PublishedVersion.Category.NameAr, x.PublishedVersion.Category.NameEn, x.PublishedVersion.Language, x.PublishedVersion.Level,
        x.PublishedVersion.CoverMediaAsset == null ? null : new MediaSummaryDto(x.PublishedVersion.CoverMediaAsset.Id,
            x.PublishedVersion.CoverMediaAsset.OriginalFileName, x.PublishedVersion.CoverMediaAsset.MimeType,
            x.PublishedVersion.CoverMediaAsset.SizeBytes, x.PublishedVersion.CoverMediaAsset.DurationSeconds, x.PublishedVersion.CoverMediaAsset.MediaType),
        new OwnerSummaryDto(x.OwnerUser.Id, x.OwnerUser.Name, x.OwnerUser.NameEn), x.CreatedAt, x.PublishedVersion.ApprovedAt, null);
    public async Task<IReadOnlyList<PublicCourseResponseDto>> GetPublicAsync(CancellationToken ct = default)
    {
        var values = await PublicQuery().OrderByDescending(x => x.PublishedVersion!.ApprovedAt).ThenBy(x => x.Id).Select(PublicProjection).ToListAsync(ct);
        static string? Preview(string? value) => value?.Length > 300 ? value[..300] : value;
        return values.Select(x => x with { DescriptionAr = Preview(x.DescriptionAr), DescriptionEn = Preview(x.DescriptionEn) }).ToList();
    }
    public async Task<ServiceResult<PublicCourseResponseDto>> GetPublicAsync(Guid id, CancellationToken ct = default)
    {
        var value = await PublicQuery().Where(x => x.Id == id).Select(PublicProjection).SingleOrDefaultAsync(ct);
        if (value is null) return ServiceResult<PublicCourseResponseDto>.Fail(ServiceFailure.NotFound, "Published course not found.");
        // Only fetch objectives from the selected approved public version, never from its draft.
        var objectives = await db.CourseVersions.AsNoTracking().Where(x => x.Id == value.PublishedVersionId).Select(x => x.Objectives).SingleAsync(ct);
        return ServiceResult<PublicCourseResponseDto>.Ok(value with { Objectives = objectives.Select(o => new ObjectiveDto(o.Ar, o.En)).ToList() });
    }
}
