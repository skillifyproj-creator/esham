using esham.DAL.Data.Configurations;
using esham.DAL.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;

namespace esham.DAL.Data;

public sealed class AppDbContext : IdentityDbContext<ApplicationUser>
{
    public AppDbContext(DbContextOptions<AppDbContext> options)
        : base(options)
    {
    }

    public DbSet<Category> Categories => Set<Category>();
    public DbSet<CategoryAdminAssignment> CategoryAdminAssignments => Set<CategoryAdminAssignment>();
    public DbSet<Course> Courses => Set<Course>();
    public DbSet<CourseVersion> CourseVersions => Set<CourseVersion>();
    public DbSet<CourseSection> CourseSections => Set<CourseSection>();
    public DbSet<Lesson> Lessons => Set<Lesson>();
    public DbSet<CourseTask> CourseTasks => Set<CourseTask>();
    public DbSet<MediaAsset> MediaAssets => Set<MediaAsset>();
    public DbSet<LessonAttachment> LessonAttachments => Set<LessonAttachment>();
    public DbSet<TaskAttachment> TaskAttachments => Set<TaskAttachment>();
    public DbSet<ScreeningResult> ScreeningResults => Set<ScreeningResult>();

    public DbSet<UserCategory> UserCategories => Set<UserCategory>();
    public DbSet<Enrollment> Enrollments => Set<Enrollment>();
    public DbSet<EnrollmentVersionAccess> EnrollmentVersionAccess => Set<EnrollmentVersionAccess>();
    public DbSet<Wallet> Wallets => Set<Wallet>();
    public DbSet<PointTransaction> PointTransactions => Set<PointTransaction>();
    public DbSet<LessonProgress> LessonProgressRecords => Set<LessonProgress>();
    public DbSet<TaskSubmission> TaskSubmissions => Set<TaskSubmission>();
    public DbSet<SubmissionAttachment> SubmissionAttachments => Set<SubmissionAttachment>();
    public DbSet<TaskSubmissionReview> TaskSubmissionReviews => Set<TaskSubmissionReview>();
    public DbSet<CourseReview> CourseReviews => Set<CourseReview>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<Certificate> Certificates => Set<Certificate>();

    public DbSet<CourseReviewDecision> CourseReviewDecisions => Set<CourseReviewDecision>();
    public DbSet<Announcement> Announcements => Set<Announcement>();
    public DbSet<CourseReport> CourseReports => Set<CourseReport>();
    public DbSet<CourseWarning> CourseWarnings => Set<CourseWarning>();
    public DbSet<CourseAppeal> CourseAppeals => Set<CourseAppeal>();
    public DbSet<AdminActivityLog> AdminActivityLogs => Set<AdminActivityLog>();

    private void ProtectCompletionHistory()
    {
        ChangeTracker.DetectChanges();
        if(ChangeTracker.Entries<Certificate>().Any(x=>x.State==EntityState.Deleted))
            throw new InvalidOperationException("Certificates are retained; use audited revocation.");
        foreach(var entry in ChangeTracker.Entries<Certificate>().Where(x=>x.State==EntityState.Modified)) {
            var status=entry.Property(x=>x.Status);
            if(status.IsModified && status.CurrentValue!=status.OriginalValue && !(status.OriginalValue=="issued" && status.CurrentValue=="revoked"))
                throw new InvalidOperationException("Certificate revocation is terminal.");
        }
        foreach(var entry in ChangeTracker.Entries<Enrollment>().Where(x=>x.State==EntityState.Modified)) {
            var date=entry.Property(x=>x.CompletedAt);
            if(date.OriginalValue!=null && date.CurrentValue!=date.OriginalValue)
                throw new InvalidOperationException("The first completion timestamp is immutable.");
            if(entry.Property(x=>x.Status).IsModified && (entry.Property(x=>x.Status).OriginalValue=="completed" || date.OriginalValue!=null) && entry.Entity.Status!="completed")
                throw new InvalidOperationException("Completed enrollments cannot be reopened.");
        }
    }
    public override int SaveChanges(bool acceptAllChangesOnSuccess) {ProtectCompletionHistory();return base.SaveChanges(acceptAllChangesOnSuccess);}
    public override Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess,CancellationToken cancellationToken=default) {
        ProtectCompletionHistory();return base.SaveChangesAsync(acceptAllChangesOnSuccess,cancellationToken);
    }
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        ContentModelConfiguration.Configure(modelBuilder);
        LearningModelConfiguration.Configure(modelBuilder);
        CourseVersionUpdateConfiguration.Configure(modelBuilder);
        ModerationModelConfiguration.Configure(modelBuilder);
    }
}
