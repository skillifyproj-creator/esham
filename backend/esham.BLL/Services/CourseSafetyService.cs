using System.Data;
using System.Security.Claims;
using esham.BLL.DTOs;
using esham.BLL.DTOs.Moderation;
using esham.BLL.Interfaces;
using esham.DAL.Data;
using esham.DAL.Entities;
using Microsoft.EntityFrameworkCore;
namespace esham.BLL.Services;

public sealed class CourseSafetyService(AppDbContext db,INotificationWriter notices)
{
    private readonly ModerationAccess access=new(db);
    private static readonly string[] Reasons=["harmful","inappropriate","misleading","copyright","other"];
    private static ServiceResult<T> Fail<T>(ServiceFailure f,string m)=>ServiceResult<T>.Fail(f,m);
    private static CourseReportDto Report(CourseReport r)=>new(r.Id,r.CourseId,r.CourseVersionId,r.CourseVersion.TitleAr,r.CourseVersion.TitleEn,r.Reason,r.Description,r.ContentLocation,r.LessonId,r.MediaAssetId,r.Status,r.Resolution,r.CreatedAt,r.ReviewedAt);
    private static WarningDto Warning(CourseWarning w)=>new(w.Id,w.CourseVersionId,w.CourseReportId,w.WarningNumber,w.IncidentKey,w.Reason,w.RequiredCorrection,w.Deadline,w.CreatedAt);
    private static AppealDto Appeal(CourseAppeal a)=>new(a.Id,a.CourseWarningId,a.Explanation,a.Status,a.DecisionComment,a.SubmittedAt,a.ReviewedAt);
    private void Log(Course c,CourseVersion v,PlatformActor actor,string action,string type,Guid target,string? previous,string next,string? details=null)=>db.AdminActivityLogs.Add(new(){ActorUserId=actor.Id,Action=action,TargetType=type,TargetId=target.ToString(),TargetName=v.TitleEn??v.TitleAr,CourseId=c.Id,CourseVersionId=v.Id,CategoryId=v.CategoryId,PreviousState=previous,NewState=next,Details=details});
    private Task Notify(string type,Guid id,string user,string title,string message,CancellationToken ct)=>notices.StageAsync(new(ModerationAccess.NoticeId(type,id,user),user,type,null,title,null,message),ct);
    private async Task<ServiceResult<T>> Change<T>(Guid courseId,ClaimsPrincipal principal,Func<Course,PlatformActor,Task<ServiceResult<T>>> action,CancellationToken ct)
    {
        try{return await db.Database.CreateExecutionStrategy().ExecuteAsync(async()=>
        {
            db.ChangeTracker.Clear();await using var tx=await db.Database.BeginTransactionAsync(IsolationLevel.Serializable,ct);
            var actor=await access.ReadAsync(principal,ct);if(actor==null)return Fail<T>(ServiceFailure.Unauthenticated,"A current authenticated account is required.");
            var course=await (db.Database.IsSqlServer()?db.Courses.FromSqlInterpolated($"SELECT * FROM [Courses] WITH (UPDLOCK,HOLDLOCK) WHERE [Id]={courseId}"):db.Courses.AsQueryable()).SingleOrDefaultAsync(x=>x.Id==courseId,ct);
            if(course==null)return Fail<T>(ServiceFailure.NotFound,"Course not found.");
            // Membership is read from Identity inside the transaction; no client role flags authorize work.
            var result=await action(course,actor);if(result.Failure!=ServiceFailure.None)return result;
            await db.SaveChangesAsync(ct);await tx.CommitAsync(ct);return result;
        });}finally{db.ChangeTracker.Clear();}
    }
    public async Task<ServiceResult<List<CourseReportDto>>> ListReportsAsync(ClaimsPrincipal principal,bool mine,CancellationToken ct=default)
    {
        var actor=await access.ReadAsync(principal,ct);if(actor==null)return Fail<List<CourseReportDto>>(ServiceFailure.Unauthenticated,"Sign in first.");
        var q=db.CourseReports.AsNoTracking().Include(x=>x.CourseVersion).AsQueryable();
        if(mine)q=q.Where(x=>x.ReporterUserId==actor.Id);
        else if(!actor.General){if(!actor.Category)return Fail<List<CourseReportDto>>(ServiceFailure.Forbidden,"Moderator access is required.");q=q.Where(x=>db.CategoryAdminAssignments.Any(a=>a.UserId==actor.Id&&a.CategoryId==x.CourseVersion.CategoryId&&a.IsActive));}
        return ServiceResult<List<CourseReportDto>>.Ok((await q.OrderByDescending(x=>x.CreatedAt).ThenBy(x=>x.Id).Take(200).ToListAsync(ct)).Select(Report).ToList());
    }
    public async Task<ServiceResult<List<CourseSafetyCaseDto>>> ListCasesAsync(ClaimsPrincipal principal,CancellationToken ct=default)
    {
        var a=await access.ReadAsync(principal,ct);if(a==null)return Fail<List<CourseSafetyCaseDto>>(ServiceFailure.Unauthenticated,"Sign in first.");
        if(!a.General&&!a.Category)return Fail<List<CourseSafetyCaseDto>>(ServiceFailure.Forbidden,"Moderator membership is required.");
        var q=db.CourseWarnings.AsNoTracking();
        if(!a.General)q=q.Where(x=>db.CategoryAdminAssignments.Any(y=>y.UserId==a.Id&&y.CategoryId==x.CourseVersion.CategoryId&&y.IsActive));
        var rows=await q.OrderByDescending(x=>x.CreatedAt).ThenBy(x=>x.Id).Take(200).Select(x=>new CourseSafetyCaseDto(x.CourseId,x.CourseVersionId,x.CourseVersion.TitleAr,x.CourseVersion.TitleEn,x.Course.SafetyStatus,x.WarningNumber,db.CourseAppeals.Count(y=>y.CourseId==x.CourseId&&y.Status=="pending"&&(a.General||db.CategoryAdminAssignments.Any(z=>z.UserId==a.Id&&z.CategoryId==y.CourseWarning.CourseVersion.CategoryId&&z.IsActive))))).ToListAsync(ct);
        return ServiceResult<List<CourseSafetyCaseDto>>.Ok(rows.GroupBy(x=>x.CourseId).Select(x=>x.First()).ToList());
    }
    private async Task<bool> MediaAttached(Guid version,Guid asset,Guid? lesson,CancellationToken ct)=>
        lesson!=null?await db.Lessons.AnyAsync(x=>x.Id==lesson&&x.CourseSection.CourseVersionId==version&&(x.PrimaryVideoMediaAssetId==asset||x.Attachments.Any(a=>a.MediaAssetId==asset)),ct):
        await db.CourseVersions.AnyAsync(x=>x.Id==version&&x.CoverMediaAssetId==asset,ct)||await db.Lessons.AnyAsync(x=>x.CourseSection.CourseVersionId==version&&(x.PrimaryVideoMediaAssetId==asset||x.Attachments.Any(a=>a.MediaAssetId==asset)),ct)||await db.TaskAttachments.AnyAsync(x=>x.CourseTask.CourseVersionId==version&&x.MediaAssetId==asset,ct);
    public Task<ServiceResult<CourseReportDto>> FileReportAsync(Guid courseId,ClaimsPrincipal principal,FileCourseReportRequest input,CancellationToken ct=default)=>Change(courseId,principal,async(c,a)=>
    {
        if(!Reasons.Contains(input.Reason)||input.Description?.Trim().Length is not (>=20 and <=2000)||input.ContentLocation?.Length>2000)
            return Fail<CourseReportDto>(ServiceFailure.Validation,"Choose a supported reason and describe the problem in 20–2000 characters.");
        var v=await db.CourseVersions.SingleOrDefaultAsync(x=>x.CourseId==courseId&&x.Id==input.CourseVersionId&&x.ReviewStatus=="approved",ct);
        var owned=a.Instructor&&c.OwnerUserId==a.Id;
        var enrolled=await db.Enrollments.AnyAsync(e=>e.CourseId==c.Id&&e.LearnerUserId==a.Id&&(e.Status=="active"||e.Status=="completed")&&(e.CourseVersionId==input.CourseVersionId||db.EnrollmentVersionAccess.Any(v=>v.EnrollmentId==e.Id&&v.CourseVersionId==input.CourseVersionId)),ct);
        if(v==null||!owned&&!enrolled&&(c.PublishedVersionId!=v.Id||c.SafetyStatus!="active"||!await db.Categories.AnyAsync(x=>x.Id==v.CategoryId&&x.IsActive,ct)))return Fail<CourseReportDto>(ServiceFailure.Forbidden,"Only accessible approved course content can be reported.");
        if(input.LessonId is Guid lesson&&!await db.Lessons.AnyAsync(x=>x.Id==lesson&&x.CourseSection.CourseVersionId==v.Id&&(owned||enrolled||x.IsPreview),ct))return Fail<CourseReportDto>(ServiceFailure.Forbidden,"The reported lesson is outside your available content.");
        if(input.MediaAssetId is Guid asset&&!await MediaAttached(v.Id,asset,input.LessonId,ct))return Fail<CourseReportDto>(ServiceFailure.Validation,"Reported media must be attached to the observed course version.");
        if(input.MediaAssetId is Guid media&&!owned&&!enrolled&&!await db.CourseVersions.AnyAsync(x=>x.Id==v.Id&&x.CoverMediaAssetId==media,ct)&&!await db.Lessons.AnyAsync(x=>x.CourseSection.CourseVersionId==v.Id&&x.IsPreview&&(x.PrimaryVideoMediaAssetId==media||x.Attachments.Any(at=>at.MediaAssetId==media)),ct))return Fail<CourseReportDto>(ServiceFailure.Forbidden,"The reported media is not available to this account.");
        if(await db.CourseReports.AnyAsync(x=>x.CourseId==courseId&&x.CourseVersionId==v.Id&&x.ReporterUserId==a.Id&&x.Reason==input.Reason&&(x.Status=="pending"||x.Status=="reviewing"),ct))return Fail<CourseReportDto>(ServiceFailure.Conflict,"An open report already exists for this reason and observed version.");
        var report=new CourseReport{CourseId=c.Id,CourseVersionId=v.Id,CourseVersion=v,ReporterUserId=a.Id,Reason=input.Reason,Description=input.Description!.Trim(),ContentLocation=input.ContentLocation?.Trim(),LessonId=input.LessonId,MediaAssetId=input.MediaAssetId};db.CourseReports.Add(report);
        Log(c,v,a,"course.reported","CourseReport",report.Id,null,"pending");return ServiceResult<CourseReportDto>.Ok(Report(report));
    },ct);
    public Task<ServiceResult<CourseReportDto>> ResolveReportAsync(Guid courseId,Guid reportId,ClaimsPrincipal principal,ResolveCourseReportRequest input,CancellationToken ct=default)=>Change(courseId,principal,async(c,a)=>
    {
        var report=await db.CourseReports.Include(x=>x.CourseVersion).SingleOrDefaultAsync(x=>x.Id==reportId&&x.CourseId==courseId,ct);
        if(report==null)return Fail<CourseReportDto>(ServiceFailure.NotFound,"Report not found.");
        if(!await access.CanModerateAsync(a,c,report.CourseVersion,ct))return Fail<CourseReportDto>(ServiceFailure.Forbidden,"An independent moderator with category scope is required.");
        if(input.Status is not ("reviewing" or "resolved" or "dismissed")||input.Resolution?.Length>4000||input.Status!="reviewing"&&input.Resolution?.Trim().Length is not >=10)return Fail<CourseReportDto>(ServiceFailure.Validation,"Provide a valid report outcome and at least ten characters of feedback to close it.");
        if(report.Status!=input.ExpectedStatus||report.Status is "resolved" or "dismissed"||input.Status==report.Status)return Fail<CourseReportDto>(ServiceFailure.Conflict,"Report changed or is already closed. Reload before retrying.");
        var previous=report.Status;report.Status=input.Status;report.Resolution=input.Resolution?.Trim();report.ReviewedByUserId=a.Id;report.ReviewedAt=DateTimeOffset.UtcNow;
        Log(c,report.CourseVersion,a,"course.report."+report.Status,"CourseReport",report.Id,previous,report.Status,report.Resolution);
        // A report/outcome never automatically issues a warning or suspends a course.
        return ServiceResult<CourseReportDto>.Ok(Report(report));
    },ct);
    public async Task<ServiceResult<CourseSafetyDto>> GetAsync(Guid courseId,ClaimsPrincipal principal,Guid? observedVersionId=null,CancellationToken ct=default)
    {
        var a=await access.ReadAsync(principal,ct);if(a==null)return Fail<CourseSafetyDto>(ServiceFailure.Unauthenticated,"Sign in first.");
        var c=await db.Courses.AsNoTracking().SingleOrDefaultAsync(x=>x.Id==courseId,ct);if(c==null)return Fail<CourseSafetyDto>(ServiceFailure.NotFound,"Course not found.");
        var v=await db.CourseVersions.AsNoTracking().SingleOrDefaultAsync(x=>x.CourseId==courseId&&x.Id==(observedVersionId??c.PublishedVersionId??c.DraftVersionId),ct);if(v==null)return Fail<CourseSafetyDto>(ServiceFailure.NotFound,"Course version not found.");
        var own=a.Instructor&&c.OwnerUserId==a.Id;var moderate=await access.CanModerateAsync(a,c,v,ct);
        if(!own&&!moderate)return Fail<CourseSafetyDto>(ServiceFailure.Forbidden,"Course safety history is outside your scope.");
        var q=db.CourseWarnings.AsNoTracking().Where(x=>x.CourseId==courseId);
        if(!own&&!a.General)q=q.Where(x=>db.CategoryAdminAssignments.Any(y=>y.UserId==a.Id&&y.CategoryId==x.CourseVersion.CategoryId&&y.IsActive));
        var warnings=await q.OrderBy(x=>x.WarningNumber).ToListAsync(ct);var ids=warnings.Select(x=>x.Id).ToArray();
        var appeals=await db.CourseAppeals.AsNoTracking().Where(x=>x.CourseId==courseId&&ids.Contains(x.CourseWarningId)).OrderByDescending(x=>x.SubmittedAt).ToListAsync(ct);
        return ServiceResult<CourseSafetyDto>.Ok(new(c.Id,c.SafetyStatus,c.EnrollmentPaused,warnings.Select(Warning).ToList(),appeals.Select(Appeal).ToList(),moderate,own,a.General&&c.OwnerUserId!=a.Id,c.PublishedVersionId));
    }
    public Task<ServiceResult<WarningDto>> WarnAsync(Guid courseId,ClaimsPrincipal principal,IssueCourseWarningRequest input,CancellationToken ct=default)=>Change(courseId,principal,async(c,a)=>
    {
        var v=await db.CourseVersions.SingleOrDefaultAsync(x=>x.Id==input.CourseVersionId&&x.CourseId==c.Id,ct);
        if(v==null)return Fail<WarningDto>(ServiceFailure.NotFound,"Observed version not found.");
        if(!await access.CanModerateAsync(a,c,v,ct))return Fail<WarningDto>(ServiceFailure.Forbidden,"An independent moderator with category scope is required.");
        if(!input.Verified||input.IncidentKey?.Trim().Length is not (>=1 and <=200)||input.Reason?.Trim().Length is not (>=1 and <=2000)||input.RequiredCorrection?.Trim().Length is not (>=1 and <=4000)||input.Deadline<DateTimeOffset.UtcNow.Date)return Fail<WarningDto>(ServiceFailure.Validation,"A verified incident, reason, correction and current/future deadline are required.");
        if(input.CourseReportId is Guid rid&&!await db.CourseReports.AnyAsync(x=>x.Id==rid&&x.CourseId==c.Id&&x.CourseVersionId==v.Id,ct))return Fail<WarningDto>(ServiceFailure.Validation,"Warning report must belong to the same observed course version.");
        if(input.MediaAssetId is Guid mid&&!await MediaAttached(v.Id,mid,null,ct))return Fail<WarningDto>(ServiceFailure.Validation,"Warning media must belong to the observed version.");
        var incident=input.IncidentKey!.Trim();if(await db.CourseWarnings.AnyAsync(x=>x.CourseId==c.Id&&x.IncidentKey==incident,ct))return Fail<WarningDto>(ServiceFailure.Conflict,"This course incident already has an immutable warning.");
        var number=(await db.CourseWarnings.Where(x=>x.CourseId==c.Id).Select(x=>(int?)x.WarningNumber).MaxAsync(ct)??0)+1;
        if(number>3||c.SafetyStatus=="archived")return Fail<WarningDto>(ServiceFailure.Conflict,"Three warnings or an archived course cannot receive another warning.");
        var warning=new CourseWarning{CourseId=c.Id,CourseVersionId=v.Id,CourseReportId=input.CourseReportId,MediaAssetId=input.MediaAssetId,IssuedByUserId=a.Id,IncidentKey=incident,WarningNumber=number,Reason=input.Reason!.Trim(),RequiredCorrection=input.RequiredCorrection!.Trim(),Deadline=input.Deadline};db.CourseWarnings.Add(warning);
        if(number>=2)c.EnrollmentPaused=true;if(number==3)c.SafetyStatus="archived";c.UpdatedAt=DateTimeOffset.UtcNow;
        Log(c,v,a,"course.warning.issued","CourseWarning",warning.Id,null,number.ToString(),warning.Reason);
        await Notify("course.warning",warning.Id,c.OwnerUserId,"Course warning",$"Warning {number}/3: {warning.Reason[..Math.Min(1800,warning.Reason.Length)]}",ct);
        return ServiceResult<WarningDto>.Ok(Warning(warning));
    },ct);
    public Task<ServiceResult<Guid>> SuspendAsync(Guid courseId,ClaimsPrincipal principal,SuspendCourseRequest input,CancellationToken ct=default)=>Change(courseId,principal,async(c,a)=>
    {
        var v=await db.CourseVersions.SingleOrDefaultAsync(x=>x.Id==input.CourseVersionId&&x.CourseId==c.Id,ct);if(v==null)return Fail<Guid>(ServiceFailure.NotFound,"Observed version not found.");
        if(!await access.CanModerateAsync(a,c,v,ct))return Fail<Guid>(ServiceFailure.Forbidden,"An independent moderator with scope is required.");
        if(!input.Verified||input.Reason?.Trim().Length is not (>=10 and <=2000))return Fail<Guid>(ServiceFailure.Validation,"Verified evidence and a suspension reason of 10–2000 characters are required.");
        if(c.SafetyStatus!="active")return Fail<Guid>(ServiceFailure.Conflict,"Only an active course may be urgently suspended.");
        c.SafetyStatus="suspended";c.EnrollmentPaused=true;c.UpdatedAt=DateTimeOffset.UtcNow;
        var eventId=Guid.NewGuid();Log(c,v,a,"course.suspended","Course",c.Id,"active","suspended",input.Reason!.Trim());await Notify("course.suspended",eventId,c.OwnerUserId,"Course suspended",input.Reason.Trim(),ct);return ServiceResult<Guid>.Ok(c.Id);
    },ct);
    public Task<ServiceResult<AppealDto>> AppealAsync(Guid courseId,ClaimsPrincipal principal,SubmitCourseAppealRequest input,CancellationToken ct=default)=>Change(courseId,principal,async(c,a)=>
    {
        if(!a.Instructor||c.OwnerUserId!=a.Id)return Fail<AppealDto>(ServiceFailure.Forbidden,"Only the owner instructor may appeal a warning.");
        if(input.Explanation?.Trim().Length is not (>=10 and <=4000))return Fail<AppealDto>(ServiceFailure.Validation,"Provide an explanation of 10–4000 characters.");
        var w=await db.CourseWarnings.Include(x=>x.CourseVersion).SingleOrDefaultAsync(x=>x.Id==input.CourseWarningId&&x.CourseId==c.Id,ct);if(w==null)return Fail<AppealDto>(ServiceFailure.NotFound,"Warning not found.");
        if(await db.CourseAppeals.AnyAsync(x=>x.CourseWarningId==w.Id&&x.InstructorUserId==a.Id,ct))return Fail<AppealDto>(ServiceFailure.Conflict,"This warning already has an appeal; its decision/history is retained.");
        var appeal=new CourseAppeal{CourseId=c.Id,CourseWarningId=w.Id,InstructorUserId=a.Id,Explanation=input.Explanation!.Trim()};db.CourseAppeals.Add(appeal);Log(c,w.CourseVersion,a,"course.appeal.submitted","CourseAppeal",appeal.Id,null,"pending");return ServiceResult<AppealDto>.Ok(Appeal(appeal));
    },ct);
    public Task<ServiceResult<AppealDto>> DecideAppealAsync(Guid courseId,Guid appealId,ClaimsPrincipal principal,DecideCourseAppealRequest input,CancellationToken ct=default)=>Change(courseId,principal,async(c,a)=>
    {
        if(!a.General||c.OwnerUserId==a.Id)return Fail<AppealDto>(ServiceFailure.Forbidden,"Only GeneralAdmin may make the final appeal decision, independently of course ownership.");
        if(input.Decision is not ("accepted" or "rejected")||input.Comment?.Trim().Length is not (>=10 and <=4000))return Fail<AppealDto>(ServiceFailure.Validation,"Choose accepted/rejected and provide 10–4000 characters of reasoning.");
        var appeal=await db.CourseAppeals.Include(x=>x.CourseWarning).ThenInclude(x=>x.CourseVersion).SingleOrDefaultAsync(x=>x.Id==appealId&&x.CourseId==c.Id,ct);if(appeal==null)return Fail<AppealDto>(ServiceFailure.NotFound,"Appeal not found.");
        if(appeal.Status!="pending")return Fail<AppealDto>(ServiceFailure.Conflict,"This appeal already has a final decision.");
        appeal.Status=input.Decision;appeal.ReviewedByUserId=a.Id;appeal.DecisionComment=input.Comment!.Trim();appeal.ReviewedAt=DateTimeOffset.UtcNow;
        Log(c,appeal.CourseWarning.CourseVersion,a,"course.appeal."+appeal.Status,"CourseAppeal",appeal.Id,"pending",appeal.Status,appeal.DecisionComment);
        await Notify("course.appeal.decided",appeal.Id,c.OwnerUserId,"Course appeal decision",$"{appeal.Status}: {appeal.DecisionComment[..Math.Min(1800,appeal.DecisionComment.Length)]}",ct);
        // A final decision never rewrites warning evidence or silently changes course access.
        return ServiceResult<AppealDto>.Ok(Appeal(appeal));
    },ct);
}
