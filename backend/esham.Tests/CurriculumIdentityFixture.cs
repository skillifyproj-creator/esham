using esham.DAL.Data;
using esham.DAL.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
namespace esham.Tests;

// Older rule-test fixtures supplied only CourseActor booleans. Use real membership rows.
internal static class CurriculumIdentityFixture
{
    internal static Task EnsureInstructor(AppDbContext db, string id) => EnsureRole(db,id,"Instructor");
    internal static async Task EnsureRole(AppDbContext db, string id, string roleName)
    {
        if (!db.Database.IsInMemory()) throw new InvalidOperationException("InMemory fixture helper only.");
        if (!await db.Users.AnyAsync(x => x.Id == id)) db.Users.Add(new ApplicationUser { Id=id,UserName=id,SecurityStamp=Guid.NewGuid().ToString() });
        var normalized=roleName.ToUpperInvariant();
        var role = await db.Roles.SingleOrDefaultAsync(x=>x.NormalizedName==normalized);
        if(role is null){role=new IdentityRole(roleName){NormalizedName=normalized};db.Roles.Add(role);}
        if(!await db.UserRoles.AnyAsync(x=>x.UserId==id&&x.RoleId==role.Id))db.UserRoles.Add(new IdentityUserRole<string>{UserId=id,RoleId=role.Id});
        await db.SaveChangesAsync();
    }
}
