using System.Data;
using esham.DAL.Data;
using esham.DAL.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
namespace esham.BLL.Services;

// Explicit development/demo initialization. Never runs in Production via startup.
public static class DemoCourseSeeder
{
    public const string OwnerId = "e5a00002-0000-4000-8000-000000000001";
    public const string OwnerEmail = "catalog-demo@seed.esham.invalid";
    public static readonly (string Ar, string En)[] Titles =
    [
        ("أساسيات البرمجة", "Programming Basics"), ("مقدمة في تطوير الويب", "Introduction to Web Development"),
        ("أساسيات التصميم", "Design Fundamentals"), ("مقدمة في تصميم واجهات المستخدم", "Introduction to UI Design"),
        ("أساسيات التصوير", "Photography Basics"), ("تصوير المنتجات", "Product Photography"),
        ("أساسيات التسويق الرقمي", "Digital Marketing Basics"), ("صناعة المحتوى", "Content Creation"),
        ("أساسيات الرسم", "Drawing Basics"), ("الحرف اليدوية للمبتدئين", "Handmade Crafts for Beginners"),
        ("إدارة الوقت", "Time Management"), ("مهارات التواصل", "Communication Skills"),
    ];
    public static Guid Id(int kind, int index) => Guid.Parse($"e5a0000{kind}-0000-4000-8000-{index + 1:000000000000}");
    public static async Task SeedAsync(AppDbContext db, UserManager<ApplicationUser> users, RoleManager<IdentityRole> roles,
        IReadOnlyDictionary<int, Guid> categories, CancellationToken ct = default)
    {
        await db.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
        {
            db.ChangeTracker.Clear();
            await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
            await DefaultCategorySeeder.LockAsync(db, ct);
            var owner = await users.FindByIdAsync(OwnerId);
            if (owner is null)
            {
                if (await users.FindByEmailAsync(OwnerEmail) != null || await users.FindByNameAsync("esham_catalog_demo") != null)
                    throw new InvalidOperationException("The reserved demo owner identity is already in use. No real account was modified.");
                if (!await roles.RoleExistsAsync("Instructor")) throw new InvalidOperationException("Provision the Instructor role before demo initialization.");
                owner = new ApplicationUser { Id = OwnerId, UserName = "esham_catalog_demo", Email = OwnerEmail,
                    Name = "مدرّب الكتالوج التجريبي", NameEn = "Esham Demo Instructor", Role = "instructor",
                    Goal = 0, LockoutEnabled = true, LockoutEnd = DateTimeOffset.MaxValue };
                Require(await users.CreateAsync(owner)); // No password: this is not an interactive login account.
                Require(await users.AddToRoleAsync(owner, "Instructor"));
            }
            else if (owner.Email != OwnerEmail || owner.UserName != "esham_catalog_demo" || owner.PasswordHash != null)
                throw new InvalidOperationException("Reserved demo owner differs from the designated seed identity. Initialization stopped.");
            for (var i = 0; i < Titles.Length; i++)
            {
                var courseId = Id(3, i); var versionId = Id(4, i);
                var existing = await db.Courses.SingleOrDefaultAsync(x => x.Id == courseId, ct);
                if (existing != null)
                {
                    if (existing.OwnerUserId != OwnerId) throw new InvalidOperationException("A reserved demo course ID is owned by another account.");
                    continue; // Never overwrite edits or immutable publication content on subsequent startups.
                }
                var now = DateTimeOffset.UtcNow; var title = Titles[i];
                var course = new Course { Id = courseId, OwnerUserId = OwnerId, EnrollmentPaused = true, CreatedAt = now, UpdatedAt = now };
                db.Courses.Add(course); await db.SaveChangesAsync(ct);
                var version = new CourseVersion { Id = versionId, CourseId = courseId, CategoryId = categories[i / 2 + 1],
                    VersionNumber = 1, TitleAr = $"[تجريبي] {title.Ar}", TitleEn = $"[Demo] {title.En}",
                    DescriptionAr = $"دورة تجريبية تعليمية: {title.Ar}. محتوى نموذجي لاستكشاف منصة إسهام، وليست عرضًا تدريبيًا حقيقيًا.",
                    DescriptionEn = $"A demonstration course covering {title.En}. Sample learning content for exploring Esham; not a real training offering.",
                    Language = "ar", Level = "beginner", ReviewStatus = CourseReviewStatuses.Approved,
                    Objectives = [new("تطبيق المفاهيم الأساسية في مثال عملي.", "Apply the basic concepts in a practical example.")],
                    CreatedAt = now, UpdatedAt = now, SubmittedAt = now, ApprovedAt = now };
                db.CourseVersions.Add(version); await db.SaveChangesAsync(ct);
                var section = new CourseSection { Id = Id(5, i), CourseVersionId = versionId, TitleAr = "البداية", TitleEn = "Getting started" };
                db.CourseSections.Add(section);
                db.Lessons.Add(new Lesson { Id = Id(6, i), CourseSectionId = section.Id, TitleAr = "مقدمة تطبيقية", TitleEn = "Practical introduction",
                    ContentType = "article", DescriptionAr = version.DescriptionAr, DescriptionEn = version.DescriptionEn, DurationSeconds = 600,
                    Objectives = version.Objectives.ToList() });
                db.CourseTasks.Add(new CourseTask { Id = Id(7, i), CourseVersionId = versionId, DisplaySectionId = section.Id,
                    TitleAr = "تطبيق عملي تجريبي", TitleEn = "Demo practical exercise", DescriptionAr = "طبّق المفاهيم في مثال بسيط.", DescriptionEn = "Apply the concepts to a simple example.",
                    Instructions = new("حضّر المثال واشرح خطواتك.", "Prepare an example and explain your steps."), Requirements = [new("وضوح المثال", "A clear example")], IsReady = true });
                course.PublishedVersionId = versionId;
                await db.SaveChangesAsync(ct);
            }
            await transaction.CommitAsync(ct);
        });
    }
    private static void Require(IdentityResult result)
    {
        if (!result.Succeeded) throw new InvalidOperationException(string.Join("; ", result.Errors.Select(x => x.Description)));
    }
}
