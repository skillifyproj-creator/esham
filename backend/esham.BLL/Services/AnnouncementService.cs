using System.Data;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using esham.BLL.DTOs;
using esham.BLL.DTOs.Moderation;
using esham.DAL.Data;
using esham.DAL.Entities;
using Microsoft.EntityFrameworkCore;
namespace esham.BLL.Services;

public sealed class AnnouncementService(AppDbContext db)
{
    private readonly ModerationAccess access=new(db);
    private static string Version(Announcement a)=>Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(new {a.TitleAr,a.TitleEn,a.ContentAr,a.ContentEn,a.Audience,a.Status,a.PublishedAt}))));
    private static AnnouncementDto Map(Announcement a)=>new(a.Id,a.TitleAr,a.TitleEn,a.ContentAr,a.ContentEn,a.Audience,a.Status,a.CreatedAt,a.PublishedAt,Version(a));
    private static ServiceResult<T> Fail<T>(ServiceFailure f,string m)=>ServiceResult<T>.Fail(f,m);
    public async Task<ServiceResult<List<AnnouncementDto>>> ListAsync(ClaimsPrincipal principal,bool administrative,CancellationToken ct=default)
    {
        var actor=await access.ReadAsync(principal,ct);
        if(administrative&&(actor==null||!actor.General))return Fail<List<AnnouncementDto>>(actor==null?ServiceFailure.Unauthenticated:ServiceFailure.Forbidden,"GeneralAdmin membership is required.");
        var q=db.Announcements.AsNoTracking();
        if(!administrative)q=q.Where(x=>x.Status=="published"&&x.PublishedAt!=null&&(x.Audience=="all"||actor!=null&&actor.Learner&&x.Audience=="learners"||actor!=null&&actor.Instructor&&x.Audience=="instructors"));
        return ServiceResult<List<AnnouncementDto>>.Ok((await q.OrderByDescending(x=>x.PublishedAt??x.CreatedAt).ThenBy(x=>x.Id).Take(200).ToListAsync(ct)).Select(Map).ToList());
    }
    public Task<ServiceResult<AnnouncementDto>> SaveAsync(ClaimsPrincipal principal,Guid? id,AnnouncementInput input,CancellationToken ct=default)=>Change(principal,id,async (actor,a)=>
    {
        if(input.Audience is not ("all" or "learners" or "instructors")||input.TitleAr?.Length>200||input.TitleEn?.Length>200||input.ContentAr?.Length>10000||input.ContentEn?.Length>10000
            ||string.IsNullOrWhiteSpace(input.TitleAr)&&string.IsNullOrWhiteSpace(input.TitleEn)||string.IsNullOrWhiteSpace(input.ContentAr)&&string.IsNullOrWhiteSpace(input.ContentEn))
            return Fail<AnnouncementDto>(ServiceFailure.Validation,"Provide a title, content and supported audience within the field limits.");
        if(id!=null&&(a!.Status!="draft"||input.ExpectedVersion!=Version(a)))return Fail<AnnouncementDto>(ServiceFailure.Conflict,"Reload the announcement; only its current draft can be edited.");
        a??=new Announcement{AuthorUserId=actor.Id};if(id==null)db.Announcements.Add(a);
        a.TitleAr=input.TitleAr?.Trim();a.TitleEn=input.TitleEn?.Trim();a.ContentAr=input.ContentAr?.Trim();a.ContentEn=input.ContentEn?.Trim();a.Audience=input.Audience;
        Log(actor,a,id==null?"announcement.created":"announcement.updated",null,a.Status);await Task.CompletedTask;
        return ServiceResult<AnnouncementDto>.Ok(Map(a));
    },ct);
    public Task<ServiceResult<AnnouncementDto>> SetStatusAsync(ClaimsPrincipal principal,Guid id,AnnouncementStateRequest input,CancellationToken ct=default)=>Change(principal,id,async(actor,a)=>
    {
        if(input.Status is not ("draft" or "published" or "archived"))return Fail<AnnouncementDto>(ServiceFailure.Validation,"Choose draft, published or archived.");
        if(input.ExpectedVersion!=Version(a!))return Fail<AnnouncementDto>(ServiceFailure.Conflict,"Announcement changed. Reload before retrying.");
        if(a!.Status=="archived")return Fail<AnnouncementDto>(ServiceFailure.Conflict,"Archived announcements are retained and cannot be republished.");
        if(a.Status==input.Status)return ServiceResult<AnnouncementDto>.Ok(Map(a));
        var old=a.Status;a.Status=input.Status;if(input.Status=="published")a.PublishedAt=DateTimeOffset.UtcNow;
        Log(actor,a,"announcement."+input.Status,old,a.Status);await Task.CompletedTask;return ServiceResult<AnnouncementDto>.Ok(Map(a));
    },ct);
    private void Log(PlatformActor actor,Announcement a,string action,string? previous,string next)=>db.AdminActivityLogs.Add(new(){ActorUserId=actor.Id,Action=action,TargetType="Announcement",TargetId=a.Id.ToString(),TargetName=a.TitleEn??a.TitleAr,PreviousState=previous,NewState=next});
    private async Task<ServiceResult<AnnouncementDto>> Change(ClaimsPrincipal principal,Guid? id,Func<PlatformActor,Announcement?,Task<ServiceResult<AnnouncementDto>>> action,CancellationToken ct)
    {
        try{return await db.Database.CreateExecutionStrategy().ExecuteAsync(async()=>
        {
            db.ChangeTracker.Clear();await using var tx=await db.Database.BeginTransactionAsync(IsolationLevel.Serializable,ct);
            var actor=await access.ReadAsync(principal,ct);if(actor==null||!actor.General)return Fail<AnnouncementDto>(actor==null?ServiceFailure.Unauthenticated:ServiceFailure.Forbidden,"GeneralAdmin membership is required.");
            Announcement? a=null;if(id!=null){a=await (db.Database.IsSqlServer()?db.Announcements.FromSqlInterpolated($"SELECT * FROM [Announcements] WITH (UPDLOCK,HOLDLOCK) WHERE [Id]={id.Value}"):db.Announcements.AsQueryable()).SingleOrDefaultAsync(x=>x.Id==id,ct);if(a==null)return Fail<AnnouncementDto>(ServiceFailure.NotFound,"Announcement not found.");}
            var result=await action(actor,a);if(result.Failure!=ServiceFailure.None)return result;await db.SaveChangesAsync(ct);await tx.CommitAsync(ct);return result;
        });}finally{db.ChangeTracker.Clear();}
    }
}
