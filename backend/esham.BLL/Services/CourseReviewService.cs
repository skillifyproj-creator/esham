using System.Data;
using esham.BLL.DTOs;
using esham.BLL.DTOs.Courses;
using esham.BLL.Interfaces;
using esham.DAL.Data;
using esham.DAL.Entities;
using Microsoft.EntityFrameworkCore;
namespace esham.BLL.Services;

public sealed class CourseReviewService(AppDbContext db, IMediaStorage storage) : ICourseReviewService
{
    private static ServiceResult<T> Fail<T>(ServiceFailure failure, string message) => ServiceResult<T>.Fail(failure, message);
    private Task<bool> Assigned(CourseActor actor, Guid categoryId, CancellationToken ct) =>
        db.CategoryAdminAssignments.AnyAsync(x => x.UserId == actor.UserId && x.CategoryId == categoryId && x.IsActive, ct);
    private async Task<bool> CanRead(Course course, CourseVersion version, CourseActor actor, CancellationToken ct) =>
        !string.IsNullOrWhiteSpace(actor.UserId) && (actor.IsGeneralAdmin || actor.IsInstructor && course.OwnerUserId == actor.UserId
            || actor.IsCategoryAdmin && version.SubmittedAt != null && await Assigned(actor, version.CategoryId, ct));
    public async Task<ServiceResult<List<ReviewQueueItem>>> ListAsync(CourseActor actor, string? status, CancellationToken ct = default)
    {
        if (!actor.IsGeneralAdmin && !actor.IsCategoryAdmin) return Fail<List<ReviewQueueItem>>(ServiceFailure.Forbidden, "Administrator access is required.");
        if (status != null && status is not ("pending" or "approved" or "rejected" or "changes_requested"))
            return Fail<List<ReviewQueueItem>>(ServiceFailure.Validation, "Invalid review status.");
        var query = db.CourseVersions.AsNoTracking().Where(x => x.SubmittedAt != null && x.ReviewStatus != "draft");
        if (!actor.IsGeneralAdmin) query = query.Where(x => db.CategoryAdminAssignments.Any(a => a.UserId == actor.UserId && a.CategoryId == x.CategoryId && a.IsActive));
        if (status != null) query = query.Where(x => x.ReviewStatus == status);
        return ServiceResult<List<ReviewQueueItem>>.Ok(await query.OrderByDescending(x => x.SubmittedAt).ThenBy(x => x.Id)
            .Select(x => new ReviewQueueItem(x.CourseId, x.Id, x.VersionNumber, x.CategoryId, x.TitleAr, x.TitleEn,
                x.Category.NameAr, x.Category.NameEn, x.Course.OwnerUser.Name ?? "", x.ReviewStatus, x.SubmittedAt, x.Course.PublishedVersionId)).ToListAsync(ct));
    }
    public async Task<ServiceResult<CourseReviewSnapshot>> GetAsync(Guid courseId, Guid? versionId, CourseActor actor, CancellationToken ct = default)
    {
        var course = await db.Courses.AsNoTracking().SingleOrDefaultAsync(x => x.Id == courseId, ct);
        if (course == null) return Fail<CourseReviewSnapshot>(ServiceFailure.NotFound, "Course not found.");
        var version = await db.CourseVersions.AsNoTracking().SingleOrDefaultAsync(x => x.CourseId == courseId && x.Id == (versionId ?? course.DraftVersionId), ct);
        if (version == null) return Fail<CourseReviewSnapshot>(ServiceFailure.NotFound, "Course version not found.");
        if (!await CanRead(course, version, actor, ct)) return Fail<CourseReviewSnapshot>(ServiceFailure.Forbidden, "This course version is outside your review scope.");
        var sections = await db.CourseSections.AsNoTracking().Include(x => x.Lessons).ThenInclude(x => x.Attachments).ThenInclude(x => x.MediaAsset)
            .Where(x => x.CourseVersionId == version.Id).OrderBy(x => x.SortOrder).ThenBy(x => x.Id).ToListAsync(ct);
        var tasks = await db.CourseTasks.AsNoTracking().Include(x => x.Attachments).ThenInclude(x => x.MediaAsset)
            .Where(x => x.CourseVersionId == version.Id).OrderBy(x => x.SortOrder).ThenBy(x => x.Id).ToListAsync(ct);
        var media = new List<ReviewMediaResponse>();
        string Url(Guid id) => $"/api/courses/{courseId}/review/versions/{version.Id}/media/{id}";
        if (version.CoverMediaAssetId is Guid coverId)
        {
            var cover = await db.MediaAssets.AsNoTracking().SingleOrDefaultAsync(x => x.Id == coverId, ct);
            if (cover != null) media.Add(new(cover.Id, null, null, cover.OriginalFileName, cover.MimeType, cover.MediaType, Url(cover.Id)));
        }
        var primaryIds = sections.SelectMany(x => x.Lessons).Where(x => x.PrimaryVideoMediaAssetId != null)
            .Select(x => x.PrimaryVideoMediaAssetId!.Value).Distinct().ToArray();
        var primaryVideos = await db.MediaAssets.AsNoTracking().Where(x => primaryIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, ct);
        foreach (var lesson in sections.SelectMany(x => x.Lessons))
        {
            foreach (var a in lesson.Attachments.OrderBy(x => x.SortOrder))
                media.Add(new(a.MediaAssetId, lesson.Id, null, a.DisplayName, a.MediaAsset.MimeType, a.MediaAsset.MediaType, Url(a.MediaAssetId)));
            // Primary media is a separate relationship; it need not also be an attachment.
            if (lesson.PrimaryVideoMediaAssetId is Guid primaryId && primaryVideos.TryGetValue(primaryId, out var primary)
                && !media.Any(x => x.LessonId == lesson.Id && x.Id == primaryId))
                media.Add(new(primary.Id, lesson.Id, null, primary.OriginalFileName, primary.MimeType, primary.MediaType, Url(primary.Id)));
        }
        foreach (var task in tasks)
            foreach (var a in task.Attachments.OrderBy(x => x.SortOrder))
                media.Add(new(a.MediaAssetId, null, task.Id, a.DisplayName, a.MediaAsset.MimeType, a.MediaAsset.MediaType, Url(a.MediaAssetId)));
        var decisions = await db.CourseReviewDecisions.AsNoTracking().Where(x => x.CourseVersionId == version.Id).OrderByDescending(x => x.ReviewedAt)
            .Select(x => new ReviewDecisionResponse(x.Id, x.Decision, x.Comment, x.ReviewerUserId, x.ReviewedAt)).ToListAsync(ct);
        return ServiceResult<CourseReviewSnapshot>.Ok(new(courseId, course.OwnerUserId, course.PublishedVersionId, CourseService.Map(version),
            sections.Select(x => CurriculumService.Map(x, course.OwnerUserId)).ToList(), tasks.Select(CourseTaskService.Map).ToList(),
            await new CourseSubmissionEligibilityService(db).EvaluateAsync(version, course.OwnerUserId, course.PublishedVersionId, ct), decisions, media,
            actor.IsCategoryAdmin && course.OwnerUserId != actor.UserId && version.ReviewStatus == "pending"
                && version.SubmittedAt != null && course.DraftVersionId == version.Id && await Assigned(actor, version.CategoryId, ct)));
    }
    private async Task<ServiceResult<Guid>> Change(Guid courseId, Func<Course, Task<ServiceResult<Guid>>> action, CancellationToken ct)
    {
        return await db.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
        {
            db.ChangeTracker.Clear();
            await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
            var query = db.Database.IsSqlServer()
                ? db.Courses.FromSqlInterpolated($"SELECT * FROM [Courses] WITH (UPDLOCK, HOLDLOCK) WHERE [Id] = {courseId}")
                : db.Courses.AsQueryable();
            var course = await query.Include(x => x.DraftVersion).SingleOrDefaultAsync(x => x.Id == courseId, ct);
            if (course == null) return Fail<Guid>(ServiceFailure.NotFound, "Course not found.");
            var result = await action(course);
            if (result.Failure != ServiceFailure.None) return result;
            course.UpdatedAt = DateTimeOffset.UtcNow;
            try { await db.SaveChangesAsync(ct); }
            catch (DbUpdateConcurrencyException) { return Fail<Guid>(ServiceFailure.Conflict, "Course changed. Reload before retrying."); }
            await transaction.CommitAsync(ct);
            return result;
        });
    }
    private void Log(Course course, CourseVersion version, CourseActor actor, string action, string previous, string? details = null) =>
        db.AdminActivityLogs.Add(new() { ActorUserId = actor.UserId, Action = action, TargetType = "CourseVersion", TargetId = version.Id.ToString(),
            TargetName = version.TitleEn ?? version.TitleAr, CourseId = course.Id, CourseVersionId = version.Id, CategoryId = version.CategoryId,
            PreviousState = previous, NewState = version.ReviewStatus, Details = details });
    public Task<ServiceResult<Guid>> SubmitAsync(Guid courseId, CourseActor actor, VersionActionRequest request, CancellationToken ct = default) =>
        Change(courseId, async course =>
        {
            if (!actor.IsInstructor || course.OwnerUserId != actor.UserId) return Fail<Guid>(ServiceFailure.Forbidden, "Only the owner instructor can submit.");
            var draft = course.DraftVersion;
            if (draft == null || draft.Id != request.ExpectedVersionId || draft.ReviewStatus != "draft" || draft.Id == course.PublishedVersionId)
                return Fail<Guid>(ServiceFailure.Conflict, "Only the current editable draft can be submitted once. Reload the course.");
            var lastDecision = await db.CourseReviewDecisions.AsNoTracking()
                .Where(x => x.CourseVersion.CourseId == courseId)
                .OrderByDescending(x => x.CourseVersion.VersionNumber).ThenByDescending(x => x.ReviewedAt)
                .FirstOrDefaultAsync(ct);
            if (lastDecision?.Decision == "changes_requested")
            {
                // Never use version IDs, Save timestamps or revision numbers as evidence of an edit.
                // All snapshot reads remain inside the existing serializable submission transaction.
                if (lastDecision.CourseVersionId == draft.Id)
                    return Fail<Guid>(ServiceFailure.Conflict, "Create a revision from the reviewed snapshot before resubmitting.");
                var reviewed = await CourseContentSnapshot.Fingerprint(db, lastDecision.CourseVersionId, ct);
                var current = await CourseContentSnapshot.Fingerprint(db, draft.Id, ct);
                if (reviewed == current)
                    return ServiceResult<Guid>.Fail(ServiceFailure.Validation, "يجب إجراء تعديل فعلي على الدورة قبل إعادة إرسالها للمراجعة.\nYou must make an actual change to the course before resubmitting it for review.", "course_resubmission_unchanged");
            }
            var eligibility = await new CourseSubmissionEligibilityService(db).EvaluateAsync(draft, course.OwnerUserId, course.PublishedVersionId, ct);
            if (!eligibility.CanSubmit) return Fail<Guid>(ServiceFailure.Validation, "Missing submission requirements: " + string.Join(", ", eligibility.Checks.Where(x => !x.IsMet).Select(x => x.Code)));
            draft.ReviewStatus = "pending"; draft.SubmittedAt = draft.UpdatedAt = DateTimeOffset.UtcNow;
            Log(course, draft, actor, "course.submitted", "draft");
            return ServiceResult<Guid>.Ok(draft.Id);
        }, ct);
    public Task<ServiceResult<Guid>> DecideAsync(Guid courseId, Guid versionId, CourseActor actor, ReviewDecisionRequest request, CancellationToken ct = default) =>
        Change(courseId, async course =>
        {
            var version = await db.CourseVersions.SingleOrDefaultAsync(x => x.Id == versionId && x.CourseId == courseId, ct);
            if (version == null) return Fail<Guid>(ServiceFailure.NotFound, "Submitted version not found.");
            // Existing product policy: CategoryAdmin decides, GeneralAdmin has oversight only.
            if (!actor.IsCategoryAdmin || course.OwnerUserId == actor.UserId || !await Assigned(actor, version.CategoryId, ct))
                return Fail<Guid>(ServiceFailure.Forbidden, "Only an assigned CategoryAdmin other than the owner may decide.");
            if (version.ReviewStatus != "pending" || version.SubmittedAt == null || course.DraftVersionId != versionId)
                return Fail<Guid>(ServiceFailure.Conflict, "This version is no longer pending. Reload the submission.");
            if (request.Decision is not ("approved" or "rejected" or "changes_requested")
                || request.Comment?.Length > 4000 || request.Decision != "approved" && string.IsNullOrWhiteSpace(request.Comment))
                return Fail<Guid>(ServiceFailure.Validation, "Choose a valid decision and provide feedback (up to 4000 characters) for rejection or requested changes.");
            if (request.Decision == "approved")
            {
                var eligibility = await new CourseSubmissionEligibilityService(db).EvaluateAsync(version, course.OwnerUserId, course.PublishedVersionId, ct);
                if (!eligibility.ContentEligible || course.SafetyStatus != CourseSafetyStatuses.Active)
                    return Fail<Guid>(ServiceFailure.Conflict, "The submitted content/category is no longer eligible or the course is inactive.");
                version.ApprovedAt = DateTimeOffset.UtcNow;
                var previousPublishedVersionId = course.PublishedVersionId;
                course.PublishedVersionId = version.Id;
                version.ReviewStatus = "approved";
                await new CourseVersionUpdates(db, new NotificationWriter(db)).StagePublicationAsync(course, version, previousPublishedVersionId, ct);
            }
            version.ReviewStatus = request.Decision; version.UpdatedAt = DateTimeOffset.UtcNow;
            var decision = new CourseReviewDecision { CourseVersionId = version.Id, ReviewerUserId = actor.UserId, Decision = request.Decision, Comment = request.Comment?.Trim() };
            db.CourseReviewDecisions.Add(decision);
            if (request.Decision == "approved")
                await new NotificationWriter(db).StageAsync(new(decision.Id, course.OwnerUserId, "course.published",
                    "تم اعتماد دورتك ونشرها", "Your course has been approved and published",
                    "تم اعتماد الدورة ونشرها بنجاح. يمكنك عرض النسخة المنشورة الآن.",
                    "Your course was approved and published successfully. View the published course."), ct);
            if (request.Decision == "changes_requested")
            {
                // The decision ID is the persisted event identity. The course lock and pending-state
                // check prevent repeated decisions; staging shares the decision's transaction.
                var feedback = decision.Comment!;
                // Notification storage allows 2000 characters; the linked review retains all 4000.
                var excerpt = feedback.Length > 1800 ? feedback[..1800] + "…" : feedback;
                await new NotificationWriter(db).StageAsync(new(decision.Id, course.OwnerUserId, "course.changes_requested",
                    "تعديلات مطلوبة على دورتك", "Changes required for your course",
                    "طلب المراجع تعديل محتوى الدورة: " + excerpt,
                    "The reviewer requested changes to your course content: " + excerpt), ct);
            }
            Log(course, version, actor, "course." + request.Decision, "pending", request.Comment?.Trim());
            return ServiceResult<Guid>.Ok(version.Id);
        }, ct);
    public Task<ServiceResult<Guid>> ReviseAsync(Guid courseId, CourseActor actor, VersionActionRequest request, CancellationToken ct = default) =>
        Change(courseId, async course =>
        {
            if (!actor.IsInstructor || course.OwnerUserId != actor.UserId) return Fail<Guid>(ServiceFailure.Forbidden, "Only the owner instructor can create a revision.");
            var source = course.DraftVersion;
            if (source == null || source.Id != request.ExpectedVersionId || source.ReviewStatus is not ("approved" or "rejected" or "changes_requested"))
                return Fail<Guid>(ServiceFailure.Conflict, "Create a revision from the current decided version only.");
            var clone = new CourseVersion { CourseId = course.Id,
                VersionNumber = await db.CourseVersions.Where(x => x.CourseId == course.Id).MaxAsync(x => x.VersionNumber, ct) + 1,
                CategoryId = source.CategoryId, TitleAr = source.TitleAr, TitleEn = source.TitleEn, DescriptionAr = source.DescriptionAr, DescriptionEn = source.DescriptionEn,
                Objectives = source.Objectives.Select(x => new LocalizedText(x.Ar, x.En)).ToList(), Language = source.Language, Level = source.Level, CoverMediaAssetId = source.CoverMediaAssetId };
            db.CourseVersions.Add(clone);
            var sections = await db.CourseSections.Include(x => x.Lessons).ThenInclude(x => x.Attachments).Where(x => x.CourseVersionId == source.Id).ToListAsync(ct);
            var sectionIds = new Dictionary<Guid, Guid>();
            foreach (var section in sections)
            {
                var copy = new CourseSection { CourseVersionId = clone.Id, TitleAr = section.TitleAr, TitleEn = section.TitleEn, SortOrder = section.SortOrder };
                sectionIds.Add(section.Id, copy.Id); db.CourseSections.Add(copy);
                foreach (var lesson in section.Lessons)
                {
                    var next = new Lesson { LogicalLessonId = lesson.LogicalLessonId, CourseSectionId = copy.Id, TitleAr = lesson.TitleAr, TitleEn = lesson.TitleEn,
                        DescriptionAr = lesson.DescriptionAr, DescriptionEn = lesson.DescriptionEn,
                        Objectives = lesson.Objectives?.Select(x => new LocalizedText(x.Ar, x.En)).ToList(), ContentType = lesson.ContentType,
                        DurationSeconds = lesson.DurationSeconds, SortOrder = lesson.SortOrder, IsPreview = lesson.IsPreview, PrimaryVideoMediaAssetId = lesson.PrimaryVideoMediaAssetId };
                    db.Lessons.Add(next);
                    foreach (var a in lesson.Attachments) db.LessonAttachments.Add(new() { LessonId = next.Id, MediaAssetId = a.MediaAssetId, DisplayName = a.DisplayName, SortOrder = a.SortOrder });
                }
            }
            var tasks = await db.CourseTasks.Include(x => x.Attachments).Where(x => x.CourseVersionId == source.Id).ToListAsync(ct);
            foreach (var task in tasks)
            {
                var copy = new CourseTask { LogicalTaskId = task.LogicalTaskId, CourseVersionId = clone.Id, DisplaySectionId = task.DisplaySectionId is Guid sid ? sectionIds[sid] : null,
                    TitleAr = task.TitleAr, TitleEn = task.TitleEn, DescriptionAr = task.DescriptionAr, DescriptionEn = task.DescriptionEn,
                    Instructions = task.Instructions == null ? null : new(task.Instructions.Ar, task.Instructions.En),
                    Requirements = task.Requirements?.Select(x => new LocalizedText(x.Ar, x.En)).ToList(), SortOrder = task.SortOrder, IsReady = task.IsReady };
                db.CourseTasks.Add(copy);
                foreach (var a in task.Attachments) db.TaskAttachments.Add(new() { CourseTaskId = copy.Id, MediaAssetId = a.MediaAssetId, DisplayName = a.DisplayName, SortOrder = a.SortOrder });
            }
            await db.SaveChangesAsync(ct); // Insert snapshot children before advancing the version pointer.
            course.DraftVersionId = clone.Id;
            Log(course, clone, actor, "course.revision-created", source.ReviewStatus, "Source version: " + source.Id);
            return ServiceResult<Guid>.Ok(clone.Id);
        }, ct);
    public async Task<ServiceResult<(Stream Stream, string ContentType)>> OpenMediaAsync(Guid courseId, Guid versionId, Guid assetId, CourseActor actor, CancellationToken ct = default)
    {
        var snapshot = await GetAsync(courseId, versionId, actor, ct);
        if (snapshot.Failure != ServiceFailure.None) return Fail<(Stream, string)>(snapshot.Failure, snapshot.Message!);
        if (!snapshot.Value!.Media.Any(x => x.Id == assetId)) return Fail<(Stream, string)>(ServiceFailure.NotFound, "Media not attached to this version.");
        var asset = await db.MediaAssets.AsNoTracking().SingleAsync(x => x.Id == assetId, ct);
        var stream = await storage.OpenAsync(asset.StorageKey, ct);
        return stream == null ? Fail<(Stream, string)>(ServiceFailure.NotFound, "Media file is unavailable.")
            : ServiceResult<(Stream, string)>.Ok((stream, asset.MimeType));
    }
}
