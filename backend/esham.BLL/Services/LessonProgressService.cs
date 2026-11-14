using System.Data;
using System.Security.Claims;
using esham.BLL.DTOs;
using esham.BLL.DTOs.Learning;
using esham.BLL.Interfaces;
using esham.DAL.Data;
using esham.DAL.Entities;
using Microsoft.EntityFrameworkCore;
namespace esham.BLL.Services;

public sealed class LessonProgressService(AppDbContext db, LearnerLearningAccess access, ILearningProgressWriteGate gate, ICourseVersionUpdates versions) : ILessonProgressService
{
    public Task<ServiceResult<ProgressState>> WriteAsync(ClaimsPrincipal actor, Guid enrollmentId, Guid lessonId, ProgressWrite request, bool open = false, CancellationToken ct = default)
        => Mutate(actor, enrollmentId, lessonId, request.ExpectedCourseVersionId, request, open, ct);
    public Task<ServiceResult<ProgressState>> CompleteAsync(ClaimsPrincipal actor, Guid enrollmentId, Guid lessonId, CompleteLesson request, CancellationToken ct = default)
        => Mutate(actor, enrollmentId, lessonId, request.ExpectedCourseVersionId, null, false, ct);
    private async Task<ServiceResult<ProgressState>> Mutate(ClaimsPrincipal actor, Guid enrollmentId, Guid lessonId, Guid expectedVersion, ProgressWrite? request, bool open, CancellationToken ct)
    {
        var initial = await access.ResolveAsync(actor, enrollmentId, ct: ct);
        if (initial.Value is not { } initialAccess) return LearnerLearningService.Failure<ProgressState>(initial.Failure, initial.Message, initial.Code);
        if (!await gate.IsEnabledAsync(ct)) return ServiceResult<ProgressState>.Fail(ServiceFailure.Forbidden, "Progress writes are disabled.", "progress_disabled");
        try
        {
            return await db.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
            {
                db.ChangeTracker.Clear();
                await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
                if (db.Database.IsSqlServer())
                {
                    await db.Courses.FromSqlInterpolated($"SELECT * FROM [Courses] WITH (UPDLOCK,HOLDLOCK) WHERE [Id] = {initialAccess.Enrollment.CourseId}").SingleAsync(ct);
                    await db.Users.FromSqlInterpolated($"SELECT * FROM [AspNetUsers] WITH (UPDLOCK,HOLDLOCK) WHERE [Id] = {initialAccess.Enrollment.LearnerUserId}").SingleAsync(ct);
                    await db.Enrollments.FromSqlInterpolated($"SELECT * FROM [Enrollments] WITH (UPDLOCK,HOLDLOCK) WHERE [Id] = {enrollmentId}").SingleAsync(ct);
                }
                var resolved = await access.ResolveAsync(actor, enrollmentId, ct: ct);
                if (resolved.Value is not { } a) return LearnerLearningService.Failure<ProgressState>(resolved.Failure, resolved.Message, resolved.Code);
                if (expectedVersion == Guid.Empty || a.Version.Id != expectedVersion)
                    return ServiceResult<ProgressState>.Fail(ServiceFailure.Conflict, "Publication changed. Refresh learning.", "publication_changed");
                resolved = await access.ResolveAsync(actor, enrollmentId, lessonId, ct);
                if (resolved.Value is not { } lessonAccess) return LearnerLearningService.Failure<ProgressState>(resolved.Failure, resolved.Message, resolved.Code);
                a = lessonAccess;
                var p = await db.LessonProgressRecords.SingleOrDefaultAsync(x => x.EnrollmentId == enrollmentId && x.LessonId == lessonId, ct);
                var projection = await versions.GetStateAsync(enrollmentId, a.Enrollment.LearnerUserId, ct);
                if (projection.Value is not { } v) return LearnerLearningService.Failure<ProgressState>(projection.Failure, projection.Message, projection.Code);
                var inherited = v.Lessons.Single(x => x.LessonId == lessonId);
                ProgressState Current() => LearnerLearningService.State(a, p, inherited.ResumePositionSeconds, inherited.IsCompleted);
                if (request != null)
                {
                    // Never infer an exact retry from an equal position: a newer visit may have the same value.
                    if (request.ExpectedProgressToken != LearnerLearningService.Token(enrollmentId, lessonId, p))
                        return new ServiceResult<ProgressState>(Current(), ServiceFailure.Conflict,
                            "Progress changed. Review the canonical state before saving again.", "progress_conflict");
                    if (!open && (!double.IsFinite(request.LastPositionSeconds) || request.LastPositionSeconds < 0
                        || a.Lesson!.ContentType == "article" && request.LastPositionSeconds != 0
                        || a.Lesson.ContentType == "video" && (a.Lesson.PrimaryVideoMediaAsset?.DurationSeconds is not double duration
                            || !double.IsFinite(duration) || duration <= 0 || request.LastPositionSeconds > duration)))
                        return ServiceResult<ProgressState>.Fail(ServiceFailure.Validation, "Invalid position or video duration.", "invalid_position");
                }
                // Completion alone is safely replayable: its only transition is monotonic.
                if (request == null && p?.IsCompleted == true)
                    return ServiceResult<ProgressState>.Ok(Current());
                var now = DateTimeOffset.UtcNow;
                // SQL datetimeoffset(7) retains ticks. Force advancement even for equal clocks/values.
                if (p != null && now <= p.UpdatedAt) now = p.UpdatedAt.AddTicks(1);
                if (p == null) { p = new LessonProgress { EnrollmentId = enrollmentId, LessonId = lessonId,
                    LastPositionSeconds = open || request == null ? LearnerLearningService.SafeResume(a.Lesson!, inherited.ResumePositionSeconds) ?? 0 : 0 }; db.LessonProgressRecords.Add(p); }
                if (request == null) { p.IsCompleted = true; p.CompletedAt ??= now; }
                else if (!open) p.LastPositionSeconds = request.LastPositionSeconds;
                p.UpdatedAt = now;
                var enrollment = await db.Enrollments.SingleAsync(x => x.Id == enrollmentId, ct);
                enrollment.LastOpenedAt = now;
                await db.SaveChangesAsync(ct);
                var state = Current();
                await tx.CommitAsync(ct);
                return ServiceResult<ProgressState>.Ok(state);
            });
        }
        finally { db.ChangeTracker.Clear(); }
    }
}
