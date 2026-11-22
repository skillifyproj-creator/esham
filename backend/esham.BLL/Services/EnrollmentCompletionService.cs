using System.Data;
using System.Security.Claims;
using System.Security.Cryptography;
using esham.BLL.DTOs;
using esham.BLL.DTOs.Completion;
using esham.BLL.Interfaces;
using esham.DAL.Data;
using esham.DAL.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
namespace esham.BLL.Services;

// This coordinator stages only inside a course-locked business transaction. Never creates evidence.
public sealed class EnrollmentCompletionService(AppDbContext db, ICompletionMutationGate gate,
    ICourseVersionUpdates versions, UserManager<ApplicationUser> users, IAccountService accounts)
{
    internal static CertificateDetail Detail(Certificate c, string account) => new(account,c.Id,c.EnrollmentId,c.CourseVersionId,
        c.VerificationCode,c.LearnerNameSnapshot,c.CourseTitleSnapshotAr,c.CourseTitleSnapshotEn,c.InstructorNameSnapshot,c.IssuedAt,c.Status);
    private async Task<ServiceResult<Enrollment>> Owned(ClaimsPrincipal actor, Guid id, CancellationToken ct)
    {
        var (u,f) = await FinancialAccess.Check(users,actor,"Learner");
        if (u == null) return ServiceResult<Enrollment>.Fail(f,"Learner membership and a valid session are required.");
        var session = await accounts.GetCurrentSessionAsync(actor);
        if (session.Failure != AccountFailure.None || session.OnboardingRequired)
            return ServiceResult<Enrollment>.Fail(ServiceFailure.Conflict,"Complete account setup first.","onboarding_required");
        var e = await db.Enrollments.AsNoTracking().SingleOrDefaultAsync(x=>x.Id==id && x.LearnerUserId==u.Id,ct);
        return e == null ? ServiceResult<Enrollment>.Fail(ServiceFailure.NotFound,"Enrollment not found.") : ServiceResult<Enrollment>.Ok(e);
    }
    public async Task<ServiceResult<CompletionState>> GetAsync(ClaimsPrincipal actor, Guid id, CancellationToken ct=default)
    {
        var owned=await Owned(actor,id,ct);
        if(owned.Value == null) return ServiceResult<CompletionState>.Fail(owned.Failure,owned.Message ?? "Enrollment unavailable.",owned.Code);
        // SQL snapshot isolation is not assumed/enabled. Serialize the projection with the
        // same course lock as publication/completion/revocation; GET never writes data.
        try {return await db.Database.CreateExecutionStrategy().ExecuteAsync(async()=>{
            db.ChangeTracker.Clear();
            // The held course update lock excludes every scoped writer. ReadCommitted avoids
            // retaining unrelated evidence-scan ranges that can deadlock with other courses.
            await using var tx=await db.Database.BeginTransactionAsync(db.Database.IsSqlServer()?IsolationLevel.ReadCommitted:IsolationLevel.Serializable,ct);
            if(db.Database.IsSqlServer())await db.Courses.FromSqlInterpolated($"SELECT * FROM [Courses] WITH (UPDLOCK,HOLDLOCK) WHERE [Id]={owned.Value.CourseId}").SingleAsync(ct);
            var fresh=await Owned(actor,id,ct);
            if(fresh.Value==null)return ServiceResult<CompletionState>.Fail(fresh.Failure,fresh.Message??"Enrollment unavailable.",fresh.Code);
            var state=await State(fresh.Value,ct);await tx.CommitAsync(ct);
            return ServiceResult<CompletionState>.Ok(state);
        });}finally{db.ChangeTracker.Clear();}
    }
    private async Task<CompletionState> State(Enrollment e,CancellationToken ct)
    {
        var c=await db.Certificates.AsNoTracking().SingleOrDefaultAsync(x=>x.EnrollmentId==e.Id,ct);
        var historical=CourseVersionUpdates.IsCourseCompleted(e);
        var inconsistent=historical && (e.Status!="completed" || e.CompletedAt==null || c==null || c.CourseVersionId==null)
            || !historical && c!=null;
        var v=await versions.GetStateAsync(e.Id,e.LearnerUserId,ct);
        var value=v.Value;
        var eligible=!historical && e.Status=="active" && c==null && value!=null
            && value.CurrentItemCount>0 && value.Lessons.All(x=>x.IsCompleted) && value.Tasks.All(x=>x.IsApproved);
        return new(e.LearnerUserId,e.Id,value?.AvailableCourseVersionId,e.Status,e.CompletedAt,eligible,
            inconsistent?"historical_completion_ambiguous":historical?null:value==null?v.Code??"course_unavailable":value.CurrentItemCount==0?"no_requirements":eligible?null:"requirements_outstanding",
            historical?0:value?.Lessons.Count??0,historical?0:value?.Lessons.Count(x=>x.IsCompleted)??0,historical?0:value?.Tasks.Count??0,historical?0:value?.Tasks.Count(x=>x.IsApproved)??0,
            c==null?null:Detail(c,e.LearnerUserId),await gate.IsEnabledAsync(ct));
    }
    public async Task StageAsync(Guid id,CancellationToken ct=default)
    {
        if(!await gate.IsEnabledAsync(ct)) return;
        if(db.Database.CurrentTransaction==null) throw new InvalidOperationException("Completion requires the business transaction.");
        var e=await db.Enrollments.SingleAsync(x=>x.Id==id,ct);
        // Never repair ambiguous historic records or mint a certificate for an unknown completion version.
        if(CourseVersionUpdates.IsCourseCompleted(e) || e.Status!="active" || await db.Certificates.AnyAsync(x=>x.EnrollmentId==id,ct)) return;
        var persistedActor=new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier,e.LearnerUserId)],"completion-recovery"));
        var membership=await FinancialAccess.Check(users,persistedActor,"Learner");
        if(membership.User==null)return;
        var session=await accounts.GetCurrentSessionAsync(persistedActor);
        if(session.Failure!=AccountFailure.None||session.OnboardingRequired)return;
        var v=(await versions.GetStateAsync(id,e.LearnerUserId,ct)).Value;
        if(v==null || v.CurrentItemCount==0 || !v.Lessons.All(x=>x.IsCompleted) || !v.Tasks.All(x=>x.IsApproved)) return;
        var course=await db.Courses.SingleAsync(x=>x.Id==e.CourseId,ct);
        var version=await db.CourseVersions.SingleAsync(x=>x.Id==v.AvailableCourseVersionId,ct);
        var learner=await db.Users.SingleAsync(x=>x.Id==e.LearnerUserId,ct);
        var instructor=await db.Users.SingleAsync(x=>x.Id==course.OwnerUserId,ct);
        string? Name(ApplicationUser u)=>string.IsNullOrWhiteSpace(u.Name)?u.NameEn?.Trim():u.Name.Trim();
        var ln=Name(learner);var ins=Name(instructor);
        if(string.IsNullOrWhiteSpace(ln)||ln.Length>200||string.IsNullOrWhiteSpace(ins)||ins.Length>200
            || string.IsNullOrWhiteSpace(version.TitleAr)&&string.IsNullOrWhiteSpace(version.TitleEn))
            throw new InvalidOperationException("Certificate snapshot data requires review.");
        var now=DateTimeOffset.UtcNow;
        var certificate=new Certificate{EnrollmentId=id,CourseVersionId=version.Id,VerificationCode=Convert.ToHexString(RandomNumberGenerator.GetBytes(24)),
            LearnerNameSnapshot=ln,InstructorNameSnapshot=ins,CourseTitleSnapshotAr=version.TitleAr,CourseTitleSnapshotEn=version.TitleEn,IssuedAt=now};
        e.Status="completed"; e.CompletedAt=now; db.Certificates.Add(certificate);
        await new NotificationWriter(db).StageAsync(new(certificate.Id,e.LearnerUserId,"certificate.issued",
            "شهادة إكمال الدورة","Course certificate issued","أصبحت شهادة إكمال الدورة متاحة.","Your course completion certificate is available."),ct);
        await db.SaveChangesAsync(ct);
    }
    public async Task<ServiceResult<CompletionState>> ReconcileAsync(ClaimsPrincipal actor,Guid id,Guid expected,CancellationToken ct=default)
    {
        var owned=await Owned(actor,id,ct);
        if(owned.Value==null)return ServiceResult<CompletionState>.Fail(owned.Failure,owned.Message ?? "Enrollment unavailable.",owned.Code);
        if(!await gate.IsEnabledAsync(ct))return ServiceResult<CompletionState>.Fail(ServiceFailure.Forbidden,"Completion mutations are disabled.","completion_disabled");
        return await Run(id,async()=>{
            var fresh=await Owned(actor,id,ct);
            if(fresh.Value==null)return ServiceResult<CompletionState>.Fail(fresh.Failure,fresh.Message ?? "Enrollment unavailable.",fresh.Code);
            if(!CourseVersionUpdates.IsCourseCompleted(fresh.Value)) {
                var current=await db.Courses.Where(x=>x.Id==fresh.Value.CourseId).Select(x=>x.PublishedVersionId).SingleAsync(ct);
                if(expected==Guid.Empty || expected!=current)return ServiceResult<CompletionState>.Fail(ServiceFailure.Conflict,"Publication changed.","publication_changed");
            }
            await StageAsync(id,ct);
            return ServiceResult<CompletionState>.Ok(await State(await db.Enrollments.SingleAsync(x=>x.Id==id,ct),ct));
        },ct);
    }
    private async Task<T> Run<T>(Guid id,Func<Task<T>> action,CancellationToken ct)
    {
        var target=await db.Enrollments.AsNoTracking().SingleAsync(x=>x.Id==id,ct);
        try { return await db.Database.CreateExecutionStrategy().ExecuteAsync(async()=>{
            db.ChangeTracker.Clear();
            await using var tx=await db.Database.BeginTransactionAsync(IsolationLevel.Serializable,ct);
            if(!await gate.IsEnabledAsync(ct))throw new InvalidOperationException("Isolated completion gate refused the target.");
            if(db.Database.IsSqlServer()) {
                var course=await db.Courses.FromSqlInterpolated($"SELECT * FROM [Courses] WITH (UPDLOCK,HOLDLOCK) WHERE [Id]={target.CourseId}").SingleAsync(ct);
                foreach(var uid in new[]{target.LearnerUserId,course.OwnerUserId}.Distinct().OrderBy(x=>x,StringComparer.Ordinal))
                    await db.Users.FromSqlInterpolated($"SELECT * FROM [AspNetUsers] WITH (UPDLOCK,HOLDLOCK) WHERE [Id]={uid}").SingleAsync(ct);
                await db.Enrollments.FromSqlInterpolated($"SELECT * FROM [Enrollments] WITH (UPDLOCK,HOLDLOCK) WHERE [Id]={id}").SingleAsync(ct);
            }
            var result=await action();await tx.CommitAsync(ct);return result;
        }); } finally {db.ChangeTracker.Clear();}
    }
    // Keyset scan starts from durable rows on every pass; no in-memory event is required for recovery.
    public async Task<int> RecoverAsync(CancellationToken ct=default, Action<Guid>? failed=null, Guid? courseId=null)
    {
        if(!await gate.IsEnabledAsync(ct))return 0;
        Guid? cursor=null;int processed=0;
        while(!ct.IsCancellationRequested) {
            var q=db.Enrollments.AsNoTracking().Where(x=>x.Status=="active"&&x.CompletedAt==null);
            if(courseId.HasValue)q=q.Where(x=>x.CourseId==courseId.Value);
            if(cursor.HasValue)q=q.Where(x=>x.Id.CompareTo(cursor.Value)>0);
            var ids=await q.OrderBy(x=>x.Id).Select(x=>x.Id).Take(50).ToListAsync(ct);
            if(ids.Count==0)break;
            foreach(var id in ids) {
                try {await Run(id,async()=>{await StageAsync(id,ct);return true;},ct);processed++;}
                catch(OperationCanceledException) when(ct.IsCancellationRequested) {throw;}
                catch(Exception) {if(failed==null)throw;failed(id);}
            }
            cursor=ids[^1];
        }
        return processed;
    }
}
