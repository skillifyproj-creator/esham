using esham.DAL.Data;
using esham.DAL.Entities;
namespace esham.BLL.Services;

// Exact identities verified against the two historical review-verification fixtures.
// See docs/public-categories-course-details.md. Never infer visibility from a name.
public static class EducationalCategories
{
    internal static readonly Guid[] ConfirmedFixtureIds = [
        Guid.Parse("e13348fe-e351-4ff2-95de-f2c67e5dc53c"),
        Guid.Parse("2d66aa09-8eed-45bf-b244-475a12194dac"),
        Guid.Parse("714e3f73-8302-45cf-a75f-fa0c0f21d0aa"),
        Guid.Parse("be9caba1-86cc-4d55-97c5-cbac48dfdd02")];
    public static IQueryable<Category> Visible(AppDbContext db) => db.Categories
        .Where(x => x.IsActive && !ConfirmedFixtureIds.Contains(x.Id));
}
