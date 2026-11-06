using esham.DAL.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
namespace esham.DAL.Data.Configurations;

internal static class CourseVersionUpdateConfiguration
{
    public static void Configure(ModelBuilder model)
    {
        var lesson = model.Entity<Lesson>();
        lesson.Property(x => x.LogicalLessonId).HasDefaultValueSql("NEWID()").Metadata.SetAfterSaveBehavior(PropertySaveBehavior.Throw);
        lesson.HasIndex(x => new { x.CourseSectionId, x.LogicalLessonId }).IsUnique();
        lesson.HasIndex(x => x.LogicalLessonId);
        var task = model.Entity<CourseTask>();
        task.Property(x => x.LogicalTaskId).HasDefaultValueSql("NEWID()").Metadata.SetAfterSaveBehavior(PropertySaveBehavior.Throw);
        task.HasIndex(x => new { x.CourseVersionId, x.LogicalTaskId }).IsUnique();
        task.HasIndex(x => x.LogicalTaskId);
        var enrollment = model.Entity<Enrollment>();
        enrollment.HasAlternateKey(x => new { x.Id, x.CourseId });
        enrollment.Property(x => x.CourseVersionId).Metadata.SetAfterSaveBehavior(PropertySaveBehavior.Throw);
        // A new version creates new achievement/attempt rows, never retargets old records.
        enrollment.Property(x => x.LearnerUserId).Metadata.SetAfterSaveBehavior(PropertySaveBehavior.Throw);
        model.Entity<LessonProgress>().Property(x => x.EnrollmentId).Metadata.SetAfterSaveBehavior(PropertySaveBehavior.Throw);
        model.Entity<LessonProgress>().Property(x => x.LessonId).Metadata.SetAfterSaveBehavior(PropertySaveBehavior.Throw);
        model.Entity<TaskSubmission>().Property(x => x.EnrollmentId).Metadata.SetAfterSaveBehavior(PropertySaveBehavior.Throw);
        model.Entity<TaskSubmission>().Property(x => x.CourseTaskId).Metadata.SetAfterSaveBehavior(PropertySaveBehavior.Throw);
        model.Entity<TaskSubmission>().Property(x => x.AttemptNumber).Metadata.SetAfterSaveBehavior(PropertySaveBehavior.Throw);
        model.Entity<TaskSubmission>().Property(x => x.IsOptionalAtCreation).Metadata.SetAfterSaveBehavior(PropertySaveBehavior.Throw);
        model.Entity<Certificate>().Property(x => x.EnrollmentId).Metadata.SetAfterSaveBehavior(PropertySaveBehavior.Throw);
        model.Entity<CourseReview>().Property(x => x.EnrollmentId).Metadata.SetAfterSaveBehavior(PropertySaveBehavior.Throw);
        var access = model.Entity<EnrollmentVersionAccess>();
        access.ToTable("EnrollmentVersionAccess", t => t.HasCheckConstraint("CK_EnrollmentVersionAccess_Reason", "[Reason] IN ('enrolled','publication','baseline')"));
        access.HasKey(x => x.Id);
        access.HasIndex(x => new { x.EnrollmentId, x.CourseVersionId }).IsUnique();
        access.HasIndex(x => new { x.CourseId, x.CourseVersionId });
        access.Property(x => x.Reason).HasMaxLength(32).IsRequired();
        access.HasOne(x => x.Enrollment).WithMany().HasForeignKey(x => new { x.EnrollmentId, x.CourseId })
            .HasPrincipalKey(x => new { x.Id, x.CourseId }).OnDelete(DeleteBehavior.NoAction);
        access.HasOne(x => x.CourseVersion).WithMany().HasForeignKey(x => new { x.CourseId, x.CourseVersionId })
            .HasPrincipalKey(x => new { x.CourseId, x.Id }).OnDelete(DeleteBehavior.NoAction);
        access.HasOne(x => x.PreviousCourseVersion).WithMany().HasForeignKey(x => new { x.CourseId, x.PreviousCourseVersionId })
            .HasPrincipalKey(x => new { x.CourseId, x.Id }).OnDelete(DeleteBehavior.NoAction);
        foreach (var property in access.Metadata.GetProperties()) property.SetAfterSaveBehavior(PropertySaveBehavior.Throw);
        model.Entity<Certificate>().HasOne<CourseVersion>().WithMany().HasForeignKey(x => x.CourseVersionId).OnDelete(DeleteBehavior.NoAction);
        model.Entity<Certificate>().Property(x => x.CourseVersionId).Metadata.SetAfterSaveBehavior(PropertySaveBehavior.Throw);
        model.Entity<CourseReview>().HasOne<CourseVersion>().WithMany().HasForeignKey(x => x.CourseVersionId).OnDelete(DeleteBehavior.NoAction);
        model.Entity<CourseReview>().Property(x => x.CourseVersionId).Metadata.SetAfterSaveBehavior(PropertySaveBehavior.Throw);
    }
}
