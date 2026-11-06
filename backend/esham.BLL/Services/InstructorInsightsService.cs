using System.Data;
using System.Security.Claims;
using esham.BLL.DTOs;
using esham.DAL.Data;
using esham.DAL.Entities;
using Microsoft.EntityFrameworkCore;
namespace esham.BLL.Services;

public sealed record InstructorReviewInput(string Decision,string? Feedback);
public sealed class InstructorInsightsService(AppDbContext db)
{
    private readonly ModerationAccess access=new(db);
    private static ServiceResult<object> Fail(ServiceFailure f,string m)=>ServiceResult<object>.Fail(f,m);
    private async Task<(string? Id,ServiceFailure Failure)> Actor(ClaimsPrincipal user,CancellationToken ct)
    {
        var a=await access.ReadAsync(user,ct);
        return a==null?(null,ServiceFailure.Unauthenticated):!a.Instructor?(null,ServiceFailure.Forbidden):(a.Id,ServiceFailure.None);
    }
    public async Task<ServiceResult<object>> Analytics(ClaimsPrincipal user,Guid? courseId,string period="all",CancellationToken ct=default)
    {
        var a=await Actor(user,ct);if(a.Id==null)return Fail(a.Failure,"Instructor membership required.");
        if(!new[]{"all","7d","30d","3m"}.Contains(period))return Fail(ServiceFailure.Validation,"Invalid period.");
        var courses=await db.Courses.AsNoTracking().Include(x=>x.PublishedVersion).Include(x=>x.DraftVersion).Where(x=>x.OwnerUserId==a.Id&&(!courseId.HasValue||x.Id==courseId)).ToListAsync(ct);
        if(courseId.HasValue&&courses.Count==0)return Fail(ServiceFailure.NotFound,"Course not found.");
        var ids=courses.Select(x=>x.Id).ToArray();var now=DateTimeOffset.UtcNow;
        var since=period=="all"?DateTimeOffset.MinValue:now.AddDays(period=="7d"?-7:period=="30d"?-30:-90);
        // Learner metrics form an enrollment cohort; rating/ledger metrics use their own event time.
        var enrollments=await db.Enrollments.AsNoTracking().Where(x=>ids.Contains(x.CourseId)&&x.EnrolledAt>=since).ToListAsync(ct);
        var eids=enrollments.Select(x=>x.Id).ToArray();
        var progress=await db.LessonProgressRecords.AsNoTracking().Where(x=>eids.Contains(x.EnrollmentId)&&x.Lesson.CourseSection.CourseVersion.CourseId==x.Enrollment.CourseId&&x.Lesson.CourseSection.CourseVersion.ReviewStatus=="approved").Select(x=>new{x.EnrollmentId,x.IsCompleted,x.Lesson.LogicalLessonId}).ToListAsync(ct);
        var reviewRows=await db.CourseReviews.AsNoTracking().Where(x=>ids.Contains(x.Enrollment.CourseId)&&x.CreatedAt>=since).Select(x=>new{x.Rating,x.CreatedAt}).ToListAsync(ct);
        var completed=enrollments.Count(x=>x.Status=="completed"||x.CompletedAt!=null);
        var submittedEnrollmentIds=await db.TaskSubmissions.AsNoTracking().Where(x=>eids.Contains(x.EnrollmentId)&&x.SubmittedAt!=null&&x.CourseTask.CourseVersion.CourseId==x.Enrollment.CourseId).Select(x=>x.EnrollmentId).Distinct().ToListAsync(ct);
        var started=enrollments.Count(x=>x.Status=="completed"||x.CompletedAt!=null||progress.Any(p=>p.EnrollmentId==x.Id)||x.LastOpenedAt!=null||submittedEnrollmentIds.Contains(x.Id));
        var average=reviewRows.Count==0?0:Math.Round(reviewRows.Average(x=>x.Rating),1);
        var points=await db.PointTransactions.AsNoTracking().Where(x=>x.UserId==a.Id&&x.TransactionType=="teaching"&&x.CreatedAt>=since&&x.EnrollmentId!=null&&ids.Contains(x.Enrollment!.CourseId)).SumAsync(x=>(int?)x.Amount,ct)??0;
        var currentVersionIds=courses.Select(x=>x.PublishedVersionId).OfType<Guid>().ToArray();
        var lessons=await db.Lessons.AsNoTracking().Where(x=>currentVersionIds.Contains(x.CourseSection.CourseVersionId)).Select(x=>new{x.LogicalLessonId,x.CourseSectionId,x.CourseSection.TitleAr,x.CourseSection.TitleEn,x.CourseSection.CourseVersion.CourseId}).ToListAsync(ct);
        var sections=lessons.GroupBy(x=>x.CourseSectionId).Select(g=>new{Id=g.Key,g.First().TitleAr,g.First().TitleEn,CompletionRate=SectionRate(g.Select(x=>x.LogicalLessonId).Distinct().ToArray(),g.First().CourseId)}).ToArray();
        double SectionRate(Guid[] logical,Guid cid){var cohort=enrollments.Where(x=>x.CourseId==cid).ToArray();if(cohort.Length==0||logical.Length==0)return 0;return Math.Round(100.0*cohort.Sum(e=>progress.Where(p=>p.EnrollmentId==e.Id&&p.IsCompleted&&logical.Contains(p.LogicalLessonId)).Select(p=>p.LogicalLessonId).Distinct().Count())/(cohort.Length*logical.Length),1);}
        var performance=Enumerable.Range(0,6).Select(i=>{var start=new DateTimeOffset(now.Year,now.Month,1,0,0,0,TimeSpan.Zero).AddMonths(i-5);return new{Id=start.ToString("yyyy-MM"),Label=new{Ar=start.ToString("yyyy-MM"),En=start.ToString("yyyy-MM")},Learners=enrollments.Count(e=>e.EnrolledAt>=start&&e.EnrolledAt<start.AddMonths(1)),Completions=enrollments.Count(e=>e.CompletedAt>=start&&e.CompletedAt<start.AddMonths(1))};}).ToArray();
        return ServiceResult<object>.Ok(new{Course=courses.Where(x=>x.Id==courseId).Select(x=>new{Id=x.Id,TitleAr=(x.PublishedVersion??x.DraftVersion)?.TitleAr,TitleEn=(x.PublishedVersion??x.DraftVersion)?.TitleEn,Status=(x.DraftVersion??x.PublishedVersion)?.ReviewStatus}).FirstOrDefault(),
            Learners=new{Enrolled=enrollments.Count,Started=started,Completed=completed,InProgress=Math.Max(0,started-completed)},Ratings=new{Average=average,Total=reviewRows.Count,Distribution=Enumerable.Range(1,5).ToDictionary(x=>x.ToString(),x=>reviewRows.Count(r=>r.Rating==x))},Sections=sections,EarnedPoints=points,Performance=performance,
            Stats=new{Learners=enrollments.Select(x=>x.LearnerUserId).Distinct().Count(),LearnerGrowthPercent=(double?)null,Rating=average,RatingCount=reviewRows.Count,WeeklyJoinRate=enrollments.Count(x=>x.EnrolledAt>=now.AddDays(-7)),AverageWatchHours=(double?)null,OverallCompletionRate=enrollments.Count==0?0:Math.Round(100.0*completed/enrollments.Count,1)},
            TaskStats=new{
                AwaitingReview=await db.TaskSubmissions.CountAsync(x=>ids.Contains(x.Enrollment.CourseId)&&x.CourseTask.CourseVersion.CourseId==x.Enrollment.CourseId&&x.Status=="awaitingReview"&&x.SubmittedAt>=since,ct),
                ApprovedAttempts=await db.TaskSubmissions.CountAsync(x=>ids.Contains(x.Enrollment.CourseId)&&x.CourseTask.CourseVersion.CourseId==x.Enrollment.CourseId&&x.Status=="approved"&&x.SubmittedAt>=since,ct)},
            SubmissionCount=await db.TaskSubmissions.CountAsync(x=>ids.Contains(x.Enrollment.CourseId)&&x.SubmittedAt>=since,ct),Period=period});
    }
    public async Task<ServiceResult<object>> Reviews(ClaimsPrincipal user,Guid? courseId,int page=1,CancellationToken ct=default)
    {
        var a=await Actor(user,ct);if(a.Id==null)return Fail(a.Failure,"Instructor membership required.");
        if(page<1||page>100000)return Fail(ServiceFailure.Validation,"Invalid page.");
        if(courseId.HasValue&&!await db.Courses.AnyAsync(x=>x.Id==courseId&&x.OwnerUserId==a.Id,ct))return Fail(ServiceFailure.NotFound,"Course not found.");
        var q=db.CourseReviews.AsNoTracking().Where(x=>x.Enrollment.Course.OwnerUserId==a.Id&&(!courseId.HasValue||x.Enrollment.CourseId==courseId));
        var rows=await q.OrderByDescending(x=>x.CreatedAt).ThenBy(x=>x.Id).Skip((page-1)*50).Take(50).Select(x=>new{x.Id,CourseId=x.Enrollment.CourseId,x.CourseVersionId,x.Rating,x.Comment,x.InstructorReply,x.CreatedAt,LearnerName=x.Enrollment.LearnerUser.Name,LearnerNameEn=x.Enrollment.LearnerUser.NameEn,TitleAr=(x.Enrollment.Course.PublishedVersion??x.Enrollment.CourseVersion).TitleAr,TitleEn=(x.Enrollment.Course.PublishedVersion??x.Enrollment.CourseVersion).TitleEn}).ToListAsync(ct);
        return ServiceResult<object>.Ok(new{Items=rows,Total=await q.CountAsync(ct),Page=page});
    }
    public async Task<ServiceResult<object>> Submissions(ClaimsPrincipal user,string? status,Guid? id=null,int page=1,CancellationToken ct=default)
    {
        var a=await Actor(user,ct);if(a.Id==null)return Fail(a.Failure,"Instructor membership required.");
        if(page<1||page>100000||status!=null&&!new[]{"awaitingReview","approved","rejected"}.Contains(status))return Fail(ServiceFailure.Validation,"Invalid submission filter.");
        // Draft answers are private. Never expose a learner's in-progress attempt.
        var q=db.TaskSubmissions.AsNoTracking().Where(x=>x.Enrollment.Course.OwnerUserId==a.Id&&x.SubmittedAt!=null&&x.CourseTask.CourseVersion.CourseId==x.Enrollment.CourseId&&x.CourseTask.CourseVersion.ReviewStatus=="approved"&&x.Status!="inProgress"&&(!id.HasValue||x.Id==id)&& (status==null||x.Status==status));
        var rows=await q.OrderByDescending(x=>x.SubmittedAt).ThenBy(x=>x.Id).Skip((page-1)*50).Take(50).Select(x=>new{x.Id,x.Status,x.AttemptNumber,x.SubmittedAt,x.AnswerText,x.WorkUrl,x.CourseTaskId,CourseId=x.Enrollment.CourseId,x.CourseTask.TitleAr,x.CourseTask.TitleEn,LearnerName=x.Enrollment.LearnerUser.Name,LearnerNameEn=x.Enrollment.LearnerUser.NameEn,Reviews=x.Reviews.OrderByDescending(r=>r.ReviewedAt).Select(r=>new{r.Decision,r.Feedback,r.ReviewedAt}),Files=x.Attachments.Select(f=>new{f.Id,Name=f.MediaAsset.OriginalFileName})}).ToListAsync(ct);
        if(id.HasValue&&rows.Count==0)return Fail(ServiceFailure.NotFound,"Submission not found.");
        return ServiceResult<object>.Ok(new{Items=rows,Total=await q.CountAsync(ct),Page=page});
    }
    public async Task<ServiceResult<MediaAsset>> Attachment(ClaimsPrincipal user,Guid submissionId,Guid attachmentId,CancellationToken ct=default)
    {
        var a=await Actor(user,ct);if(a.Id==null)return ServiceResult<MediaAsset>.Fail(a.Failure,"Instructor membership required.");
        var file=await db.SubmissionAttachments.AsNoTracking().Where(x=>x.Id==attachmentId&&x.TaskSubmissionId==submissionId&&x.TaskSubmission.Enrollment.Course.OwnerUserId==a.Id&&x.TaskSubmission.SubmittedAt!=null&&x.TaskSubmission.Status!="inProgress"&&x.TaskSubmission.CourseTask.CourseVersion.CourseId==x.TaskSubmission.Enrollment.CourseId&&x.TaskSubmission.CourseTask.CourseVersion.ReviewStatus=="approved").Select(x=>x.MediaAsset).SingleOrDefaultAsync(ct);
        return file==null?ServiceResult<MediaAsset>.Fail(ServiceFailure.NotFound,"Attachment not found."):ServiceResult<MediaAsset>.Ok(file);
    }
    public async Task<ServiceResult<object>> Review(ClaimsPrincipal user,Guid id,InstructorReviewInput input,CancellationToken ct=default)
    {
        if(input.Decision is not ("approved" or "rejected")||input.Feedback?.Length>2000||input.Decision=="rejected"&&string.IsNullOrWhiteSpace(input.Feedback))return Fail(ServiceFailure.Validation,"Choose approved/rejected; revision requests require feedback of at most 2000 characters.");
        try{return await db.Database.CreateExecutionStrategy().ExecuteAsync(async()=>{
            db.ChangeTracker.Clear();await using var tx=await db.Database.BeginTransactionAsync(IsolationLevel.Serializable,ct);
            var a=await Actor(user,ct);if(a.Id==null)return Fail(a.Failure,"Instructor membership required.");
            var cid=await db.TaskSubmissions.Where(x=>x.Id==id&&x.Enrollment.Course.OwnerUserId==a.Id).Select(x=>(Guid?)x.Enrollment.CourseId).SingleOrDefaultAsync(ct);
            if(cid==null)return Fail(ServiceFailure.NotFound,"Submission not found.");
            var course=await (db.Database.IsSqlServer()?db.Courses.FromSqlInterpolated($"SELECT * FROM [Courses] WITH (UPDLOCK,HOLDLOCK) WHERE [Id]={cid.Value}"):db.Courses).SingleAsync(x=>x.Id==cid,ct);
            if(course.OwnerUserId!=a.Id)return Fail(ServiceFailure.NotFound,"Submission not found.");
            var s=await db.TaskSubmissions.Include(x=>x.Enrollment).Include(x=>x.CourseTask).ThenInclude(x=>x.CourseVersion).SingleAsync(x=>x.Id==id,ct);
            if(s.Status!="awaitingReview"||s.SubmittedAt==null||await db.TaskSubmissionReviews.AnyAsync(x=>x.TaskSubmissionId==id,ct))return Fail(ServiceFailure.Conflict,"Only an unreviewed submitted attempt can be reviewed.");
            if(s.Enrollment.Status is not ("active" or "completed")||s.CourseTask.CourseVersion.CourseId!=course.Id||s.CourseTask.CourseVersion.ReviewStatus!="approved"||!await db.EnrollmentVersionAccess.AnyAsync(x=>x.EnrollmentId==s.EnrollmentId&&x.CourseId==course.Id&&x.CourseVersionId==s.CourseTask.CourseVersionId,ct)&&s.Enrollment.CourseVersionId!=s.CourseTask.CourseVersionId)return Fail(ServiceFailure.Conflict,"The task is outside the enrollment's approved version access.");
            db.TaskSubmissionReviews.Add(new(){TaskSubmissionId=id,ReviewerUserId=a.Id,Decision=input.Decision,Feedback=input.Feedback?.Trim(),ReviewedAt=DateTimeOffset.UtcNow});
            s.Status=input.Decision;await db.SaveChangesAsync(ct);await tx.CommitAsync(ct);
            // Immutable evidence only: learner completion, points and certificates remain learner-service responsibilities.
            return ServiceResult<object>.Ok(new{Id=id,Status=s.Status});
        });}finally{db.ChangeTracker.Clear();}
    }
}
