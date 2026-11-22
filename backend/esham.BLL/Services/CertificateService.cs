using System.Data;
using System.Security.Claims;
using System.Text.RegularExpressions;
using esham.BLL.DTOs;
using esham.BLL.DTOs.Completion;
using esham.BLL.Interfaces;
using esham.DAL.Data;
using esham.DAL.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
namespace esham.BLL.Services;
public sealed class CertificateService(AppDbContext db,UserManager<ApplicationUser> users,IAccountService accounts,ICompletionMutationGate gate)
{
    private async Task<(ApplicationUser? User,ServiceFailure Failure)> Learner(ClaimsPrincipal actor)
    {
        var a=await FinancialAccess.Check(users,actor,"Learner");if(a.User==null)return a;
        var session=await accounts.GetCurrentSessionAsync(actor);
        return session.Failure!=AccountFailure.None||session.OnboardingRequired?(null,ServiceFailure.Conflict):a;
    }
    public async Task<ServiceResult<CertificatePage>> ListAsync(ClaimsPrincipal actor,int page,int size,CancellationToken ct=default)
    {
        var a=await Learner(actor);if(a.User==null)return ServiceResult<CertificatePage>.Fail(a.Failure,"Learner session required.");
        if(!FinancialAccess.ValidPage(page,size))return ServiceResult<CertificatePage>.Fail(ServiceFailure.Validation,"Invalid pagination.");
        var q=db.Certificates.AsNoTracking().Where(x=>x.Enrollment.LearnerUserId==a.User.Id);
        var total=await q.CountAsync(ct);var rows=await q.OrderByDescending(x=>x.IssuedAt).ThenBy(x=>x.Id).Skip((page-1)*size).Take(size).ToListAsync(ct);
        return ServiceResult<CertificatePage>.Ok(new(a.User.Id,rows.Select(x=>EnrollmentCompletionService.Detail(x,a.User.Id)).ToList(),page,size,total));
    }
    public async Task<ServiceResult<CertificateDetail>> GetAsync(ClaimsPrincipal actor,Guid id,CancellationToken ct=default)
    {
        var a=await Learner(actor);if(a.User==null)return ServiceResult<CertificateDetail>.Fail(a.Failure,"Learner session required.");
        var c=await db.Certificates.AsNoTracking().SingleOrDefaultAsync(x=>x.Id==id&&x.Enrollment.LearnerUserId==a.User.Id,ct);
        return c==null?ServiceResult<CertificateDetail>.Fail(ServiceFailure.NotFound,"Certificate not found."):
            ServiceResult<CertificateDetail>.Ok(EnrollmentCompletionService.Detail(c,a.User.Id));
    }
    public async Task<ServiceResult<CertificateVerification>> VerifyAsync(string code,CancellationToken ct=default)
    {
        // No prefix, wildcard or incremental-ID searches. New codes have 192 random bits.
        if(!Regex.IsMatch(code,@"\A[0-9A-F]{48}\z",RegexOptions.CultureInvariant))return ServiceResult<CertificateVerification>.Fail(ServiceFailure.NotFound,"Certificate not found.");
        var c=await db.Certificates.AsNoTracking().SingleOrDefaultAsync(x=>x.VerificationCode==code,ct);
        if(c==null||c.Status is not ("issued" or "revoked"))return ServiceResult<CertificateVerification>.Fail(ServiceFailure.NotFound,"Certificate not found.");
        var first=System.Globalization.StringInfo.GetNextTextElement(c.LearnerNameSnapshot.Length==0?"?":c.LearnerNameSnapshot);
        return ServiceResult<CertificateVerification>.Ok(new(c.Status,first+"***",c.CourseTitleSnapshotAr,c.CourseTitleSnapshotEn,c.IssuedAt,"Esham"));
    }
    public async Task<ServiceResult<object>> RevokeAsync(ClaimsPrincipal actor,Guid id,string reason,CancellationToken ct=default)
    {
        if(string.IsNullOrWhiteSpace(reason)||reason.Length>1000)return ServiceResult<object>.Fail(ServiceFailure.Validation,"A reason of at most 1000 characters is required.");
        var a=await new ModerationAccess(db).ReadAsync(actor,ct);
        if(a?.General!=true)return ServiceResult<object>.Fail(a==null?ServiceFailure.Unauthenticated:ServiceFailure.Forbidden,"GeneralAdmin membership required.");
        if(!await gate.IsEnabledAsync(ct))return ServiceResult<object>.Fail(ServiceFailure.Forbidden,"Completion mutations are disabled.","completion_disabled");
        var target=await db.Certificates.AsNoTracking().Where(x=>x.Id==id).Select(x=>new{x.EnrollmentId,x.Enrollment.CourseId}).SingleOrDefaultAsync(ct);
        if(target==null)return ServiceResult<object>.Fail(ServiceFailure.NotFound,"Certificate not found.");
        try{return await db.Database.CreateExecutionStrategy().ExecuteAsync(async()=>{
            db.ChangeTracker.Clear();await using var tx=await db.Database.BeginTransactionAsync(IsolationLevel.Serializable,ct);
            if(!await gate.IsEnabledAsync(ct))throw new InvalidOperationException("Isolated completion gate refused the target.");
            if(db.Database.IsSqlServer()) {
                await db.Courses.FromSqlInterpolated($"SELECT * FROM [Courses] WITH (UPDLOCK,HOLDLOCK) WHERE [Id]={target.CourseId}").SingleAsync(ct);
                await db.Users.FromSqlInterpolated($"SELECT * FROM [AspNetUsers] WITH (UPDLOCK,HOLDLOCK) WHERE [Id]={a.Id}").SingleAsync(ct);
                await db.Enrollments.FromSqlInterpolated($"SELECT * FROM [Enrollments] WITH (UPDLOCK,HOLDLOCK) WHERE [Id]={target.EnrollmentId}").SingleAsync(ct);
            }
            if((await new ModerationAccess(db).ReadAsync(actor,ct))?.General!=true)return ServiceResult<object>.Fail(ServiceFailure.Forbidden,"GeneralAdmin membership required.");
            var c=await db.Certificates.SingleAsync(x=>x.Id==id,ct);
            if(c.Status=="revoked")return ServiceResult<object>.Ok(new{c.Id,c.Status});
            if(c.Status!="issued")return ServiceResult<object>.Fail(ServiceFailure.Conflict,"Unsupported historical certificate status.");
            c.Status="revoked";db.AdminActivityLogs.Add(new(){ActorUserId=a.Id,Action="certificate.revoked",TargetType="Certificate",TargetId=id.ToString("D"),CourseId=target.CourseId,CourseVersionId=c.CourseVersionId,PreviousState="issued",NewState="revoked",Details=reason.Trim()});
            await db.SaveChangesAsync(ct);await tx.CommitAsync(ct);return ServiceResult<object>.Ok(new{c.Id,c.Status});
        });}finally{db.ChangeTracker.Clear();}
    }
}
