using System.Data;
using System.Security.Claims;
using esham.BLL.DTOs;
using esham.DAL.Data;
using esham.DAL.Entities;
using Microsoft.EntityFrameworkCore;
namespace esham.BLL.Services;

public sealed record InstructorReviewInput(string Decision,string? Feedback);
public sealed class InstructorInsightsService(AppDbContext db, EnrollmentCompletionService? completion = null)
{
    private readonly ModerationAccess access=new(db);
    private static ServiceResult<object> Fail(ServiceFailure f,string m)=>ServiceResult<object>.Fail(f,m);
    private async Task<(string? Id,ServiceFailure Failure)> Actor(ClaimsPrincipal user,CancellationToken ct)
    {
        var a=await access.ReadAsync(user,ct);
        return a==null?(null,ServiceFailure.Unauthenticated):!a.Instructor?(null,ServiceFailure.Forbidden):(a.Id,ServiceFailure.None);
    }
    public async Task<ServiceResult<object>> Analytics(ClaimsPrincipal user,Guid? courseId,string period="all",CancellationToken ct=default,int sectionPage=1)
    {
        var a=await Actor(user,ct);if(a.Id==null)return Fail(a.Failure,"Instructor membership required.");
        if(!new[]{"all","7d","30d","3m"}.Contains(period))return Fail(ServiceFailure.Validation,"Invalid period.");
        if(!FinancialAccess.ValidPage(sectionPage,50))return Fail(ServiceFailure.Validation,"Invalid section page.");
        if(courseId.HasValue&&!await db.Courses.AnyAsync(x=>x.Id==courseId&&x.OwnerUserId==a.Id,ct))return Fail(ServiceFailure.NotFound,"Course not found.");
        return ServiceResult<object>.Ok(await new InstructorMetricsProjection(db).ReadAsync(a.Id,courseId,period,ct,sectionPage));
    }
    public async Task<ServiceResult<object>> Reviews(ClaimsPrincipal user,Guid? courseId,int page=1,CancellationToken ct=default,int? rating=null,string? replyStatus=null)
    {
        var a=await Actor(user,ct);if(a.Id==null)return Fail(a.Failure,"Instructor membership required.");
        if(page<1||page>100000)return Fail(ServiceFailure.Validation,"Invalid page.");
        if(rating.HasValue&&(rating<1||rating>5)||replyStatus is not (null or "all" or "replied" or "unanswered"))return Fail(ServiceFailure.Validation,"Invalid review filter.");
        if(courseId.HasValue&&!await db.Courses.AnyAsync(x=>x.Id==courseId&&x.OwnerUserId==a.Id,ct))return Fail(ServiceFailure.NotFound,"Course not found.");
        var q=db.CourseReviews.AsNoTracking().Where(x=>x.Enrollment.Course.OwnerUserId==a.Id&&(!courseId.HasValue||x.Enrollment.CourseId==courseId));
        if(rating.HasValue)q=q.Where(x=>x.Rating==rating);
        if(replyStatus=="replied")q=q.Where(x=>x.InstructorReply!=null&&x.InstructorReply!="");
        if(replyStatus=="unanswered")q=q.Where(x=>x.InstructorReply==null||x.InstructorReply=="");
        var values=await q.OrderByDescending(x=>x.CreatedAt).ThenBy(x=>x.Id).Skip((page-1)*50).Take(50).Include(x=>x.Enrollment).ThenInclude(x=>x.LearnerUser).Include(x=>x.Enrollment).ThenInclude(x=>x.Course).ThenInclude(x=>x.PublishedVersion).Include(x=>x.Enrollment).ThenInclude(x=>x.CourseVersion).ToListAsync(ct);
        var rows=values.Select(x=>new{x.Id,CourseId=x.Enrollment.CourseId,x.CourseVersionId,x.Rating,x.Comment,x.InstructorReply,x.CreatedAt,x.UpdatedAt,x.RepliedAt,Version=LearnerReviewService.Version(x),LearnerName=x.Enrollment.LearnerUser.Name,LearnerNameEn=x.Enrollment.LearnerUser.NameEn,TitleAr=(x.Enrollment.Course.PublishedVersion??x.Enrollment.CourseVersion).TitleAr,TitleEn=(x.Enrollment.Course.PublishedVersion??x.Enrollment.CourseVersion).TitleEn});
        var distribution=await q.GroupBy(x=>x.Rating).Select(g=>new{Rating=g.Key,Count=g.Count()}).ToListAsync(ct);
        return ServiceResult<object>.Ok(new{AccountId=a.Id,Items=rows,Total=await q.CountAsync(ct),Page=page,Summary=new{Average=await q.AverageAsync(x=>(double?)x.Rating,ct)??0,Replied=await q.CountAsync(x=>x.InstructorReply!=null&&x.InstructorReply!="",ct),Distribution=Enumerable.Range(1,5).ToDictionary(x=>x.ToString(),x=>distribution.Where(r=>r.Rating==x).Sum(r=>r.Count))}});
    }
    public async Task<ServiceResult<object>> CourseMetrics(ClaimsPrincipal user,int page=1,int pageSize=20,CancellationToken ct=default){
        var a=await Actor(user,ct);if(a.Id==null)return Fail(a.Failure,"Instructor membership required.");
        if(!FinancialAccess.ValidPage(page,pageSize))return Fail(ServiceFailure.Validation,"Invalid page.");
        var q=db.Courses.AsNoTracking().Where(x=>x.OwnerUserId==a.Id);
        var items=await q.OrderBy(x=>x.Id).Skip((page-1)*pageSize).Take(pageSize).Select(x=>new{x.Id,Enrolled=db.Enrollments.Count(e=>e.CourseId==x.Id),Completed=db.Enrollments.Count(e=>e.CourseId==x.Id&&(e.Status=="completed"||e.CompletedAt!=null)),
            EarnedPoints=db.PointTransactions.Where(t=>t.UserId==a.Id&&t.TransactionType=="teaching"&&t.Enrollment!=null&&t.Enrollment.CourseId==x.Id).Sum(t=>(long?)t.Amount)??0,
            AwaitingReview=db.TaskSubmissions.Count(s=>s.Enrollment.CourseId==x.Id&&s.SubmittedAt!=null&&s.Status=="awaitingReview"&&s.CourseTask.CourseVersion.CourseId==x.Id&&s.CourseTask.CourseVersion.ReviewStatus=="approved")}).ToListAsync(ct);
        return ServiceResult<object>.Ok(new{AccountId=a.Id,Items=items,Page=page,PageSize=pageSize,TotalCount=await q.CountAsync(ct)});
    }
    public async Task<ServiceResult<object>> Submissions(ClaimsPrincipal user,string? status,Guid? id=null,int page=1,CancellationToken ct=default)
    {
        var a=await Actor(user,ct);if(a.Id==null)return Fail(a.Failure,"Instructor membership required.");
        if(page<1||page>100000||status!=null&&!new[]{"awaitingReview","approved","rejected"}.Contains(status))return Fail(ServiceFailure.Validation,"Invalid submission filter.");
        // Draft answers are private. Never expose a learner's in-progress attempt.
        var q=db.TaskSubmissions.AsNoTracking().Where(x=>x.Enrollment.Course.OwnerUserId==a.Id&&x.SubmittedAt!=null&&x.CourseTask.CourseVersion.CourseId==x.Enrollment.CourseId&&x.CourseTask.CourseVersion.ReviewStatus=="approved"&&x.Status!="inProgress"&&(!id.HasValue||x.Id==id)&& (status==null||x.Status==status));
        var rows=await q.OrderByDescending(x=>x.SubmittedAt).ThenBy(x=>x.Id).Skip((page-1)*50).Take(50).Select(x=>new{x.Id,x.Status,x.AttemptNumber,x.SubmittedAt,x.AnswerText,x.WorkUrl,x.CourseTaskId,CourseId=x.Enrollment.CourseId,x.CourseTask.CourseVersionId,x.CourseTask.LogicalTaskId,x.IsOptionalAtCreation,x.CourseTask.Instructions,x.CourseTask.Requirements,x.CourseTask.TitleAr,x.CourseTask.TitleEn,LearnerName=x.Enrollment.LearnerUser.Name,LearnerNameEn=x.Enrollment.LearnerUser.NameEn,Reviews=x.Reviews.OrderByDescending(r=>r.ReviewedAt).Select(r=>new{r.Id,r.Decision,r.Feedback,r.ReviewedAt}),Files=x.Attachments.Select(f=>new{f.Id,Name=f.MediaAsset.OriginalFileName})}).ToListAsync(ct);
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
        // Discovery is outside the serializable transaction: no user/evidence read locks precede the course lock.
        var a=await Actor(user,ct);if(a.Id==null)return Fail(a.Failure,"Instructor membership required.");
        var target=await db.TaskSubmissions.AsNoTracking().Where(x=>x.Id==id&&x.Enrollment.Course.OwnerUserId==a.Id)
            .Select(x=>new{x.Enrollment.CourseId,x.EnrollmentId,x.Enrollment.LearnerUserId}).SingleOrDefaultAsync(ct);
        if(target==null)return Fail(ServiceFailure.NotFound,"Submission not found.");
        try{return await db.Database.CreateExecutionStrategy().ExecuteAsync(async()=>{
            db.ChangeTracker.Clear();await using var tx=await db.Database.BeginTransactionAsync(IsolationLevel.Serializable,ct);
            var course=await (db.Database.IsSqlServer()?db.Courses.FromSqlInterpolated($"SELECT * FROM [Courses] WITH (UPDLOCK,HOLDLOCK) WHERE [Id]={target.CourseId}"):db.Courses).SingleAsync(x=>x.Id==target.CourseId,ct);
            if(db.Database.IsSqlServer()) {
                foreach(var uid in new[]{a.Id,target.LearnerUserId}.Distinct().OrderBy(x=>x,StringComparer.Ordinal))
                    await db.Users.FromSqlInterpolated($"SELECT * FROM [AspNetUsers] WITH (UPDLOCK,HOLDLOCK) WHERE [Id]={uid}").SingleAsync(ct);
                await db.Enrollments.FromSqlInterpolated($"SELECT * FROM [Enrollments] WITH (UPDLOCK,HOLDLOCK) WHERE [Id]={target.EnrollmentId}").SingleAsync(ct);
            }
            if(course.OwnerUserId!=a.Id)return Fail(ServiceFailure.NotFound,"Submission not found.");
            var fresh=await Actor(user,ct);if(fresh.Id!=a.Id)return Fail(fresh.Failure,"Instructor session changed.");
            var s=await db.TaskSubmissions.Include(x=>x.Enrollment).Include(x=>x.CourseTask).ThenInclude(x=>x.CourseVersion).SingleAsync(x=>x.Id==id,ct);
            if(s.Status!="awaitingReview"||s.SubmittedAt==null||await db.TaskSubmissionReviews.AnyAsync(x=>x.TaskSubmissionId==id,ct))return Fail(ServiceFailure.Conflict,"Only an unreviewed submitted attempt can be reviewed.");
            if(s.Enrollment.Status is not ("active" or "completed")||s.CourseTask.CourseVersion.CourseId!=course.Id||s.CourseTask.CourseVersion.ReviewStatus!="approved"||!await db.EnrollmentVersionAccess.AnyAsync(x=>x.EnrollmentId==s.EnrollmentId&&x.CourseId==course.Id&&x.CourseVersionId==s.CourseTask.CourseVersionId,ct)&&s.Enrollment.CourseVersionId!=s.CourseTask.CourseVersionId)return Fail(ServiceFailure.Conflict,"The task is outside the enrollment's approved version access.");
            var review=new TaskSubmissionReview {TaskSubmissionId=id,ReviewerUserId=a.Id,Decision=input.Decision,Feedback=input.Feedback?.Trim(),ReviewedAt=DateTimeOffset.UtcNow};
            db.TaskSubmissionReviews.Add(review);
            await new NotificationWriter(db).StageAsync(new(review.Id,s.Enrollment.LearnerUserId,"task.assessed","تمت مراجعة المهمة","Task assessed","تمت مراجعة محاولتك. افتح التسليم لعرض القرار والملاحظات.","Your attempt has been assessed. Open the submission to see the decision and feedback."),ct);
            s.Status=input.Decision;await db.SaveChangesAsync(ct);
            if(input.Decision=="approved" && completion!=null)await completion.StageAsync(s.EnrollmentId,ct);
            await tx.CommitAsync(ct);
            return ServiceResult<object>.Ok(new{Id=id,Status=s.Status});
        });}finally{db.ChangeTracker.Clear();}
    }
}
