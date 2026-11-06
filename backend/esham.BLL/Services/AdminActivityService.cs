using System.Security.Claims;
using esham.BLL.DTOs;
using esham.BLL.DTOs.Moderation;
using esham.DAL.Data;
using Microsoft.EntityFrameworkCore;
namespace esham.BLL.Services;

public sealed class AdminActivityService(AppDbContext db)
{
    public async Task<ServiceResult<List<AdminActivityDto>>> ListAsync(ClaimsPrincipal principal,CancellationToken ct=default)
    {
        var actor=await new ModerationAccess(db).ReadAsync(principal,ct);
        if(actor==null)return ServiceResult<List<AdminActivityDto>>.Fail(ServiceFailure.Unauthenticated,"Sign in first.");
        if(!actor.General&&!actor.Category)return ServiceResult<List<AdminActivityDto>>.Fail(ServiceFailure.Forbidden,"Administrator membership is required.");
        var q=db.AdminActivityLogs.AsNoTracking();
        if(!actor.General)q=q.Where(x=>x.CategoryId!=null&&db.CategoryAdminAssignments.Any(a=>a.UserId==actor.Id&&a.CategoryId==x.CategoryId&&a.IsActive));
        return ServiceResult<List<AdminActivityDto>>.Ok(await q.OrderByDescending(x=>x.CreatedAt).ThenBy(x=>x.Id).Take(200)
          .Select(x=>new AdminActivityDto(x.Id,x.ActorUserId,x.ActorUser.Name??x.ActorUser.UserName??"",x.Action,x.TargetType,x.TargetId,x.TargetName,x.CourseId,x.CourseVersionId,x.CategoryId,x.PreviousState,x.NewState,x.Details,x.CreatedAt)).ToListAsync(ct));
    }
}
