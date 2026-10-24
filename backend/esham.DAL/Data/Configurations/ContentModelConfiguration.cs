using System.Text.Json;
using esham.DAL.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace esham.DAL.Data.Configurations;

internal static class ContentModelConfiguration
{
    public static void Configure(ModelBuilder modelBuilder)
    {
        var category = modelBuilder.Entity<Category>();
        category.ToTable("Categories", table =>
            table.HasCheckConstraint("CK_Categories_Parent", "[ParentCategoryId] IS NULL OR [ParentCategoryId] <> [Id]"));
        category.HasKey(x => x.Id);
        category.Property(x => x.NameAr).HasMaxLength(200).IsRequired();
        category.Property(x => x.NameEn).HasMaxLength(200).IsRequired();
        category.Property(x => x.DescriptionAr).HasMaxLength(2000);
        category.Property(x => x.DescriptionEn).HasMaxLength(2000);
        category.HasOne(x => x.ParentCategory).WithMany(x => x.ChildCategories)
            .HasForeignKey(x => x.ParentCategoryId).OnDelete(DeleteBehavior.NoAction);

        var assignment = modelBuilder.Entity<CategoryAdminAssignment>();
        assignment.ToTable("CategoryAdminAssignments");
        assignment.HasKey(x => x.Id);
        assignment.Property(x => x.UserId).HasMaxLength(450).IsRequired();
        assignment.HasIndex(x => new { x.UserId, x.CategoryId }).IsUnique();
        assignment.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.NoAction);
        assignment.HasOne(x => x.Category).WithMany(x => x.CategoryAdminAssignments)
            .HasForeignKey(x => x.CategoryId).OnDelete(DeleteBehavior.NoAction);

        var course = modelBuilder.Entity<Course>();
        course.ToTable("Courses", table => table.HasCheckConstraint("CK_Courses_SafetyStatus",
            "[SafetyStatus] IN ('active', 'suspended', 'archived')"));
        course.HasKey(x => x.Id);
        course.Property(x => x.OwnerUserId).HasMaxLength(450).IsRequired();
        course.Property(x => x.SafetyStatus).HasMaxLength(32).IsRequired();
        course.Property(x => x.RowVersion).IsRowVersion();
        course.HasOne(x => x.OwnerUser).WithMany().HasForeignKey(x => x.OwnerUserId)
            .OnDelete(DeleteBehavior.NoAction);

        var version = modelBuilder.Entity<CourseVersion>();
        version.ToTable("CourseVersions", table =>
        {
            table.HasCheckConstraint("CK_CourseVersions_Number", "[VersionNumber] > 0");
            table.HasCheckConstraint("CK_CourseVersions_ReviewStatus",
                "[ReviewStatus] IN ('draft', 'pending', 'approved', 'rejected', 'changes_requested')");
            table.HasCheckConstraint("CK_CourseVersions_Objectives", "ISJSON([Objectives]) = 1");
        });
        version.HasKey(x => x.Id);
        // The alternate key lets course pointers enforce ownership in the database.
        version.HasAlternateKey(x => new { x.CourseId, x.Id });
        version.HasIndex(x => new { x.CourseId, x.VersionNumber }).IsUnique();
        version.Property(x => x.TitleAr).HasMaxLength(200);
        version.Property(x => x.TitleEn).HasMaxLength(200);
        version.Property(x => x.DescriptionAr).HasMaxLength(10000);
        version.Property(x => x.DescriptionEn).HasMaxLength(10000);
        version.Property(x => x.Language).HasMaxLength(16).IsRequired();
        version.Property(x => x.Level).HasMaxLength(32).IsRequired();
        version.Property(x => x.ReviewStatus).HasMaxLength(32).IsRequired();
        ConfigureJson(version.Property(x => x.Objectives).IsRequired());
        version.HasOne(x => x.Course).WithMany(x => x.CourseVersions)
            .HasForeignKey(x => x.CourseId).OnDelete(DeleteBehavior.NoAction);
        version.HasOne(x => x.Category).WithMany(x => x.CourseVersions)
            .HasForeignKey(x => x.CategoryId).OnDelete(DeleteBehavior.NoAction);
        version.HasOne(x => x.CoverMediaAsset).WithMany(x => x.CoverForVersions)
            .HasForeignKey(x => x.CoverMediaAssetId).OnDelete(DeleteBehavior.NoAction);
        course.HasOne(x => x.DraftVersion).WithMany()
            .HasForeignKey(x => new { x.Id, x.DraftVersionId })
            .HasPrincipalKey(x => new { x.CourseId, x.Id }).OnDelete(DeleteBehavior.NoAction);
        course.HasOne(x => x.PublishedVersion).WithMany()
            .HasForeignKey(x => new { x.Id, x.PublishedVersionId })
            .HasPrincipalKey(x => new { x.CourseId, x.Id }).OnDelete(DeleteBehavior.NoAction);

        var section = modelBuilder.Entity<CourseSection>();
        section.ToTable("CourseSections", table =>
            table.HasCheckConstraint("CK_CourseSections_SortOrder", "[SortOrder] >= 0"));
        section.HasKey(x => x.Id);
        section.HasAlternateKey(x => new { x.CourseVersionId, x.Id });
        section.Property(x => x.TitleAr).HasMaxLength(200);
        section.Property(x => x.TitleEn).HasMaxLength(200);
        section.HasIndex(x => new { x.CourseVersionId, x.SortOrder });
        section.HasOne(x => x.CourseVersion).WithMany(x => x.Sections)
            .HasForeignKey(x => x.CourseVersionId).OnDelete(DeleteBehavior.NoAction);

        var lesson = modelBuilder.Entity<Lesson>();
        lesson.ToTable("Lessons", table =>
        {
            table.HasCheckConstraint("CK_Lessons_SortOrder", "[SortOrder] >= 0");
            table.HasCheckConstraint("CK_Lessons_Duration", "[DurationSeconds] IS NULL OR [DurationSeconds] > 0");
            table.HasCheckConstraint("CK_Lessons_Objectives", "[Objectives] IS NULL OR ISJSON([Objectives]) = 1");
        });
        lesson.HasKey(x => x.Id);
        lesson.Property(x => x.TitleAr).HasMaxLength(200);
        lesson.Property(x => x.TitleEn).HasMaxLength(200);
        lesson.Property(x => x.ContentType).HasMaxLength(32).IsRequired();
        ConfigureJson(lesson.Property(x => x.Objectives));
        lesson.HasIndex(x => new { x.CourseSectionId, x.SortOrder });
        lesson.HasOne(x => x.CourseSection).WithMany(x => x.Lessons)
            .HasForeignKey(x => x.CourseSectionId).OnDelete(DeleteBehavior.NoAction);
        lesson.HasOne(x => x.PrimaryVideoMediaAsset).WithMany(x => x.PrimaryVideoForLessons)
            .HasForeignKey(x => x.PrimaryVideoMediaAssetId).OnDelete(DeleteBehavior.NoAction);

        var task = modelBuilder.Entity<CourseTask>();
        task.ToTable("CourseTasks", table =>
        {
            table.HasCheckConstraint("CK_CourseTasks_SortOrder", "[SortOrder] >= 0");
            table.HasCheckConstraint("CK_CourseTasks_Instructions", "[Instructions] IS NULL OR ISJSON([Instructions]) = 1");
            table.HasCheckConstraint("CK_CourseTasks_Requirements", "[Requirements] IS NULL OR ISJSON([Requirements]) = 1");
        });
        task.HasKey(x => x.Id);
        task.Property(x => x.TitleAr).HasMaxLength(200);
        task.Property(x => x.TitleEn).HasMaxLength(200);
        ConfigureJson(task.Property(x => x.Instructions));
        ConfigureJson(task.Property(x => x.Requirements));
        task.HasIndex(x => new { x.CourseVersionId, x.SortOrder });
        task.HasOne(x => x.CourseVersion).WithMany(x => x.Tasks)
            .HasForeignKey(x => x.CourseVersionId).OnDelete(DeleteBehavior.NoAction);
        task.HasOne(x => x.DisplaySection).WithMany(x => x.DisplayTasks)
            .HasForeignKey(x => new { x.CourseVersionId, x.DisplaySectionId })
            .HasPrincipalKey(x => new { x.CourseVersionId, x.Id }).OnDelete(DeleteBehavior.NoAction);

        var media = modelBuilder.Entity<MediaAsset>();
        media.ToTable("MediaAssets", table =>
        {
            table.HasCheckConstraint("CK_MediaAssets_Size", "[SizeBytes] > 0");
            table.HasCheckConstraint("CK_MediaAssets_Duration", "[DurationSeconds] IS NULL OR [DurationSeconds] > 0");
            table.HasCheckConstraint("CK_MediaAssets_Source", "[SourceMediaAssetId] IS NULL OR [SourceMediaAssetId] <> [Id]");
        });
        media.HasKey(x => x.Id);
        media.HasAlternateKey(x => new { x.Id, x.ContentHash });
        media.Property(x => x.OwnerUserId).HasMaxLength(450).IsRequired();
        media.Property(x => x.StorageKey).HasMaxLength(450).IsRequired();
        media.HasIndex(x => x.StorageKey).IsUnique();
        media.Property(x => x.OriginalFileName).HasMaxLength(255).IsRequired();
        media.Property(x => x.MimeType).HasMaxLength(127).IsRequired();
        media.Property(x => x.ContentHash).HasMaxLength(128).IsRequired();
        media.Property(x => x.MediaType).HasMaxLength(32).IsRequired();
        media.HasOne(x => x.OwnerUser).WithMany().HasForeignKey(x => x.OwnerUserId)
            .OnDelete(DeleteBehavior.NoAction);
        media.HasOne(x => x.SourceMediaAsset).WithMany(x => x.DerivedMediaAssets)
            .HasForeignKey(x => x.SourceMediaAssetId).OnDelete(DeleteBehavior.NoAction);

        var lessonAttachment = modelBuilder.Entity<LessonAttachment>();
        lessonAttachment.ToTable("LessonAttachments", table =>
            table.HasCheckConstraint("CK_LessonAttachments_SortOrder", "[SortOrder] >= 0"));
        lessonAttachment.HasKey(x => x.Id);
        lessonAttachment.Property(x => x.DisplayName).HasMaxLength(255).IsRequired();
        lessonAttachment.HasIndex(x => new { x.LessonId, x.MediaAssetId }).IsUnique();
        lessonAttachment.HasOne(x => x.Lesson).WithMany(x => x.Attachments)
            .HasForeignKey(x => x.LessonId).OnDelete(DeleteBehavior.NoAction);
        lessonAttachment.HasOne(x => x.MediaAsset).WithMany(x => x.LessonAttachments)
            .HasForeignKey(x => x.MediaAssetId).OnDelete(DeleteBehavior.NoAction);

        var taskAttachment = modelBuilder.Entity<TaskAttachment>();
        taskAttachment.ToTable("TaskAttachments", table =>
            table.HasCheckConstraint("CK_TaskAttachments_SortOrder", "[SortOrder] >= 0"));
        taskAttachment.HasKey(x => x.Id);
        taskAttachment.Property(x => x.DisplayName).HasMaxLength(255).IsRequired();
        taskAttachment.HasIndex(x => new { x.CourseTaskId, x.MediaAssetId }).IsUnique();
        taskAttachment.HasOne(x => x.CourseTask).WithMany(x => x.Attachments)
            .HasForeignKey(x => x.CourseTaskId).OnDelete(DeleteBehavior.NoAction);
        taskAttachment.HasOne(x => x.MediaAsset).WithMany(x => x.TaskAttachments)
            .HasForeignKey(x => x.MediaAssetId).OnDelete(DeleteBehavior.NoAction);

        var screening = modelBuilder.Entity<ScreeningResult>();
        screening.ToTable("ScreeningResults", table =>
        {
            table.HasCheckConstraint("CK_ScreeningResults_SampleCount", "[SampleCount] >= 0");
            table.HasCheckConstraint("CK_ScreeningResults_Findings", "ISJSON([Findings]) = 1");
            table.HasCheckConstraint("CK_ScreeningResults_Times",
                "[StartedAt] IS NULL OR [CompletedAt] IS NULL OR [CompletedAt] >= [StartedAt]");
        });
        screening.HasKey(x => x.Id);
        screening.Property(x => x.ContentHash).HasMaxLength(128).IsRequired();
        screening.Property(x => x.ModelName).HasMaxLength(200).IsRequired();
        screening.Property(x => x.ModelVersion).HasMaxLength(100).IsRequired();
        screening.Property(x => x.PolicyVersion).HasMaxLength(100).IsRequired();
        screening.Property(x => x.Status).HasMaxLength(32).IsRequired();
        ConfigureJson(screening.Property(x => x.Findings).IsRequired());
        // A result cannot refer to a different hash of the selected media.
        screening.HasOne(x => x.MediaAsset).WithMany(x => x.ScreeningResults)
            .HasForeignKey(x => new { x.MediaAssetId, x.ContentHash })
            .HasPrincipalKey(x => new { x.Id, x.ContentHash }).OnDelete(DeleteBehavior.NoAction);
    }

    private static void ConfigureJson<T>(PropertyBuilder<T> property)
    {
        property.HasColumnType("nvarchar(max)").HasConversion(
            value => JsonSerializer.Serialize(value, (JsonSerializerOptions?)null),
            json => JsonSerializer.Deserialize<T>(json, (JsonSerializerOptions?)null)!);
        // Deep snapshots detect changes inside mutable lists, including nullable collections.
        property.Metadata.SetValueComparer(new ValueComparer<T>(
            (left, right) => JsonSerializer.Serialize(left, (JsonSerializerOptions?)null)
                == JsonSerializer.Serialize(right, (JsonSerializerOptions?)null),
            value => JsonSerializer.Serialize(value, (JsonSerializerOptions?)null).GetHashCode(),
            value => JsonSerializer.Deserialize<T>(
                JsonSerializer.Serialize(value, (JsonSerializerOptions?)null), (JsonSerializerOptions?)null)!));
    }
}
