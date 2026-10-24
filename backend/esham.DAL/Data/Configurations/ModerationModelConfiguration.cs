using esham.DAL.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;

namespace esham.DAL.Data.Configurations;

internal static class ModerationModelConfiguration
{
    public static void Configure(ModelBuilder modelBuilder)
    {
        var decision = modelBuilder.Entity<CourseReviewDecision>();
        decision.ToTable("CourseReviewDecisions", table => table.HasCheckConstraint(
            "CK_CourseReviewDecisions_Decision", "[Decision] IN ('approved', 'rejected', 'changes_requested')"));
        decision.HasKey(x => x.Id);
        decision.Property(x => x.ReviewerUserId).HasMaxLength(450).IsRequired();
        decision.Property(x => x.Decision).HasMaxLength(32).IsRequired();
        decision.Property(x => x.Comment).HasMaxLength(4000);
        decision.HasIndex(x => new { x.CourseVersionId, x.ReviewedAt });
        decision.HasOne(x => x.CourseVersion).WithMany().HasForeignKey(x => x.CourseVersionId)
            .OnDelete(DeleteBehavior.NoAction);
        decision.HasOne(x => x.ReviewerUser).WithMany().HasForeignKey(x => x.ReviewerUserId)
            .OnDelete(DeleteBehavior.NoAction);
        foreach (var property in decision.Metadata.GetProperties())
            property.SetAfterSaveBehavior(PropertySaveBehavior.Throw);

        var announcement = modelBuilder.Entity<Announcement>();
        announcement.ToTable("Announcements");
        announcement.HasKey(x => x.Id);
        announcement.Property(x => x.AuthorUserId).HasMaxLength(450).IsRequired();
        announcement.Property(x => x.TitleAr).HasMaxLength(200);
        announcement.Property(x => x.TitleEn).HasMaxLength(200);
        announcement.Property(x => x.ContentAr).HasMaxLength(10000);
        announcement.Property(x => x.ContentEn).HasMaxLength(10000);
        announcement.Property(x => x.Audience).HasMaxLength(32).IsRequired();
        announcement.Property(x => x.Status).HasMaxLength(32).IsRequired();
        announcement.HasIndex(x => new { x.Status, x.PublishedAt });
        announcement.HasOne(x => x.AuthorUser).WithMany().HasForeignKey(x => x.AuthorUserId)
            .OnDelete(DeleteBehavior.NoAction);

        var report = modelBuilder.Entity<CourseReport>();
        report.ToTable("CourseReports");
        report.HasKey(x => x.Id);
        report.HasAlternateKey(x => new { x.CourseId, x.CourseVersionId, x.Id });
        report.Property(x => x.ReporterUserId).HasMaxLength(450).IsRequired();
        report.Property(x => x.ReviewedByUserId).HasMaxLength(450);
        report.Property(x => x.Reason).HasMaxLength(64).IsRequired();
        report.Property(x => x.Description).HasMaxLength(2000);
        report.Property(x => x.ContentLocation).HasMaxLength(2000);
        report.Property(x => x.Status).HasMaxLength(32).IsRequired();
        report.Property(x => x.Resolution).HasMaxLength(4000);
        report.HasIndex(x => new { x.CourseId, x.Status, x.CreatedAt });
        report.HasOne(x => x.ReporterUser).WithMany().HasForeignKey(x => x.ReporterUserId)
            .OnDelete(DeleteBehavior.NoAction);
        report.HasOne(x => x.ReviewedByUser).WithMany().HasForeignKey(x => x.ReviewedByUserId)
            .OnDelete(DeleteBehavior.NoAction);
        report.HasOne(x => x.Course).WithMany().HasForeignKey(x => x.CourseId)
            .OnDelete(DeleteBehavior.NoAction);
        report.HasOne(x => x.CourseVersion).WithMany()
            .HasForeignKey(x => new { x.CourseId, x.CourseVersionId })
            .HasPrincipalKey(x => new { x.CourseId, x.Id }).OnDelete(DeleteBehavior.NoAction);
        report.HasOne(x => x.Lesson).WithMany().HasForeignKey(x => x.LessonId)
            .OnDelete(DeleteBehavior.NoAction);
        report.HasOne(x => x.MediaAsset).WithMany().HasForeignKey(x => x.MediaAssetId)
            .OnDelete(DeleteBehavior.NoAction);
        // Preserve the observed content; only investigation fields change after filing.
        foreach (var name in new[] { nameof(CourseReport.ReporterUserId), nameof(CourseReport.CourseId),
            nameof(CourseReport.CourseVersionId), nameof(CourseReport.LessonId), nameof(CourseReport.MediaAssetId),
            nameof(CourseReport.Reason), nameof(CourseReport.Description), nameof(CourseReport.ContentLocation),
            nameof(CourseReport.CreatedAt) })
            report.Property(name).Metadata.SetAfterSaveBehavior(PropertySaveBehavior.Throw);

        var warning = modelBuilder.Entity<CourseWarning>();
        warning.ToTable("CourseWarnings", table => table.HasCheckConstraint(
            "CK_CourseWarnings_Number", "[WarningNumber] > 0"));
        warning.HasKey(x => x.Id);
        warning.HasAlternateKey(x => new { x.CourseId, x.Id });
        warning.Property(x => x.IssuedByUserId).HasMaxLength(450).IsRequired();
        warning.Property(x => x.IncidentKey).HasMaxLength(200).IsRequired();
        warning.Property(x => x.Reason).HasMaxLength(2000).IsRequired();
        warning.Property(x => x.RequiredCorrection).HasMaxLength(4000);
        warning.HasIndex(x => new { x.CourseId, x.IncidentKey }).IsUnique();
        warning.HasIndex(x => new { x.CourseId, x.WarningNumber }).IsUnique();
        warning.HasOne(x => x.Course).WithMany().HasForeignKey(x => x.CourseId)
            .OnDelete(DeleteBehavior.NoAction);
        warning.HasOne(x => x.CourseVersion).WithMany()
            .HasForeignKey(x => new { x.CourseId, x.CourseVersionId })
            .HasPrincipalKey(x => new { x.CourseId, x.Id }).OnDelete(DeleteBehavior.NoAction);
        // Optional report must describe this same course and observed version.
        warning.HasOne(x => x.CourseReport).WithMany(x => x.Warnings)
            .HasForeignKey(x => new { x.CourseId, x.CourseVersionId, x.CourseReportId })
            .HasPrincipalKey(x => new { x.CourseId, x.CourseVersionId, x.Id }).OnDelete(DeleteBehavior.NoAction);
        warning.HasOne(x => x.MediaAsset).WithMany().HasForeignKey(x => x.MediaAssetId)
            .OnDelete(DeleteBehavior.NoAction);
        warning.HasOne(x => x.IssuedByUser).WithMany().HasForeignKey(x => x.IssuedByUserId)
            .OnDelete(DeleteBehavior.NoAction);
        foreach (var property in warning.Metadata.GetProperties())
            property.SetAfterSaveBehavior(PropertySaveBehavior.Throw);

        var appeal = modelBuilder.Entity<CourseAppeal>();
        appeal.ToTable("CourseAppeals");
        appeal.HasKey(x => x.Id);
        appeal.Property(x => x.InstructorUserId).HasMaxLength(450).IsRequired();
        appeal.Property(x => x.ReviewedByUserId).HasMaxLength(450);
        appeal.Property(x => x.Explanation).HasMaxLength(4000).IsRequired();
        appeal.Property(x => x.Status).HasMaxLength(32).IsRequired();
        appeal.Property(x => x.DecisionComment).HasMaxLength(4000);
        appeal.HasIndex(x => new { x.CourseId, x.Status, x.SubmittedAt });
        appeal.HasOne(x => x.Course).WithMany().HasForeignKey(x => x.CourseId)
            .OnDelete(DeleteBehavior.NoAction);
        appeal.HasOne(x => x.CourseWarning).WithMany(x => x.Appeals)
            .HasForeignKey(x => new { x.CourseId, x.CourseWarningId })
            .HasPrincipalKey(x => new { x.CourseId, x.Id }).OnDelete(DeleteBehavior.NoAction);
        appeal.HasOne(x => x.InstructorUser).WithMany().HasForeignKey(x => x.InstructorUserId)
            .OnDelete(DeleteBehavior.NoAction);
        appeal.HasOne(x => x.ReviewedByUser).WithMany().HasForeignKey(x => x.ReviewedByUserId)
            .OnDelete(DeleteBehavior.NoAction);
        foreach (var name in new[] { nameof(CourseAppeal.CourseId), nameof(CourseAppeal.CourseWarningId),
            nameof(CourseAppeal.InstructorUserId), nameof(CourseAppeal.Explanation), nameof(CourseAppeal.SubmittedAt) })
            appeal.Property(name).Metadata.SetAfterSaveBehavior(PropertySaveBehavior.Throw);

        var activity = modelBuilder.Entity<AdminActivityLog>();
        activity.ToTable("AdminActivityLogs", table => table.HasCheckConstraint(
            "CK_AdminActivityLogs_VersionCourse", "[CourseVersionId] IS NULL OR [CourseId] IS NOT NULL"));
        activity.HasKey(x => x.Id);
        activity.Property(x => x.ActorUserId).HasMaxLength(450).IsRequired();
        activity.Property(x => x.Action).HasMaxLength(100).IsRequired();
        activity.Property(x => x.TargetType).HasMaxLength(100).IsRequired();
        activity.Property(x => x.TargetId).HasMaxLength(450);
        activity.Property(x => x.TargetName).HasMaxLength(300);
        activity.Property(x => x.PreviousState).HasMaxLength(4000);
        activity.Property(x => x.NewState).HasMaxLength(4000);
        activity.Property(x => x.Details).HasMaxLength(10000);
        activity.HasIndex(x => x.CreatedAt);
        activity.HasIndex(x => new { x.CourseId, x.CreatedAt });
        activity.HasIndex(x => new { x.CategoryId, x.CreatedAt });
        activity.HasOne(x => x.ActorUser).WithMany().HasForeignKey(x => x.ActorUserId)
            .OnDelete(DeleteBehavior.NoAction);
        activity.HasOne(x => x.Course).WithMany().HasForeignKey(x => x.CourseId)
            .OnDelete(DeleteBehavior.NoAction);
        // General events need no course. A version-specific event supplies its course as well.
        activity.HasOne(x => x.CourseVersion).WithMany()
            .HasForeignKey(x => new { x.CourseId, x.CourseVersionId })
            .HasPrincipalKey(x => new { x.CourseId, x.Id }).OnDelete(DeleteBehavior.NoAction);
        activity.HasOne(x => x.Category).WithMany().HasForeignKey(x => x.CategoryId)
            .OnDelete(DeleteBehavior.NoAction);
        foreach (var property in activity.Metadata.GetProperties())
            property.SetAfterSaveBehavior(PropertySaveBehavior.Throw);
    }
}
