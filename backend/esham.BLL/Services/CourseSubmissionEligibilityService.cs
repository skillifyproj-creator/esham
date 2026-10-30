using esham.BLL.DTOs;
using esham.BLL.DTOs.Courses;
using esham.BLL.Interfaces;
using esham.DAL.Data;
using Microsoft.EntityFrameworkCore;
namespace esham.BLL.Services;
public sealed class CourseSubmissionEligibilityService(AppDbContext db) : ICourseSubmissionEligibilityService
{
    public async Task<ServiceResult<SubmissionEligibilityResponse>> GetAsync(Guid courseId, CourseActor actor, CancellationToken ct = default)
    {
        var curriculum = new CurriculumService(db);
        var content = await curriculum.GetReadinessAsync(courseId, actor, ct);
        if (content.Failure != ServiceFailure.None) return ServiceResult<SubmissionEligibilityResponse>.Fail(content.Failure, content.Message!);
        return await curriculum.InDraft(courseId, actor, false, async draft =>
        {
            if (draft.Id != content.Value!.CourseVersionId) return ServiceResult<SubmissionEligibilityResponse>.Fail(ServiceFailure.Conflict, "The current draft changed. Reload eligibility.");
            var tasks = await db.CourseTasks.Where(x => x.CourseVersionId == draft.Id).ToListAsync(ct);
            var readyTasks = tasks.Count(CourseTaskService.IsCompleteForReview);
            bool Text(string? ar, string? en, int min) => (ar?.Trim().Length >= min || en?.Trim().Length >= min);
            var checks = new List<EligibilityCheck>
            {
                new("course-title", Text(draft.TitleAr, draft.TitleEn, 2)),
                new("category", await db.Categories.AnyAsync(x => x.Id == draft.CategoryId && x.IsActive, ct)),
                new("cover", draft.CoverMediaAssetId.HasValue && await db.MediaAssets.AnyAsync(x => x.Id == draft.CoverMediaAssetId
                    && x.OwnerUserId == actor.UserId && x.MediaType == "image" && x.MimeType.StartsWith("image/") && x.SizeBytes > 0, ct)),
                new("description", Text(draft.DescriptionAr, draft.DescriptionEn, 20)),
                new("objectives", draft.Objectives.Count > 0 && draft.Objectives.All(x => Text(x.Ar, x.En, 1))),
                new("language-level", draft.Language is "ar" or "en" && draft.Level is "beginner" or "intermediate" or "advanced"),
                new("curriculum", content.Value.IsReady),
                new("task-count", CourseTaskService.CheckTaskCount(tasks.Count).MeetsTaskCount),
                new("task-readiness", tasks.Count > 0 && readyTasks == tasks.Count),
                new("editable-draft", true),
            };
            // Eligibility is real; no local fake submission and no direct publication are offered.
            return ServiceResult<SubmissionEligibilityResponse>.Ok(new(draft.Id, draft.ReviewStatus, checks.All(x => x.IsMet),
                false, false, tasks.Count, readyTasks, (int)Math.Round(checks.Count(x => x.IsMet) * 100d / checks.Count), checks));
        }, ct);
    }
}
