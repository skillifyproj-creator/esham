using esham.DAL.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;

namespace esham.DAL.Data.Configurations;

internal static class LearningModelConfiguration
{
    public static void Configure(ModelBuilder modelBuilder)
    {
        var userCategory = modelBuilder.Entity<UserCategory>();
        userCategory.ToTable("UserCategories", table => table.HasCheckConstraint(
            "CK_UserCategories_Kind", "[Kind] IN ('learning', 'teaching')"));
        userCategory.HasKey(x => new { x.UserId, x.CategoryId, x.Kind });
        userCategory.Property(x => x.UserId).HasMaxLength(450).IsRequired();
        userCategory.Property(x => x.Kind).HasMaxLength(16).IsRequired();
        userCategory.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.NoAction);
        userCategory.HasOne(x => x.Category).WithMany().HasForeignKey(x => x.CategoryId)
            .OnDelete(DeleteBehavior.NoAction);

        var enrollment = modelBuilder.Entity<Enrollment>();
        enrollment.ToTable("Enrollments");
        enrollment.HasKey(x => x.Id);
        enrollment.Property(x => x.LearnerUserId).HasMaxLength(450).IsRequired();
        enrollment.Property(x => x.Status).HasMaxLength(32).IsRequired();
        enrollment.HasIndex(x => new { x.LearnerUserId, x.CourseId }).IsUnique();
        enrollment.HasOne(x => x.LearnerUser).WithMany().HasForeignKey(x => x.LearnerUserId)
            .OnDelete(DeleteBehavior.NoAction);
        enrollment.HasOne(x => x.Course).WithMany().HasForeignKey(x => x.CourseId)
            .OnDelete(DeleteBehavior.NoAction);
        // Uses Fatima's existing alternate key; the version must belong to this course.
        enrollment.HasOne(x => x.CourseVersion).WithMany()
            .HasForeignKey(x => new { x.CourseId, x.CourseVersionId })
            .HasPrincipalKey(x => new { x.CourseId, x.Id }).OnDelete(DeleteBehavior.NoAction);

        var wallet = modelBuilder.Entity<Wallet>();
        wallet.ToTable("Wallets", table => table.HasCheckConstraint("CK_Wallets_Balance", "[Balance] >= 0"));
        wallet.HasKey(x => x.UserId);
        wallet.Property(x => x.UserId).HasMaxLength(450);
        wallet.Property(x => x.RowVersion).IsRowVersion();
        wallet.HasOne(x => x.User).WithOne().HasForeignKey<Wallet>(x => x.UserId)
            .OnDelete(DeleteBehavior.NoAction);
        // The PK guarantees at most one wallet; account initialization must create it once.

        var pointTransaction = modelBuilder.Entity<PointTransaction>();
        pointTransaction.ToTable("PointTransactions", table =>
            table.HasCheckConstraint("CK_PointTransactions_Amount", "[Amount] <> 0"));
        pointTransaction.HasKey(x => x.Id);
        pointTransaction.Property(x => x.UserId).HasMaxLength(450).IsRequired();
        pointTransaction.Property(x => x.TransactionType).HasMaxLength(32).IsRequired();
        pointTransaction.Property(x => x.OperationKey).HasMaxLength(200).IsRequired();
        pointTransaction.HasIndex(x => x.OperationKey).IsUnique();
        pointTransaction.HasIndex(x => new { x.UserId, x.CreatedAt });
        pointTransaction.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.NoAction);
        pointTransaction.HasOne(x => x.Enrollment).WithMany(x => x.PointTransactions)
            .HasForeignKey(x => x.EnrollmentId).OnDelete(DeleteBehavior.NoAction);
        // Guard accidental EF updates to ledger values. Future services must also forbid deletion.
        foreach (var property in pointTransaction.Metadata.GetProperties())
            property.SetAfterSaveBehavior(PropertySaveBehavior.Throw);

        var progress = modelBuilder.Entity<LessonProgress>();
        progress.ToTable("LessonProgress", table => table.HasCheckConstraint(
            "CK_LessonProgress_Position", "[LastPositionSeconds] >= 0"));
        progress.HasKey(x => x.Id);
        progress.HasIndex(x => new { x.EnrollmentId, x.LessonId }).IsUnique();
        progress.HasOne(x => x.Enrollment).WithMany(x => x.LessonProgressRecords)
            .HasForeignKey(x => x.EnrollmentId).OnDelete(DeleteBehavior.NoAction);
        progress.HasOne(x => x.Lesson).WithMany().HasForeignKey(x => x.LessonId)
            .OnDelete(DeleteBehavior.NoAction);

        var submission = modelBuilder.Entity<TaskSubmission>();
        submission.ToTable("TaskSubmissions", table => table.HasCheckConstraint(
            "CK_TaskSubmissions_Attempt", "[AttemptNumber] > 0"));
        submission.HasKey(x => x.Id);
        submission.Property(x => x.AnswerText).HasMaxLength(5000);
        submission.Property(x => x.WorkUrl).HasMaxLength(2000);
        submission.Property(x => x.Status).HasMaxLength(32).IsRequired();
        submission.HasIndex(x => new { x.EnrollmentId, x.CourseTaskId, x.AttemptNumber }).IsUnique();
        submission.HasOne(x => x.Enrollment).WithMany(x => x.TaskSubmissions)
            .HasForeignKey(x => x.EnrollmentId).OnDelete(DeleteBehavior.NoAction);
        submission.HasOne(x => x.CourseTask).WithMany().HasForeignKey(x => x.CourseTaskId)
            .OnDelete(DeleteBehavior.NoAction);
        // Same-version task/lesson checks and submitted-attempt locking belong to future services.

        var attachment = modelBuilder.Entity<SubmissionAttachment>();
        attachment.ToTable("SubmissionAttachments");
        attachment.HasKey(x => x.Id);
        attachment.HasIndex(x => new { x.TaskSubmissionId, x.MediaAssetId }).IsUnique();
        attachment.HasOne(x => x.TaskSubmission).WithMany(x => x.Attachments)
            .HasForeignKey(x => x.TaskSubmissionId).OnDelete(DeleteBehavior.NoAction);
        attachment.HasOne(x => x.MediaAsset).WithMany().HasForeignKey(x => x.MediaAssetId)
            .OnDelete(DeleteBehavior.NoAction);

        var assessment = modelBuilder.Entity<TaskSubmissionReview>();
        assessment.ToTable("TaskSubmissionReviews");
        assessment.HasKey(x => x.Id);
        assessment.Property(x => x.ReviewerUserId).HasMaxLength(450).IsRequired();
        assessment.Property(x => x.Decision).HasMaxLength(32).IsRequired();
        assessment.Property(x => x.Feedback).HasMaxLength(2000);
        assessment.HasOne(x => x.TaskSubmission).WithMany(x => x.Reviews)
            .HasForeignKey(x => x.TaskSubmissionId).OnDelete(DeleteBehavior.NoAction);
        assessment.HasOne(x => x.ReviewerUser).WithMany().HasForeignKey(x => x.ReviewerUserId)
            .OnDelete(DeleteBehavior.NoAction);
        foreach (var property in assessment.Metadata.GetProperties())
            property.SetAfterSaveBehavior(PropertySaveBehavior.Throw);

        var courseReview = modelBuilder.Entity<CourseReview>();
        courseReview.ToTable("CourseReviews", table => table.HasCheckConstraint(
            "CK_CourseReviews_Rating", "[Rating] BETWEEN 1 AND 5"));
        courseReview.HasKey(x => x.Id);
        courseReview.Property(x => x.Comment).HasMaxLength(2000);
        courseReview.Property(x => x.InstructorReply).HasMaxLength(2000);
        courseReview.HasIndex(x => x.EnrollmentId).IsUnique();
        courseReview.HasOne(x => x.Enrollment).WithOne(x => x.CourseReview)
            .HasForeignKey<CourseReview>(x => x.EnrollmentId).OnDelete(DeleteBehavior.NoAction);

        var notification = modelBuilder.Entity<Notification>();
        notification.ToTable("Notifications");
        notification.HasKey(x => x.Id);
        notification.Property(x => x.RecipientUserId).HasMaxLength(450).IsRequired();
        notification.Property(x => x.TitleAr).HasMaxLength(200);
        notification.Property(x => x.TitleEn).HasMaxLength(200);
        notification.Property(x => x.MessageAr).HasMaxLength(2000);
        notification.Property(x => x.MessageEn).HasMaxLength(2000);
        notification.Property(x => x.NotificationType).HasMaxLength(64).IsRequired();
        notification.HasIndex(x => new { x.RecipientUserId, x.IsRead, x.CreatedAt });
        notification.HasOne(x => x.RecipientUser).WithMany().HasForeignKey(x => x.RecipientUserId)
            .OnDelete(DeleteBehavior.NoAction);

        var certificate = modelBuilder.Entity<Certificate>();
        certificate.ToTable("Certificates");
        certificate.HasKey(x => x.Id);
        certificate.Property(x => x.VerificationCode).HasMaxLength(100).IsRequired();
        certificate.Property(x => x.LearnerNameSnapshot).HasMaxLength(200).IsRequired();
        certificate.Property(x => x.CourseTitleSnapshotAr).HasMaxLength(200);
        certificate.Property(x => x.CourseTitleSnapshotEn).HasMaxLength(200);
        certificate.Property(x => x.InstructorNameSnapshot).HasMaxLength(200).IsRequired();
        certificate.Property(x => x.Status).HasMaxLength(32).IsRequired();
        certificate.HasIndex(x => x.EnrollmentId).IsUnique();
        certificate.HasIndex(x => x.VerificationCode).IsUnique();
        certificate.HasOne(x => x.Enrollment).WithOne(x => x.Certificate)
            .HasForeignKey<Certificate>(x => x.EnrollmentId).OnDelete(DeleteBehavior.NoAction);
    }
}
