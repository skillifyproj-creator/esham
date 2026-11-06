using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using esham.DAL.Data;
using esham.DAL.Entities;
using Microsoft.EntityFrameworkCore;
namespace esham.BLL.Services;

internal sealed record PlatformActor(string Id,bool General,bool Category,bool Instructor,bool Learner);
internal sealed class ModerationAccess(AppDbContext db)
{
    public async Task<PlatformActor?> ReadAsync(ClaimsPrincipal principal,CancellationToken ct)
    {
        if(principal.Identity?.IsAuthenticated!=true)return null;
        var id=principal.FindFirstValue(ClaimTypes.NameIdentifier);
        var user=await db.Users.AsNoTracking().SingleOrDefaultAsync(x=>x.Id==id,ct);
        if(user==null||user.LockoutEnabled&&user.LockoutEnd>DateTimeOffset.UtcNow)return null;
        var roles=await (from m in db.UserRoles join r in db.Roles on m.RoleId equals r.Id where m.UserId==user.Id select r.NormalizedName).ToListAsync(ct);
        return new(user.Id,roles.Contains("GENERALADMIN"),roles.Contains("CATEGORYADMIN"),roles.Contains("INSTRUCTOR"),roles.Contains("LEARNER"));
    }
    public Task<bool> AssignedAsync(PlatformActor actor,Guid category,CancellationToken ct)=>db.CategoryAdminAssignments.AnyAsync(x=>x.UserId==actor.Id&&x.CategoryId==category&&x.IsActive,ct);
    public async Task<bool> CanModerateAsync(PlatformActor actor,Course course,CourseVersion version,CancellationToken ct)=>
        actor.Id!=course.OwnerUserId&&(actor.General||actor.Category&&version.ReviewStatus!="draft"&&await AssignedAsync(actor,version.CategoryId,ct));
    public static Guid NoticeId(string kind,Guid id,string recipient)=>new(SHA256.HashData(Encoding.UTF8.GetBytes($"esham:{kind}:v1:{id:D}:{recipient}")).AsSpan(0,16));
}
