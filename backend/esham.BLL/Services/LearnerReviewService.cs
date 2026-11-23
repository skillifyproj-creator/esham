using System.Data;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using esham.BLL.DTOs;
using esham.BLL.DTOs.Reviews;
using esham.BLL.Interfaces;
using esham.DAL.Data;
using esham.DAL.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
namespace esham.BLL.Services;

public sealed class LearnerReviewService(AppDbContext db,UserManager<ApplicationUser> users,IAccountService accounts,IPhase5MutationGate gate)
{
    internal static Guid Stable(string value)=>new(SHA256.HashData(Encoding.UTF8.GetBytes("esham:phase5:"+value)).AsSpan(0,16));
    public static string Version(CourseReview r)=>Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(new{r.Id,r.Rating,r.Comment,r.InstructorReply,r.UpdatedAt,r.RepliedAt}))));
    internal static LearnerReviewDto Map(CourseReview r,Guid course)=>new(r.Id,r.EnrollmentId,course,r.CourseVersionId,r.Rating,r.Comment,r.InstructorReply,r.CreatedAt,r.UpdatedAt,r.RepliedAt,Version(r),r.Enrollment?.CourseVersion?.TitleAr,r.Enrollment?.CourseVersion?.TitleEn);
    private static ServiceResult<T> Fail<T>(ServiceFailure f,string code)=>ServiceResult<T>.Fail(f,code.Replace('_',' '),code);
    private async Task<(ApplicationUser? User,ServiceFailure Failure)> Actor(ClaimsPrincipal actor,string role,CancellationToken ct){
        var a=await FinancialAccess.Check(users,actor,role);if(a.User==null)return a;
        var stamp=actor.FindFirstValue(users.Options.ClaimsIdentity.SecurityStampClaimType);
        if(stamp!=null&&stamp!=a.User.SecurityStamp)return(null,ServiceFailure.Unauthenticated);
        var s=await accounts.GetCurrentSessionAsync(actor);return s.Failure!=AccountFailure.None||s.OnboardingRequired?(null,ServiceFailure.Conflict):a;
    }
    public async Task<ServiceResult<ReviewPage>> ListAsync(ClaimsPrincipal actor,int page=1,int pageSize=20,CancellationToken ct=default){
        var a=await Actor(actor,"Learner",ct);if(a.User==null)return Fail<ReviewPage>(a.Failure,"account_unavailable");
        if(!FinancialAccess.ValidPage(page,pageSize))return Fail<ReviewPage>(ServiceFailure.Validation,"invalid_page");
        var q=db.CourseReviews.AsNoTracking().Where(x=>x.Enrollment.LearnerUserId==a.User.Id);
        var rows=await q.Include(x=>x.Enrollment).ThenInclude(x=>x.CourseVersion).OrderByDescending(x=>x.UpdatedAt).ThenBy(x=>x.Id).Skip((page-1)*pageSize).Take(pageSize).ToListAsync(ct);
        return ServiceResult<ReviewPage>.Ok(new(a.User.Id,rows.Select(x=>Map(x,x.Enrollment.CourseId)).ToList(),page,pageSize,await q.CountAsync(ct)));
    }
    public async Task<ServiceResult<ReviewPage>> AdminListAsync(ClaimsPrincipal actor,int page=1,CancellationToken ct=default){
        var a=await Actor(actor,"GeneralAdmin",ct);if(a.User==null)return Fail<ReviewPage>(a.Failure,"account_unavailable");
        if(!FinancialAccess.ValidPage(page,20))return Fail<ReviewPage>(ServiceFailure.Validation,"invalid_page");
        var q=db.CourseReviews.AsNoTracking();var rows=await q.Include(x=>x.Enrollment).ThenInclude(x=>x.CourseVersion).OrderByDescending(x=>x.UpdatedAt).ThenBy(x=>x.Id).Skip((page-1)*20).Take(20).ToListAsync(ct);
        return ServiceResult<ReviewPage>.Ok(new(a.User.Id,rows.Select(x=>Map(x,x.Enrollment.CourseId)).ToList(),page,20,await q.CountAsync(ct)));
    }
    public async Task<ServiceResult<ReviewRead>> GetAsync(ClaimsPrincipal actor,Guid enrollmentId,CancellationToken ct=default){
        var a=await Actor(actor,"Learner",ct);if(a.User==null)return Fail<ReviewRead>(a.Failure,"account_unavailable");
        var e=await db.Enrollments.AsNoTracking().SingleOrDefaultAsync(x=>x.Id==enrollmentId&&x.LearnerUserId==a.User.Id,ct);
        if(e==null)return Fail<ReviewRead>(ServiceFailure.NotFound,"enrollment_not_found");
        var eligible=await Eligible(e,ct);var r=await db.CourseReviews.AsNoTracking().SingleOrDefaultAsync(x=>x.EnrollmentId==e.Id,ct);
        return ServiceResult<ReviewRead>.Ok(new(a.User.Id,e.Id,eligible,eligible?null:"review_ineligible",await gate.IsEnabledAsync(Phase5Capability.Reviews,ct),r==null?null:Map(r,e.CourseId),e.CourseVersionId));
    }
    private Task<bool> Eligible(Enrollment e,CancellationToken ct)=>db.CourseVersions.AnyAsync(x=>x.Id==e.CourseVersionId&&x.CourseId==e.CourseId&&x.ReviewStatus=="approved"&&(e.Status=="active"||e.Status=="completed")&&db.EnrollmentVersionAccess.Any(r=>r.EnrollmentId==e.Id&&r.CourseId==e.CourseId&&r.CourseVersionId==e.CourseVersionId)&&x.Course.OwnerUserId!=e.LearnerUserId,ct);
    public Task<ServiceResult<ReviewMutation>> WriteAsync(ClaimsPrincipal actor,Guid enrollmentId,ReviewWrite input,CancellationToken ct=default)=>Change(actor,enrollmentId,"write",input.RequestId,input.ExpectedVersion,input,input.ExpectedCourseVersionId,input.Rating,input.Comment,null,ct);
    public Task<ServiceResult<ReviewMutation>> RemoveAsync(ClaimsPrincipal actor,Guid enrollmentId,ReviewRemove input,bool admin=false,CancellationToken ct=default)=>Change(actor,enrollmentId,admin?"moderate":"withdraw",input.RequestId,input.ExpectedVersion,input,Guid.Empty,0,null,input.Reason,ct);
    public Task<ServiceResult<ReviewMutation>> ReplyAsync(ClaimsPrincipal actor,Guid enrollmentId,ReplyWrite input,bool remove=false,CancellationToken ct=default)=>Change(actor,enrollmentId,remove?"reply-withdraw":"reply",input.RequestId,input.ExpectedVersion,input,Guid.Empty,0,input.Reply,null,ct);
    private static bool TextValid(string? text,int minimum)=>text!=null&&text.Trim().Length>=minimum&&text.Length<=2000&&!text.Any(c=>char.IsControl(c)&&c!='\n'&&c!='\r'&&c!='\t');
    private async Task<ServiceResult<ReviewMutation>> Change(ClaimsPrincipal actor,Guid enrollmentId,string action,Guid request,string? expected,object payload,Guid expectedCourse,int rating,string? text,string? reason,CancellationToken ct){
        if(request==Guid.Empty||action=="write"&&(rating<1||rating>5||!TextValid(text,25))||action=="reply"&&!TextValid(text,1)||action=="moderate"&&!TextValid(reason,1))return Fail<ReviewMutation>(ServiceFailure.Validation,"invalid_review");
        var role=action=="moderate"?"GeneralAdmin":action.StartsWith("reply")?"Instructor":"Learner";
        var a=await Actor(actor,role,ct);if(a.User==null)return Fail<ReviewMutation>(a.Failure,"account_unavailable");
        var target=await db.Enrollments.AsNoTracking().Where(x=>x.Id==enrollmentId&&(role=="GeneralAdmin"||role=="Instructor"&&x.Course.OwnerUserId==a.User.Id||role=="Learner"&&x.LearnerUserId==a.User.Id)).Select(x=>new{x.CourseId,x.LearnerUserId,x.Course.OwnerUserId}).SingleOrDefaultAsync(ct);
        if(target==null)return Fail<ReviewMutation>(ServiceFailure.NotFound,"review_not_found");
        if(!await gate.IsEnabledAsync(Phase5Capability.Reviews,ct))return Fail<ReviewMutation>(ServiceFailure.Forbidden,"phase5_reviews_disabled");
        var operation=Stable("review-request:"+a.User.Id+":"+request);var hash=Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(new{action,enrollmentId,payload}))));
        try{return await db.Database.CreateExecutionStrategy().ExecuteAsync(async()=>{
            db.ChangeTracker.Clear();await using var tx=await db.Database.BeginTransactionAsync(IsolationLevel.Serializable,ct);
            if(!await gate.IsEnabledAsync(Phase5Capability.Reviews,ct))return Fail<ReviewMutation>(ServiceFailure.Forbidden,"phase5_reviews_disabled");
            if(db.Database.IsSqlServer()){
                await db.Courses.FromSqlInterpolated($"SELECT * FROM [Courses] WITH (UPDLOCK,HOLDLOCK) WHERE [Id]={target.CourseId}").SingleAsync(ct);
                foreach(var id in new[]{a.User.Id,target.LearnerUserId,target.OwnerUserId}.Distinct().OrderBy(x=>x,StringComparer.Ordinal))await db.Users.FromSqlInterpolated($"SELECT * FROM [AspNetUsers] WITH (UPDLOCK,HOLDLOCK) WHERE [Id]={id}").SingleAsync(ct);
                await db.Enrollments.FromSqlInterpolated($"SELECT * FROM [Enrollments] WITH (UPDLOCK,HOLDLOCK) WHERE [Id]={enrollmentId}").SingleAsync(ct);
                await db.AdminActivityLogs.FromSqlInterpolated($"SELECT * FROM [AdminActivityLogs] WITH (UPDLOCK,HOLDLOCK) WHERE [Id]={operation}").ToListAsync(ct);
                await db.CourseReviews.FromSqlInterpolated($"SELECT * FROM [CourseReviews] WITH (UPDLOCK,HOLDLOCK) WHERE [EnrollmentId]={enrollmentId}").ToListAsync(ct);
            }
            var fresh=await Actor(actor,role,ct);if(fresh.User==null)return Fail<ReviewMutation>(fresh.Failure,"account_unavailable");
            var e=await db.Enrollments.Include(x=>x.Course).Include(x=>x.CourseVersion).SingleAsync(x=>x.Id==enrollmentId,ct);
            if(role=="Learner"&&e.LearnerUserId!=fresh.User.Id||role=="Instructor"&&(e.Course.OwnerUserId!=fresh.User.Id||e.LearnerUserId==fresh.User.Id))return Fail<ReviewMutation>(ServiceFailure.NotFound,"review_not_found");
            var r=await db.CourseReviews.SingleOrDefaultAsync(x=>x.EnrollmentId==enrollmentId,ct);
            var prior=await db.AdminActivityLogs.AsNoTracking().SingleOrDefaultAsync(x=>x.Id==operation,ct);
            if(prior!=null){if(prior.Details!=hash)return Fail<ReviewMutation>(ServiceFailure.Conflict,"request_conflict");await tx.CommitAsync(ct);return ServiceResult<ReviewMutation>.Ok(new(fresh.User.Id,r==null?null:Map(r,e.CourseId),true));}
            if(r==null&&(action!="write"||expected!=null)||r!=null&&expected!=Version(r))return Fail<ReviewMutation>(ServiceFailure.Conflict,"review_conflict");
            if(action=="write"&&(!await Eligible(e,ct)||expectedCourse!=e.CourseVersionId))return Fail<ReviewMutation>(ServiceFailure.Conflict,"review_ineligible");
            var now=DateTimeOffset.UtcNow;var reviewId=r?.Id??Stable("review:"+operation);var before=r==null?null:Map(r,e.CourseId);
            if(action=="write"){r??=new(){Id=reviewId,EnrollmentId=e.Id,CourseVersionId=e.CourseVersionId};if(before==null)db.CourseReviews.Add(r);r.Rating=rating;r.Comment=text!.Trim();r.UpdatedAt=now>r.UpdatedAt?now:r.UpdatedAt.AddTicks(1);}
            else if(action.StartsWith("reply")){r!.InstructorReply=action=="reply"?text!.Trim():null;r.RepliedAt=now;r.UpdatedAt=now>r.UpdatedAt?now:r.UpdatedAt.AddTicks(1);}
            else db.CourseReviews.Remove(r!);
            // Existing audit columns are bounded strings; retain fields separately without oversized JSON snapshots.
            AdminActivityLog Audit(Guid id,string suffix,string? oldValue,string? newValue)=>new(){Id=id,ActorUserId=fresh.User.Id,Action="learner.review."+action+suffix,TargetType="LearnerReview",TargetId=reviewId.ToString(),CourseId=e.CourseId,CourseVersionId=before is null?e.CourseVersionId:before.CourseVersionId,PreviousState=oldValue,NewState=newValue,Details=suffix==""?hash:null};
            db.AdminActivityLogs.Add(Audit(operation,"",before==null?null:JsonSerializer.Serialize(new{before.Id,before.EnrollmentId,before.CourseVersionId,before.CreatedAt,before.UpdatedAt,before.RepliedAt,before.Rating}),action is "withdraw" or "moderate"?"withdrawn":JsonSerializer.Serialize(new{reviewId,enrollmentId,r!.CreatedAt,r.UpdatedAt,r.RepliedAt,r.Rating})));
            foreach(var field in new[]{(".comment",before?.Comment,action is "withdraw" or "moderate"?null:r!.Comment),(".reply",before?.InstructorReply,action is "withdraw" or "moderate"?null:r!.InstructorReply),(".reason",(string?)null,reason?.Trim())})if(field.Item2!=null||field.Item3!=null)db.AdminActivityLogs.Add(Audit(Stable(operation+field.Item1),field.Item1,field.Item2,field.Item3));
            if(before==null||action=="reply")await new NotificationWriter(db).StageAsync(new(operation,before==null?e.Course.OwnerUserId:e.LearnerUserId,before==null?"review.created":"review.replied","تحديث تقييم الدورة","Course review update","يوجد تحديث على تقييم الدورة.","A course review has been updated."),ct);
            await db.SaveChangesAsync(ct);await tx.CommitAsync(ct);return ServiceResult<ReviewMutation>.Ok(new(fresh.User.Id,action is "withdraw" or "moderate"?null:Map(r!,e.CourseId),false));
        });}finally{db.ChangeTracker.Clear();}
    }
}
