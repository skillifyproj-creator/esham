using esham.BLL.DTOs;
using esham.BLL.DTOs.Courses;
using esham.BLL.Interfaces;
using esham.DAL.Data;
using esham.DAL.Entities;
using Microsoft.EntityFrameworkCore;
namespace esham.BLL.Services;
public sealed class CourseSubmissionEligibilityService(AppDbContext db) : ICourseSubmissionEligibilityService
{
    public async Task<ServiceResult<SubmissionEligibilityResponse>> GetAsync(Guid courseId, CourseActor actor, CancellationToken ct = default)
    {
        if (!actor.IsInstructor || string.IsNullOrWhiteSpace(actor.UserId))
            return ServiceResult<SubmissionEligibilityResponse>.Fail(ServiceFailure.Forbidden, "Instructor access is required.");
        var course = await db.Courses.AsNoTracking().Include(x => x.DraftVersion).SingleOrDefaultAsync(x => x.Id == courseId, ct);
        if (course == null || course.DraftVersion == null) return ServiceResult<SubmissionEligibilityResponse>.Fail(ServiceFailure.NotFound, "Current version not found.");
        if (course.OwnerUserId != actor.UserId) return ServiceResult<SubmissionEligibilityResponse>.Fail(ServiceFailure.Forbidden, "Only the owner can access submission eligibility.");
        return ServiceResult<SubmissionEligibilityResponse>.Ok(await EvaluateAsync(course.DraftVersion, course.OwnerUserId, course.PublishedVersionId, ct));
    }
    // One evaluator for diagnostics AND the locked submission transaction.
    internal async Task<SubmissionEligibilityResponse> EvaluateAsync(CourseVersion draft, string ownerId, Guid? publishedId, CancellationToken ct)
    {
        var sections = await db.CourseSections.AsNoTracking().Include(x => x.Lessons).ThenInclude(x => x.Attachments).ThenInclude(x => x.MediaAsset)
            .Where(x => x.CourseVersionId == draft.Id).OrderBy(x => x.SortOrder).ThenBy(x => x.Id).ToListAsync(ct);
        var content = DraftContentReadiness.Curriculum(draft.Id, sections.Select(x => CurriculumService.Map(x, ownerId)).ToList());
        var tasks = await db.CourseTasks.AsNoTracking().Where(x => x.CourseVersionId == draft.Id).ToListAsync(ct);
        var readyTasks = tasks.Count(CourseTaskService.IsCompleteForReview);
        bool Text(string? ar, string? en, int min) => ar?.Trim().Length >= min || en?.Trim().Length >= min;
        var editable = draft.ReviewStatus == CourseReviewStatuses.Draft && draft.Id != publishedId && draft.ApprovedAt == null;
        var checks = new List<EligibilityCheck>
        {
            new("course-title", Text(draft.TitleAr, draft.TitleEn, 2)),
            new("category", await EducationalCategories.Visible(db).AnyAsync(x => x.Id == draft.CategoryId, ct)),
            new("cover", draft.CoverMediaAssetId.HasValue && await db.MediaAssets.AnyAsync(x => x.Id == draft.CoverMediaAssetId
                && x.OwnerUserId == ownerId && x.MediaType == "image" && x.MimeType.StartsWith("image/") && x.SizeBytes > 0, ct)),
            new("description", Text(draft.DescriptionAr, draft.DescriptionEn, 20)),
            new("objectives", draft.Objectives.Count > 0 && draft.Objectives.All(x => Text(x.Ar, x.En, 1))),
            new("language-level", draft.Language is "ar" or "en" && draft.Level is "beginner" or "intermediate" or "advanced"),
            new("curriculum", content.IsReady),
            new("task-count", CourseTaskService.CheckTaskCount(tasks.Count).MeetsTaskCount),
            new("task-readiness", tasks.Count > 0 && readyTasks == tasks.Count),
            new("editable-draft", editable)
        };
        var contentEligible = checks.Where(x => x.Code != "editable-draft").All(x => x.IsMet);
        return new(draft.Id, draft.ReviewStatus, contentEligible, true, contentEligible && editable, tasks.Count, readyTasks,
            (int)Math.Round(checks.Count(x => x.IsMet) * 100d / checks.Count), checks);
    }
}
