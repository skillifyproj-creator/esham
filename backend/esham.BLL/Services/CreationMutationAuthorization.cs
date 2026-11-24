using esham.BLL.DTOs;
using esham.DAL.Data;
using Microsoft.EntityFrameworkCore;
namespace esham.BLL.Services;

// Creation has no existing course root. These transaction-owned gates serialize
// absent-key creation/tree conversion work before actor and reference locks.
internal static class CreationMutationAuthorization
{
    internal const string Courses = "Esham.CourseCreation.v1";
    internal const string Categories = "Esham.CategoryTreeWrites.v1";

    internal static async Task SerializeAsync(AppDbContext db, string resource, CancellationToken ct)
    {
        if (!db.Database.IsSqlServer()) return;
        if (db.Database.CurrentTransaction is null)
            throw new InvalidOperationException("Mutation serialization requires its caller transaction.");
        await db.Database.ExecuteSqlInterpolatedAsync($"DECLARE @mutationLock int; EXEC @mutationLock = sys.sp_getapplock @Resource={resource}, @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=30000; IF @mutationLock < 0 THROW 51000, 'Mutation serialization lock unavailable.', 1;",ct);
    }

    internal static async Task<bool> CurrentAsync(AppDbContext db, CourseActor actor, string role, CancellationToken ct)
    {
        if (actor is null || string.IsNullOrWhiteSpace(actor.UserId)
            || role == "INSTRUCTOR" && !actor.IsInstructor
            || role == "GENERALADMIN" && !actor.IsGeneralAdmin) return false;
        var user = await (db.Database.IsSqlServer()
            ?db.Users.FromSqlInterpolated($"SELECT * FROM [AspNetUsers] WITH (UPDLOCK,HOLDLOCK) WHERE [Id]={actor.UserId}")
            :db.Users).SingleOrDefaultAsync(x=>x.Id==actor.UserId,ct);
        return user != null && !(user.LockoutEnabled && user.LockoutEnd > DateTimeOffset.UtcNow)
            &&await(from m in db.UserRoles join r in db.Roles on m.RoleId equals r.Id where m.UserId==actor.UserId&&r.NormalizedName==role select m).AnyAsync(ct);
    }
}
