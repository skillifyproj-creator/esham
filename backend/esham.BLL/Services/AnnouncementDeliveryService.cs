using System.Data;
using System.Security.Claims;
using esham.BLL.DTOs;
using esham.DAL.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
namespace esham.BLL.Services;
public sealed class AnnouncementDeliveryService(AppDbContext db,IPhase5MutationGate gate,IOptions<Phase5Options> options)
{
    public static Guid Notice(Guid id,DateTimeOffset published,string recipient)=>LearnerReviewService.Stable($"announcement:{id:D}:{published.UtcTicks}:{recipient}");
    public async Task<ServiceResult<object>> FeedAsync(ClaimsPrincipal actor,int page=1,int pageSize=20,Guid? id=null,CancellationToken ct=default){
        var a=await new ModerationAccess(db).ReadAsync(actor,ct);if(a==null)return ServiceResult<object>.Fail(ServiceFailure.Unauthenticated,"Sign in first.");
        if(!FinancialAccess.ValidPage(page,pageSize))return ServiceResult<object>.Fail(ServiceFailure.Validation,"Invalid page.");
        var q=db.Announcements.AsNoTracking().Where(x=>x.Status=="published"&&x.PublishedAt!=null&&(x.Audience=="all"||x.Audience=="learners"&&a.Learner||x.Audience=="instructors"&&a.Instructor)&&(!id.HasValue||x.Id==id));
        var rows=await q.OrderByDescending(x=>x.PublishedAt).ThenBy(x=>x.Id).Skip((page-1)*pageSize).Take(pageSize).Select(x=>new{x.Id,x.TitleAr,x.TitleEn,x.ContentAr,x.ContentEn,x.PublishedAt}).ToListAsync(ct);
        return id.HasValue&&rows.Count==0?ServiceResult<object>.Fail(ServiceFailure.NotFound,"Announcement not found."):ServiceResult<object>.Ok(new{AccountId=a.Id,Items=rows,Page=page,PageSize=pageSize,TotalCount=await q.CountAsync(ct)});
    }
    public async Task<int> RecoverAsync(CancellationToken ct=default,Action<Guid>? failed=null){
        if(!await gate.IsEnabledAsync(Phase5Capability.AnnouncementDelivery,ct))return 0;
        if(options.Value.AnnouncementIds.Length>100)throw new InvalidOperationException("Select at most 100 isolated synthetic announcement IDs.");
        var selected=options.Value.AnnouncementIds.Distinct().Where(x=>x!=Guid.Empty).Take(100).ToArray();var count=0;
        // Empty allowlist never means full catalog. Existing/historical announcements are never selected implicitly.
        foreach(var id in selected){string? cursor=null;
            while(true){ct.ThrowIfCancellationRequested();
                var q=db.Users.AsNoTracking();if(options.Value.AnnouncementRecipientIds.Length>0)q=q.Where(x=>options.Value.AnnouncementRecipientIds.Contains(x.Id));if(cursor!=null)q=q.Where(x=>string.Compare(x.Id,cursor)>0);
                var batch=await q.OrderBy(x=>x.Id).Select(x=>x.Id).Take(50).ToListAsync(ct);if(batch.Count==0)break;
                try{count+=await Deliver(id,batch,ct);}catch(OperationCanceledException)when(ct.IsCancellationRequested){throw;}catch(Exception){if(failed==null)throw;failed(id);}
                cursor=batch[^1];
            }
        }return count;
    }
    private async Task<int> Deliver(Guid id,List<string> recipients,CancellationToken ct){
        try{return await db.Database.CreateExecutionStrategy().ExecuteAsync(async()=>{
            db.ChangeTracker.Clear();await using var tx=await db.Database.BeginTransactionAsync(IsolationLevel.Serializable,ct);
            if(!options.Value.AnnouncementIds.Contains(id)||!await gate.IsEnabledAsync(Phase5Capability.AnnouncementDelivery,ct))return 0;
            var announcement=await (db.Database.IsSqlServer()?db.Announcements.FromSqlInterpolated($"SELECT * FROM [Announcements] WITH (UPDLOCK,HOLDLOCK) WHERE [Id]={id}"):db.Announcements).SingleOrDefaultAsync(x=>x.Id==id,ct);
            if(announcement?.Status!="published"||announcement.PublishedAt==null)return 0;
            var n=0;
            foreach(var recipient in recipients.OrderBy(x=>x,StringComparer.Ordinal)){
                var user=await (db.Database.IsSqlServer()?db.Users.FromSqlInterpolated($"SELECT * FROM [AspNetUsers] WITH (UPDLOCK,HOLDLOCK) WHERE [Id]={recipient}"):db.Users).SingleOrDefaultAsync(x=>x.Id==recipient,ct);
                if(user==null||user.LockoutEnabled&&user.LockoutEnd>DateTimeOffset.UtcNow)continue;
                var roles=await (from ur in db.UserRoles join r in db.Roles on ur.RoleId equals r.Id where ur.UserId==recipient select r.NormalizedName).ToListAsync(ct);
                if(announcement.Audience!="all"&&!(announcement.Audience=="learners"&&roles.Contains("LEARNER"))&&!(announcement.Audience=="instructors"&&roles.Contains("INSTRUCTOR")))continue;
                var notice=Notice(id,announcement.PublishedAt.Value,recipient);
                if(db.Database.IsSqlServer())await db.Notifications.FromSqlInterpolated($"SELECT * FROM [Notifications] WITH (UPDLOCK,HOLDLOCK) WHERE [Id]={notice}").ToListAsync(ct);
                // Full announcement bodies may be 10,000 characters; inbox is only a stable summary snapshot.
                if(await new NotificationWriter(db).StageAsync(new(notice,recipient,"announcement.published",announcement.TitleAr,announcement.TitleEn,"يوجد إعلان جديد متاح في حسابك.","A new announcement is available in your account."),ct))n++;
            }
            await db.SaveChangesAsync(ct);await tx.CommitAsync(ct);return n;
        });}finally{db.ChangeTracker.Clear();}
    }
}
