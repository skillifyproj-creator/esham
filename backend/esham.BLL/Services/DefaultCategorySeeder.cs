using System.Data;
using esham.DAL.Data;
using esham.DAL.Entities;
using Microsoft.EntityFrameworkCore;
namespace esham.BLL.Services;

public static class DefaultCategorySeeder
{
    public sealed record Definition(Guid Id, string Ar, string En, int Order);
    public static IReadOnlyList<Definition> Defaults { get; } = new[]
    {
        new Definition(Guid.Parse("e5a00001-0000-4000-8000-000000000001"), "البرمجة", "Programming", 1),
        new Definition(Guid.Parse("e5a00001-0000-4000-8000-000000000002"), "التصميم", "Design", 2),
        new Definition(Guid.Parse("e5a00001-0000-4000-8000-000000000003"), "التصوير", "Photography", 3),
        new Definition(Guid.Parse("e5a00001-0000-4000-8000-000000000004"), "التسويق", "Marketing", 4),
        new Definition(Guid.Parse("e5a00001-0000-4000-8000-000000000005"), "الحرف والفنون", "Crafts & Arts", 5),
        new Definition(Guid.Parse("e5a00001-0000-4000-8000-000000000006"), "الأعمال وتطوير الذات", "Business & Personal Development", 6),
    };
    internal static async Task LockAsync(AppDbContext db, CancellationToken ct)
    {
        if (db.Database.IsSqlServer())
            await db.Database.ExecuteSqlRawAsync("DECLARE @result int; EXEC @result = sys.sp_getapplock @Resource=N'Esham.DefaultCatalog.v1', @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=30000; IF @result < 0 THROW 51000, 'Could not acquire catalog initialization lock.', 1;", ct);
    }
    public static async Task<IReadOnlyDictionary<int, Guid>> SeedAsync(AppDbContext db, CancellationToken ct = default) =>
        await db.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
        {
            db.ChangeTracker.Clear();
            await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
            await LockAsync(db, ct);
            var existing = await db.Categories.ToListAsync(ct);
            var result = new Dictionary<int, Guid>();
            foreach (var item in Defaults)
            {
                var matches = existing.Where(x => x.Id == item.Id ||
                    x.ParentCategoryId == null && (string.Equals(x.NameEn.Trim(), item.En, StringComparison.OrdinalIgnoreCase) || x.NameAr.Trim() == item.Ar)).ToList();
                if (matches.Count > 1) throw new InvalidOperationException($"Default category '{item.En}' has ambiguous existing matches. No records were merged or deleted.");
                var category = matches.SingleOrDefault();
                if (category?.Id == item.Id && !string.Equals(category.NameEn.Trim(), item.En, StringComparison.OrdinalIgnoreCase) && category.NameAr.Trim() != item.Ar)
                    throw new InvalidOperationException("A reserved default category ID belongs to another category. No user-created category was renamed.");
                if (category is null)
                {
                    category = new Category { Id = item.Id, NameAr = item.Ar, NameEn = item.En, DisplayOrder = item.Order };
                    db.Categories.Add(category); existing.Add(category);
                }
                else if (category.NameAr != item.Ar || category.NameEn != item.En || !category.IsActive || category.DisplayOrder != item.Order)
                {
                    category.NameAr = item.Ar; category.NameEn = item.En; category.IsActive = true;
                    category.DisplayOrder = item.Order; category.UpdatedAt = DateTimeOffset.UtcNow;
                }
                result.Add(item.Order, category.Id);
            }
            await db.SaveChangesAsync(ct); await transaction.CommitAsync(ct);
            return (IReadOnlyDictionary<int, Guid>)result;
        });
}
