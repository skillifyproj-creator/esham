using System.Data;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using esham.BLL.DTOs;
using esham.DAL.Data;
using esham.DAL.Entities;
using Microsoft.EntityFrameworkCore;
namespace esham.BLL.Services;

public sealed record AssignmentInput(string[]? UserIds,string? ExpectedVersion);
public sealed record AssignmentState(string[] UserIds,string Version);
public sealed class AdminIntegrationService(AppDbContext db)
{
    private readonly ModerationAccess access=new(db);
    private static ServiceResult<object> Fail(ServiceFailure f,string m)=>ServiceResult<object>.Fail(f,m);
    private static string Version(IEnumerable<CategoryAdminAssignment> rows)=>Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(string.Join("|",rows.OrderBy(x=>x.Id).Select(x=>$"{x.Id}:{x.UserId}:{x.IsActive}:{x.AssignedAt:O}")))));
    private static AssignmentState State(IEnumerable<CategoryAdminAssignment> rows)=>new(rows.Where(x=>x.IsActive).Select(x=>x.UserId).Order().ToArray(),Version(rows));
    private async Task<ServiceFailure> General(ClaimsPrincipal principal,CancellationToken ct){var a=await access.ReadAsync(principal,ct);return a==null?ServiceFailure.Unauthenticated:a.General?ServiceFailure.None:ServiceFailure.Forbidden;}
    public async Task<ServiceResult<object>> Overview(ClaimsPrincipal principal,CancellationToken ct=default)
    {
        var denied=await General(principal,ct);if(denied!=ServiceFailure.None)return Fail(denied,"GeneralAdmin membership required.");
        // Exactly one projection per course, including unsubmitted drafts; historical versions never inflate counts.
        var rows=await db.Courses.AsNoTracking().Select(x=>new{x.Id,x.PublishedVersionId,PublishedStatus=x.PublishedVersion==null?null:x.PublishedVersion.ReviewStatus,DraftStatus=x.DraftVersion==null?null:x.DraftVersion.ReviewStatus,CategoryId=x.PublishedVersion!=null?(Guid?)x.PublishedVersion.CategoryId:x.DraftVersion!=null?(Guid?)x.DraftVersion.CategoryId:null}).ToListAsync(ct);
        string Status(string? published,string? draft)=>published=="approved"?"published":draft??"draft";
        var statuses=new[]{"published","pending","rejected","changes_requested","approved","draft"}.ToDictionary(x=>x,x=>rows.Count(c=>Status(c.PublishedStatus,c.DraftStatus)==x));
        return ServiceResult<object>.Ok(new{TotalCourses=rows.Count,PendingReviewCourses=rows.Count(x=>x.DraftStatus=="pending"),StatusCounts=statuses,UncategorizedCourses=rows.Count(x=>x.CategoryId==null),TotalCategories=await db.Categories.CountAsync(ct),TotalEnrollments=await db.Enrollments.CountAsync(ct),TotalLearners=await db.Enrollments.Select(x=>x.LearnerUserId).Distinct().CountAsync(ct)});
    }
    public async Task<ServiceResult<object>> Categories(ClaimsPrincipal principal,CancellationToken ct=default)
    {
        var a=await access.ReadAsync(principal,ct);if(a==null)return Fail(ServiceFailure.Unauthenticated,"Sign in first.");if(!a.General&&!a.Category)return Fail(ServiceFailure.Forbidden,"Administrator membership required.");
        var q=db.Categories.AsNoTracking();if(!a.General)q=q.Where(x=>db.CategoryAdminAssignments.Any(y=>y.UserId==a.Id&&y.CategoryId==x.Id&&y.IsActive));
        var rows=await q.OrderBy(x=>x.DisplayOrder).ThenBy(x=>x.Id).Select(x=>new{x.Id,x.NameAr,x.NameEn,x.DescriptionAr,x.DescriptionEn,x.ParentCategoryId,x.DisplayOrder,x.IsActive,
            CourseCount=db.Courses.Count(c=>(c.PublishedVersion!=null?c.PublishedVersion.CategoryId:c.DraftVersion!=null?c.DraftVersion.CategoryId:Guid.Empty)==x.Id),
            LearnerCount=db.Enrollments.Where(e=>(e.Course.PublishedVersion!=null?e.Course.PublishedVersion.CategoryId:e.Course.DraftVersion!=null?e.Course.DraftVersion.CategoryId:Guid.Empty)==x.Id).Select(e=>e.LearnerUserId).Distinct().Count(),
            AdminIds=db.CategoryAdminAssignments.Where(y=>y.CategoryId==x.Id&&y.IsActive&&db.UserRoles.Any(m=>m.UserId==y.UserId&&db.Roles.Any(r=>r.Id==m.RoleId&&r.NormalizedName=="CATEGORYADMIN"))).Select(y=>y.UserId).ToArray()}).ToListAsync(ct);
        return ServiceResult<object>.Ok(rows);
    }
    public async Task<ServiceResult<object>> Administrators(ClaimsPrincipal principal,CancellationToken ct=default)
    {
        var denied=await General(principal,ct);if(denied!=ServiceFailure.None)return Fail(denied,"GeneralAdmin membership required.");
        var rows=await db.Users.AsNoTracking().Where(u=>db.UserRoles.Any(m=>m.UserId==u.Id&&db.Roles.Any(r=>r.Id==m.RoleId&&r.NormalizedName=="CATEGORYADMIN"))).OrderBy(x=>x.Id).Select(x=>new{x.Id,x.Name,x.NameEn,x.Email,IsLockedOut=x.LockoutEnabled&&x.LockoutEnd>DateTimeOffset.UtcNow}).ToListAsync(ct);
        return ServiceResult<object>.Ok(rows);
    }
    public async Task<ServiceResult<object>> Assignments(Guid categoryId,ClaimsPrincipal principal,CancellationToken ct=default)
    {
        var denied=await General(principal,ct);if(denied!=ServiceFailure.None)return Fail(denied,"GeneralAdmin membership required.");
        if(!await db.Categories.AnyAsync(x=>x.Id==categoryId,ct))return Fail(ServiceFailure.NotFound,"Category not found.");
        return ServiceResult<object>.Ok(State(await db.CategoryAdminAssignments.AsNoTracking().Where(x=>x.CategoryId==categoryId).ToListAsync(ct)));
    }
    public async Task<ServiceResult<object>> SetAssignments(Guid categoryId,ClaimsPrincipal principal,AssignmentInput input,CancellationToken ct=default)
    {
        if(input.UserIds==null||input.UserIds.Length>100||input.UserIds.Any(string.IsNullOrWhiteSpace)||input.UserIds.Distinct().Count()!=input.UserIds.Length||input.ExpectedVersion?.Length!=64)return Fail(ServiceFailure.Validation,"Provide unique administrator IDs and the current assignment version.");
        try{return await db.Database.CreateExecutionStrategy().ExecuteAsync(async()=>{
            db.ChangeTracker.Clear();await using var tx=await db.Database.BeginTransactionAsync(IsolationLevel.Serializable,ct);
            var actor=await access.ReadAsync(principal,ct);if(actor==null)return Fail(ServiceFailure.Unauthenticated,"Sign in first.");if(!actor.General)return Fail(ServiceFailure.Forbidden,"Only GeneralAdmin may manage category assignments.");
            var category=await (db.Database.IsSqlServer()?db.Categories.FromSqlInterpolated($"SELECT * FROM [Categories] WITH (UPDLOCK,HOLDLOCK) WHERE [Id]={categoryId}"):db.Categories).SingleOrDefaultAsync(x=>x.Id==categoryId,ct);
            if(category==null)return Fail(ServiceFailure.NotFound,"Category not found.");
            var rows=await db.CategoryAdminAssignments.Where(x=>x.CategoryId==categoryId).ToListAsync(ct);
            if(Version(rows)!=input.ExpectedVersion)return Fail(ServiceFailure.Conflict,"Assignments changed. Reload before saving.");
            var eligible=await db.UserRoles.Where(m=>input.UserIds.Contains(m.UserId)&&db.Roles.Any(r=>r.Id==m.RoleId&&r.NormalizedName=="CATEGORYADMIN")).Select(x=>x.UserId).Distinct().ToListAsync(ct);
            if(eligible.Count!=input.UserIds.Length)return Fail(ServiceFailure.Validation,"Every selected account must already have CategoryAdmin membership. No account roles are granted here.");
            var previous=State(rows).UserIds;
            foreach(var row in rows)row.IsActive=input.UserIds.Contains(row.UserId);
            foreach(var id in input.UserIds.Where(id=>!rows.Any(x=>x.UserId==id))){var row=new CategoryAdminAssignment{UserId=id,CategoryId=categoryId};db.CategoryAdminAssignments.Add(row);rows.Add(row);}
            if(!previous.SequenceEqual(input.UserIds.Order()))db.AdminActivityLogs.Add(new(){ActorUserId=actor.Id,Action="category.assignments.updated",TargetType="Category",TargetId=category.Id.ToString(),TargetName=category.NameEn,CategoryId=category.Id,PreviousState=string.Join(",",previous),NewState=string.Join(",",input.UserIds.Order())});
            await db.SaveChangesAsync(ct);await tx.CommitAsync(ct);return ServiceResult<object>.Ok(State(rows));
        });}finally{db.ChangeTracker.Clear();}
    }
}
