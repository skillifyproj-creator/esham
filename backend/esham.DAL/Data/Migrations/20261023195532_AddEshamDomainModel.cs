using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace esham.DAL.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddEshamDomainModel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Announcements",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AuthorUserId = table.Column<string>(type: "nvarchar(450)", maxLength: 450, nullable: false),
                    TitleAr = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    TitleEn = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    ContentAr = table.Column<string>(type: "nvarchar(max)", maxLength: 10000, nullable: true),
                    ContentEn = table.Column<string>(type: "nvarchar(max)", maxLength: 10000, nullable: true),
                    Audience = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    PublishedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Announcements", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Announcements_AspNetUsers_AuthorUserId",
                        column: x => x.AuthorUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "Categories",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    NameAr = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    NameEn = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    DescriptionAr = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    DescriptionEn = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    ParentCategoryId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    DisplayOrder = table.Column<int>(type: "int", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Categories", x => x.Id);
                    table.CheckConstraint("CK_Categories_Parent", "[ParentCategoryId] IS NULL OR [ParentCategoryId] <> [Id]");
                    table.ForeignKey(
                        name: "FK_Categories_Categories_ParentCategoryId",
                        column: x => x.ParentCategoryId,
                        principalTable: "Categories",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "MediaAssets",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OwnerUserId = table.Column<string>(type: "nvarchar(450)", maxLength: 450, nullable: false),
                    SourceMediaAssetId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    StorageKey = table.Column<string>(type: "nvarchar(450)", maxLength: 450, nullable: false),
                    OriginalFileName = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    MimeType = table.Column<string>(type: "nvarchar(127)", maxLength: 127, nullable: false),
                    SizeBytes = table.Column<long>(type: "bigint", nullable: false),
                    ContentHash = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    DurationSeconds = table.Column<double>(type: "float", nullable: true),
                    MediaType = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MediaAssets", x => x.Id);
                    table.UniqueConstraint("AK_MediaAssets_Id_ContentHash", x => new { x.Id, x.ContentHash });
                    table.CheckConstraint("CK_MediaAssets_Duration", "[DurationSeconds] IS NULL OR [DurationSeconds] > 0");
                    table.CheckConstraint("CK_MediaAssets_Size", "[SizeBytes] > 0");
                    table.CheckConstraint("CK_MediaAssets_Source", "[SourceMediaAssetId] IS NULL OR [SourceMediaAssetId] <> [Id]");
                    table.ForeignKey(
                        name: "FK_MediaAssets_AspNetUsers_OwnerUserId",
                        column: x => x.OwnerUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_MediaAssets_MediaAssets_SourceMediaAssetId",
                        column: x => x.SourceMediaAssetId,
                        principalTable: "MediaAssets",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "Notifications",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RecipientUserId = table.Column<string>(type: "nvarchar(450)", maxLength: 450, nullable: false),
                    TitleAr = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    TitleEn = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    MessageAr = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    MessageEn = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    NotificationType = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    IsRead = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    ReadAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Notifications", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Notifications_AspNetUsers_RecipientUserId",
                        column: x => x.RecipientUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "Wallets",
                columns: table => new
                {
                    UserId = table.Column<string>(type: "nvarchar(450)", maxLength: 450, nullable: false),
                    Balance = table.Column<int>(type: "int", nullable: false),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Wallets", x => x.UserId);
                    table.CheckConstraint("CK_Wallets_Balance", "[Balance] >= 0");
                    table.ForeignKey(
                        name: "FK_Wallets_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "CategoryAdminAssignments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<string>(type: "nvarchar(450)", maxLength: 450, nullable: false),
                    CategoryId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AssignedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CategoryAdminAssignments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CategoryAdminAssignments_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_CategoryAdminAssignments_Categories_CategoryId",
                        column: x => x.CategoryId,
                        principalTable: "Categories",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "UserCategories",
                columns: table => new
                {
                    UserId = table.Column<string>(type: "nvarchar(450)", maxLength: 450, nullable: false),
                    CategoryId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Kind = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserCategories", x => new { x.UserId, x.CategoryId, x.Kind });
                    table.CheckConstraint("CK_UserCategories_Kind", "[Kind] IN ('learning', 'teaching')");
                    table.ForeignKey(
                        name: "FK_UserCategories_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_UserCategories_Categories_CategoryId",
                        column: x => x.CategoryId,
                        principalTable: "Categories",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "ScreeningResults",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    MediaAssetId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ContentHash = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    ModelName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    ModelVersion = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    PolicyVersion = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    Findings = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    SampleCount = table.Column<int>(type: "int", nullable: false),
                    IsTrustedServerResult = table.Column<bool>(type: "bit", nullable: false),
                    StartedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    CompletedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScreeningResults", x => x.Id);
                    table.CheckConstraint("CK_ScreeningResults_Findings", "ISJSON([Findings]) = 1");
                    table.CheckConstraint("CK_ScreeningResults_SampleCount", "[SampleCount] >= 0");
                    table.CheckConstraint("CK_ScreeningResults_Times", "[StartedAt] IS NULL OR [CompletedAt] IS NULL OR [CompletedAt] >= [StartedAt]");
                    table.ForeignKey(
                        name: "FK_ScreeningResults_MediaAssets_MediaAssetId_ContentHash",
                        columns: x => new { x.MediaAssetId, x.ContentHash },
                        principalTable: "MediaAssets",
                        principalColumns: new[] { "Id", "ContentHash" });
                });

            migrationBuilder.CreateTable(
                name: "AdminActivityLogs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ActorUserId = table.Column<string>(type: "nvarchar(450)", maxLength: 450, nullable: false),
                    Action = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    TargetType = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    TargetId = table.Column<string>(type: "nvarchar(450)", maxLength: 450, nullable: true),
                    TargetName = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    CourseId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    CourseVersionId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    CategoryId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    PreviousState = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: true),
                    NewState = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: true),
                    Details = table.Column<string>(type: "nvarchar(max)", maxLength: 10000, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AdminActivityLogs", x => x.Id);
                    table.CheckConstraint("CK_AdminActivityLogs_VersionCourse", "[CourseVersionId] IS NULL OR [CourseId] IS NOT NULL");
                    table.ForeignKey(
                        name: "FK_AdminActivityLogs_AspNetUsers_ActorUserId",
                        column: x => x.ActorUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_AdminActivityLogs_Categories_CategoryId",
                        column: x => x.CategoryId,
                        principalTable: "Categories",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "Certificates",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EnrollmentId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    VerificationCode = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    LearnerNameSnapshot = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    CourseTitleSnapshotAr = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    CourseTitleSnapshotEn = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    InstructorNameSnapshot = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    IssuedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Certificates", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CourseAppeals",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CourseId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CourseWarningId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    InstructorUserId = table.Column<string>(type: "nvarchar(450)", maxLength: 450, nullable: false),
                    Explanation = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    ReviewedByUserId = table.Column<string>(type: "nvarchar(450)", maxLength: 450, nullable: true),
                    DecisionComment = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: true),
                    SubmittedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    ReviewedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CourseAppeals", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CourseAppeals_AspNetUsers_InstructorUserId",
                        column: x => x.InstructorUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_CourseAppeals_AspNetUsers_ReviewedByUserId",
                        column: x => x.ReviewedByUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "CourseReports",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ReporterUserId = table.Column<string>(type: "nvarchar(450)", maxLength: 450, nullable: false),
                    CourseId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CourseVersionId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LessonId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    MediaAssetId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Reason = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    ContentLocation = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    Status = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    ReviewedByUserId = table.Column<string>(type: "nvarchar(450)", maxLength: 450, nullable: true),
                    Resolution = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    ReviewedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CourseReports", x => x.Id);
                    table.UniqueConstraint("AK_CourseReports_CourseId_CourseVersionId_Id", x => new { x.CourseId, x.CourseVersionId, x.Id });
                    table.ForeignKey(
                        name: "FK_CourseReports_AspNetUsers_ReporterUserId",
                        column: x => x.ReporterUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_CourseReports_AspNetUsers_ReviewedByUserId",
                        column: x => x.ReviewedByUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_CourseReports_MediaAssets_MediaAssetId",
                        column: x => x.MediaAssetId,
                        principalTable: "MediaAssets",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "CourseReviewDecisions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CourseVersionId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ReviewerUserId = table.Column<string>(type: "nvarchar(450)", maxLength: 450, nullable: false),
                    Decision = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    Comment = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: true),
                    ReviewedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CourseReviewDecisions", x => x.Id);
                    table.CheckConstraint("CK_CourseReviewDecisions_Decision", "[Decision] IN ('approved', 'rejected', 'changes_requested')");
                    table.ForeignKey(
                        name: "FK_CourseReviewDecisions_AspNetUsers_ReviewerUserId",
                        column: x => x.ReviewerUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "CourseReviews",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EnrollmentId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Rating = table.Column<int>(type: "int", nullable: false),
                    Comment = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    InstructorReply = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    RepliedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CourseReviews", x => x.Id);
                    table.CheckConstraint("CK_CourseReviews_Rating", "[Rating] BETWEEN 1 AND 5");
                });

            migrationBuilder.CreateTable(
                name: "Courses",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OwnerUserId = table.Column<string>(type: "nvarchar(450)", maxLength: 450, nullable: false),
                    DraftVersionId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    PublishedVersionId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    SafetyStatus = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    EnrollmentPaused = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Courses", x => x.Id);
                    table.CheckConstraint("CK_Courses_SafetyStatus", "[SafetyStatus] IN ('active', 'suspended', 'archived')");
                    table.ForeignKey(
                        name: "FK_Courses_AspNetUsers_OwnerUserId",
                        column: x => x.OwnerUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "CourseVersions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CourseId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CategoryId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    VersionNumber = table.Column<int>(type: "int", nullable: false),
                    TitleAr = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    TitleEn = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    DescriptionAr = table.Column<string>(type: "nvarchar(max)", maxLength: 10000, nullable: true),
                    DescriptionEn = table.Column<string>(type: "nvarchar(max)", maxLength: 10000, nullable: true),
                    Objectives = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Language = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    Level = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    CoverMediaAssetId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    ReviewStatus = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    SubmittedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    ApprovedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CourseVersions", x => x.Id);
                    table.UniqueConstraint("AK_CourseVersions_CourseId_Id", x => new { x.CourseId, x.Id });
                    table.CheckConstraint("CK_CourseVersions_Number", "[VersionNumber] > 0");
                    table.CheckConstraint("CK_CourseVersions_Objectives", "ISJSON([Objectives]) = 1");
                    table.CheckConstraint("CK_CourseVersions_ReviewStatus", "[ReviewStatus] IN ('draft', 'pending', 'approved', 'rejected', 'changes_requested')");
                    table.ForeignKey(
                        name: "FK_CourseVersions_Categories_CategoryId",
                        column: x => x.CategoryId,
                        principalTable: "Categories",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_CourseVersions_Courses_CourseId",
                        column: x => x.CourseId,
                        principalTable: "Courses",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_CourseVersions_MediaAssets_CoverMediaAssetId",
                        column: x => x.CoverMediaAssetId,
                        principalTable: "MediaAssets",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "CourseSections",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CourseVersionId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TitleAr = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    TitleEn = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CourseSections", x => x.Id);
                    table.UniqueConstraint("AK_CourseSections_CourseVersionId_Id", x => new { x.CourseVersionId, x.Id });
                    table.CheckConstraint("CK_CourseSections_SortOrder", "[SortOrder] >= 0");
                    table.ForeignKey(
                        name: "FK_CourseSections_CourseVersions_CourseVersionId",
                        column: x => x.CourseVersionId,
                        principalTable: "CourseVersions",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "CourseWarnings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CourseId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CourseVersionId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CourseReportId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    MediaAssetId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    IssuedByUserId = table.Column<string>(type: "nvarchar(450)", maxLength: 450, nullable: false),
                    IncidentKey = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    WarningNumber = table.Column<int>(type: "int", nullable: false),
                    Reason = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    RequiredCorrection = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: true),
                    Deadline = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CourseWarnings", x => x.Id);
                    table.UniqueConstraint("AK_CourseWarnings_CourseId_Id", x => new { x.CourseId, x.Id });
                    table.CheckConstraint("CK_CourseWarnings_Number", "[WarningNumber] > 0");
                    table.ForeignKey(
                        name: "FK_CourseWarnings_AspNetUsers_IssuedByUserId",
                        column: x => x.IssuedByUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_CourseWarnings_CourseReports_CourseId_CourseVersionId_CourseReportId",
                        columns: x => new { x.CourseId, x.CourseVersionId, x.CourseReportId },
                        principalTable: "CourseReports",
                        principalColumns: new[] { "CourseId", "CourseVersionId", "Id" });
                    table.ForeignKey(
                        name: "FK_CourseWarnings_CourseVersions_CourseId_CourseVersionId",
                        columns: x => new { x.CourseId, x.CourseVersionId },
                        principalTable: "CourseVersions",
                        principalColumns: new[] { "CourseId", "Id" });
                    table.ForeignKey(
                        name: "FK_CourseWarnings_Courses_CourseId",
                        column: x => x.CourseId,
                        principalTable: "Courses",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_CourseWarnings_MediaAssets_MediaAssetId",
                        column: x => x.MediaAssetId,
                        principalTable: "MediaAssets",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "Enrollments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LearnerUserId = table.Column<string>(type: "nvarchar(450)", maxLength: 450, nullable: false),
                    CourseId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CourseVersionId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    EnrolledAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CompletedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    LastOpenedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Enrollments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Enrollments_AspNetUsers_LearnerUserId",
                        column: x => x.LearnerUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_Enrollments_CourseVersions_CourseId_CourseVersionId",
                        columns: x => new { x.CourseId, x.CourseVersionId },
                        principalTable: "CourseVersions",
                        principalColumns: new[] { "CourseId", "Id" });
                    table.ForeignKey(
                        name: "FK_Enrollments_Courses_CourseId",
                        column: x => x.CourseId,
                        principalTable: "Courses",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "CourseTasks",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CourseVersionId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DisplaySectionId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    TitleAr = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    TitleEn = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    DescriptionAr = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    DescriptionEn = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Instructions = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Requirements = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    IsReady = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CourseTasks", x => x.Id);
                    table.CheckConstraint("CK_CourseTasks_Instructions", "[Instructions] IS NULL OR ISJSON([Instructions]) = 1");
                    table.CheckConstraint("CK_CourseTasks_Requirements", "[Requirements] IS NULL OR ISJSON([Requirements]) = 1");
                    table.CheckConstraint("CK_CourseTasks_SortOrder", "[SortOrder] >= 0");
                    table.ForeignKey(
                        name: "FK_CourseTasks_CourseSections_CourseVersionId_DisplaySectionId",
                        columns: x => new { x.CourseVersionId, x.DisplaySectionId },
                        principalTable: "CourseSections",
                        principalColumns: new[] { "CourseVersionId", "Id" });
                    table.ForeignKey(
                        name: "FK_CourseTasks_CourseVersions_CourseVersionId",
                        column: x => x.CourseVersionId,
                        principalTable: "CourseVersions",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "Lessons",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CourseSectionId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TitleAr = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    TitleEn = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    DescriptionAr = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    DescriptionEn = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Objectives = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ContentType = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    DurationSeconds = table.Column<double>(type: "float", nullable: true),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    IsPreview = table.Column<bool>(type: "bit", nullable: false),
                    PrimaryVideoMediaAssetId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Lessons", x => x.Id);
                    table.CheckConstraint("CK_Lessons_Duration", "[DurationSeconds] IS NULL OR [DurationSeconds] > 0");
                    table.CheckConstraint("CK_Lessons_Objectives", "[Objectives] IS NULL OR ISJSON([Objectives]) = 1");
                    table.CheckConstraint("CK_Lessons_SortOrder", "[SortOrder] >= 0");
                    table.ForeignKey(
                        name: "FK_Lessons_CourseSections_CourseSectionId",
                        column: x => x.CourseSectionId,
                        principalTable: "CourseSections",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_Lessons_MediaAssets_PrimaryVideoMediaAssetId",
                        column: x => x.PrimaryVideoMediaAssetId,
                        principalTable: "MediaAssets",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "PointTransactions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<string>(type: "nvarchar(450)", maxLength: 450, nullable: false),
                    EnrollmentId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Amount = table.Column<int>(type: "int", nullable: false),
                    TransactionType = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    OperationKey = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PointTransactions", x => x.Id);
                    table.CheckConstraint("CK_PointTransactions_Amount", "[Amount] <> 0");
                    table.ForeignKey(
                        name: "FK_PointTransactions_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_PointTransactions_Enrollments_EnrollmentId",
                        column: x => x.EnrollmentId,
                        principalTable: "Enrollments",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "TaskAttachments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CourseTaskId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    MediaAssetId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DisplayName = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TaskAttachments", x => x.Id);
                    table.CheckConstraint("CK_TaskAttachments_SortOrder", "[SortOrder] >= 0");
                    table.ForeignKey(
                        name: "FK_TaskAttachments_CourseTasks_CourseTaskId",
                        column: x => x.CourseTaskId,
                        principalTable: "CourseTasks",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_TaskAttachments_MediaAssets_MediaAssetId",
                        column: x => x.MediaAssetId,
                        principalTable: "MediaAssets",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "TaskSubmissions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EnrollmentId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CourseTaskId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AttemptNumber = table.Column<int>(type: "int", nullable: false),
                    AnswerText = table.Column<string>(type: "nvarchar(max)", maxLength: 5000, nullable: true),
                    WorkUrl = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    Status = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    SubmittedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TaskSubmissions", x => x.Id);
                    table.CheckConstraint("CK_TaskSubmissions_Attempt", "[AttemptNumber] > 0");
                    table.ForeignKey(
                        name: "FK_TaskSubmissions_CourseTasks_CourseTaskId",
                        column: x => x.CourseTaskId,
                        principalTable: "CourseTasks",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_TaskSubmissions_Enrollments_EnrollmentId",
                        column: x => x.EnrollmentId,
                        principalTable: "Enrollments",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "LessonAttachments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LessonId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    MediaAssetId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DisplayName = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LessonAttachments", x => x.Id);
                    table.CheckConstraint("CK_LessonAttachments_SortOrder", "[SortOrder] >= 0");
                    table.ForeignKey(
                        name: "FK_LessonAttachments_Lessons_LessonId",
                        column: x => x.LessonId,
                        principalTable: "Lessons",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_LessonAttachments_MediaAssets_MediaAssetId",
                        column: x => x.MediaAssetId,
                        principalTable: "MediaAssets",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "LessonProgress",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EnrollmentId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LessonId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IsCompleted = table.Column<bool>(type: "bit", nullable: false),
                    CompletedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    LastPositionSeconds = table.Column<double>(type: "float", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LessonProgress", x => x.Id);
                    table.CheckConstraint("CK_LessonProgress_Position", "[LastPositionSeconds] >= 0");
                    table.ForeignKey(
                        name: "FK_LessonProgress_Enrollments_EnrollmentId",
                        column: x => x.EnrollmentId,
                        principalTable: "Enrollments",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_LessonProgress_Lessons_LessonId",
                        column: x => x.LessonId,
                        principalTable: "Lessons",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "SubmissionAttachments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TaskSubmissionId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    MediaAssetId = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SubmissionAttachments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SubmissionAttachments_MediaAssets_MediaAssetId",
                        column: x => x.MediaAssetId,
                        principalTable: "MediaAssets",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_SubmissionAttachments_TaskSubmissions_TaskSubmissionId",
                        column: x => x.TaskSubmissionId,
                        principalTable: "TaskSubmissions",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "TaskSubmissionReviews",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TaskSubmissionId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ReviewerUserId = table.Column<string>(type: "nvarchar(450)", maxLength: 450, nullable: false),
                    Decision = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    Feedback = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    ReviewedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TaskSubmissionReviews", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TaskSubmissionReviews_AspNetUsers_ReviewerUserId",
                        column: x => x.ReviewerUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_TaskSubmissionReviews_TaskSubmissions_TaskSubmissionId",
                        column: x => x.TaskSubmissionId,
                        principalTable: "TaskSubmissions",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_AdminActivityLogs_ActorUserId",
                table: "AdminActivityLogs",
                column: "ActorUserId");

            migrationBuilder.CreateIndex(
                name: "IX_AdminActivityLogs_CategoryId_CreatedAt",
                table: "AdminActivityLogs",
                columns: new[] { "CategoryId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_AdminActivityLogs_CourseId_CourseVersionId",
                table: "AdminActivityLogs",
                columns: new[] { "CourseId", "CourseVersionId" });

            migrationBuilder.CreateIndex(
                name: "IX_AdminActivityLogs_CourseId_CreatedAt",
                table: "AdminActivityLogs",
                columns: new[] { "CourseId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_AdminActivityLogs_CreatedAt",
                table: "AdminActivityLogs",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_Announcements_AuthorUserId",
                table: "Announcements",
                column: "AuthorUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Announcements_Status_PublishedAt",
                table: "Announcements",
                columns: new[] { "Status", "PublishedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Categories_ParentCategoryId",
                table: "Categories",
                column: "ParentCategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_CategoryAdminAssignments_CategoryId",
                table: "CategoryAdminAssignments",
                column: "CategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_CategoryAdminAssignments_UserId_CategoryId",
                table: "CategoryAdminAssignments",
                columns: new[] { "UserId", "CategoryId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Certificates_EnrollmentId",
                table: "Certificates",
                column: "EnrollmentId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Certificates_VerificationCode",
                table: "Certificates",
                column: "VerificationCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CourseAppeals_CourseId_CourseWarningId",
                table: "CourseAppeals",
                columns: new[] { "CourseId", "CourseWarningId" });

            migrationBuilder.CreateIndex(
                name: "IX_CourseAppeals_CourseId_Status_SubmittedAt",
                table: "CourseAppeals",
                columns: new[] { "CourseId", "Status", "SubmittedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_CourseAppeals_InstructorUserId",
                table: "CourseAppeals",
                column: "InstructorUserId");

            migrationBuilder.CreateIndex(
                name: "IX_CourseAppeals_ReviewedByUserId",
                table: "CourseAppeals",
                column: "ReviewedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_CourseReports_CourseId_Status_CreatedAt",
                table: "CourseReports",
                columns: new[] { "CourseId", "Status", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_CourseReports_LessonId",
                table: "CourseReports",
                column: "LessonId");

            migrationBuilder.CreateIndex(
                name: "IX_CourseReports_MediaAssetId",
                table: "CourseReports",
                column: "MediaAssetId");

            migrationBuilder.CreateIndex(
                name: "IX_CourseReports_ReporterUserId",
                table: "CourseReports",
                column: "ReporterUserId");

            migrationBuilder.CreateIndex(
                name: "IX_CourseReports_ReviewedByUserId",
                table: "CourseReports",
                column: "ReviewedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_CourseReviewDecisions_CourseVersionId_ReviewedAt",
                table: "CourseReviewDecisions",
                columns: new[] { "CourseVersionId", "ReviewedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_CourseReviewDecisions_ReviewerUserId",
                table: "CourseReviewDecisions",
                column: "ReviewerUserId");

            migrationBuilder.CreateIndex(
                name: "IX_CourseReviews_EnrollmentId",
                table: "CourseReviews",
                column: "EnrollmentId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Courses_Id_DraftVersionId",
                table: "Courses",
                columns: new[] { "Id", "DraftVersionId" });

            migrationBuilder.CreateIndex(
                name: "IX_Courses_Id_PublishedVersionId",
                table: "Courses",
                columns: new[] { "Id", "PublishedVersionId" });

            migrationBuilder.CreateIndex(
                name: "IX_Courses_OwnerUserId",
                table: "Courses",
                column: "OwnerUserId");

            migrationBuilder.CreateIndex(
                name: "IX_CourseSections_CourseVersionId_SortOrder",
                table: "CourseSections",
                columns: new[] { "CourseVersionId", "SortOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_CourseTasks_CourseVersionId_DisplaySectionId",
                table: "CourseTasks",
                columns: new[] { "CourseVersionId", "DisplaySectionId" });

            migrationBuilder.CreateIndex(
                name: "IX_CourseTasks_CourseVersionId_SortOrder",
                table: "CourseTasks",
                columns: new[] { "CourseVersionId", "SortOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_CourseVersions_CategoryId",
                table: "CourseVersions",
                column: "CategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_CourseVersions_CourseId_VersionNumber",
                table: "CourseVersions",
                columns: new[] { "CourseId", "VersionNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CourseVersions_CoverMediaAssetId",
                table: "CourseVersions",
                column: "CoverMediaAssetId");

            migrationBuilder.CreateIndex(
                name: "IX_CourseWarnings_CourseId_CourseVersionId_CourseReportId",
                table: "CourseWarnings",
                columns: new[] { "CourseId", "CourseVersionId", "CourseReportId" });

            migrationBuilder.CreateIndex(
                name: "IX_CourseWarnings_CourseId_IncidentKey",
                table: "CourseWarnings",
                columns: new[] { "CourseId", "IncidentKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CourseWarnings_CourseId_WarningNumber",
                table: "CourseWarnings",
                columns: new[] { "CourseId", "WarningNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CourseWarnings_IssuedByUserId",
                table: "CourseWarnings",
                column: "IssuedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_CourseWarnings_MediaAssetId",
                table: "CourseWarnings",
                column: "MediaAssetId");

            migrationBuilder.CreateIndex(
                name: "IX_Enrollments_CourseId_CourseVersionId",
                table: "Enrollments",
                columns: new[] { "CourseId", "CourseVersionId" });

            migrationBuilder.CreateIndex(
                name: "IX_Enrollments_LearnerUserId_CourseId",
                table: "Enrollments",
                columns: new[] { "LearnerUserId", "CourseId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_LessonAttachments_LessonId_MediaAssetId",
                table: "LessonAttachments",
                columns: new[] { "LessonId", "MediaAssetId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_LessonAttachments_MediaAssetId",
                table: "LessonAttachments",
                column: "MediaAssetId");

            migrationBuilder.CreateIndex(
                name: "IX_LessonProgress_EnrollmentId_LessonId",
                table: "LessonProgress",
                columns: new[] { "EnrollmentId", "LessonId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_LessonProgress_LessonId",
                table: "LessonProgress",
                column: "LessonId");

            migrationBuilder.CreateIndex(
                name: "IX_Lessons_CourseSectionId_SortOrder",
                table: "Lessons",
                columns: new[] { "CourseSectionId", "SortOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_Lessons_PrimaryVideoMediaAssetId",
                table: "Lessons",
                column: "PrimaryVideoMediaAssetId");

            migrationBuilder.CreateIndex(
                name: "IX_MediaAssets_OwnerUserId",
                table: "MediaAssets",
                column: "OwnerUserId");

            migrationBuilder.CreateIndex(
                name: "IX_MediaAssets_SourceMediaAssetId",
                table: "MediaAssets",
                column: "SourceMediaAssetId");

            migrationBuilder.CreateIndex(
                name: "IX_MediaAssets_StorageKey",
                table: "MediaAssets",
                column: "StorageKey",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Notifications_RecipientUserId_IsRead_CreatedAt",
                table: "Notifications",
                columns: new[] { "RecipientUserId", "IsRead", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_PointTransactions_EnrollmentId",
                table: "PointTransactions",
                column: "EnrollmentId");

            migrationBuilder.CreateIndex(
                name: "IX_PointTransactions_OperationKey",
                table: "PointTransactions",
                column: "OperationKey",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PointTransactions_UserId_CreatedAt",
                table: "PointTransactions",
                columns: new[] { "UserId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningResults_MediaAssetId_ContentHash",
                table: "ScreeningResults",
                columns: new[] { "MediaAssetId", "ContentHash" });

            migrationBuilder.CreateIndex(
                name: "IX_SubmissionAttachments_MediaAssetId",
                table: "SubmissionAttachments",
                column: "MediaAssetId");

            migrationBuilder.CreateIndex(
                name: "IX_SubmissionAttachments_TaskSubmissionId_MediaAssetId",
                table: "SubmissionAttachments",
                columns: new[] { "TaskSubmissionId", "MediaAssetId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TaskAttachments_CourseTaskId_MediaAssetId",
                table: "TaskAttachments",
                columns: new[] { "CourseTaskId", "MediaAssetId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TaskAttachments_MediaAssetId",
                table: "TaskAttachments",
                column: "MediaAssetId");

            migrationBuilder.CreateIndex(
                name: "IX_TaskSubmissionReviews_ReviewerUserId",
                table: "TaskSubmissionReviews",
                column: "ReviewerUserId");

            migrationBuilder.CreateIndex(
                name: "IX_TaskSubmissionReviews_TaskSubmissionId",
                table: "TaskSubmissionReviews",
                column: "TaskSubmissionId");

            migrationBuilder.CreateIndex(
                name: "IX_TaskSubmissions_CourseTaskId",
                table: "TaskSubmissions",
                column: "CourseTaskId");

            migrationBuilder.CreateIndex(
                name: "IX_TaskSubmissions_EnrollmentId_CourseTaskId_AttemptNumber",
                table: "TaskSubmissions",
                columns: new[] { "EnrollmentId", "CourseTaskId", "AttemptNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_UserCategories_CategoryId",
                table: "UserCategories",
                column: "CategoryId");

            migrationBuilder.AddForeignKey(
                name: "FK_AdminActivityLogs_CourseVersions_CourseId_CourseVersionId",
                table: "AdminActivityLogs",
                columns: new[] { "CourseId", "CourseVersionId" },
                principalTable: "CourseVersions",
                principalColumns: new[] { "CourseId", "Id" });

            migrationBuilder.AddForeignKey(
                name: "FK_AdminActivityLogs_Courses_CourseId",
                table: "AdminActivityLogs",
                column: "CourseId",
                principalTable: "Courses",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Certificates_Enrollments_EnrollmentId",
                table: "Certificates",
                column: "EnrollmentId",
                principalTable: "Enrollments",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_CourseAppeals_CourseWarnings_CourseId_CourseWarningId",
                table: "CourseAppeals",
                columns: new[] { "CourseId", "CourseWarningId" },
                principalTable: "CourseWarnings",
                principalColumns: new[] { "CourseId", "Id" });

            migrationBuilder.AddForeignKey(
                name: "FK_CourseAppeals_Courses_CourseId",
                table: "CourseAppeals",
                column: "CourseId",
                principalTable: "Courses",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_CourseReports_CourseVersions_CourseId_CourseVersionId",
                table: "CourseReports",
                columns: new[] { "CourseId", "CourseVersionId" },
                principalTable: "CourseVersions",
                principalColumns: new[] { "CourseId", "Id" });

            migrationBuilder.AddForeignKey(
                name: "FK_CourseReports_Courses_CourseId",
                table: "CourseReports",
                column: "CourseId",
                principalTable: "Courses",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_CourseReports_Lessons_LessonId",
                table: "CourseReports",
                column: "LessonId",
                principalTable: "Lessons",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_CourseReviewDecisions_CourseVersions_CourseVersionId",
                table: "CourseReviewDecisions",
                column: "CourseVersionId",
                principalTable: "CourseVersions",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_CourseReviews_Enrollments_EnrollmentId",
                table: "CourseReviews",
                column: "EnrollmentId",
                principalTable: "Enrollments",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Courses_CourseVersions_Id_DraftVersionId",
                table: "Courses",
                columns: new[] { "Id", "DraftVersionId" },
                principalTable: "CourseVersions",
                principalColumns: new[] { "CourseId", "Id" });

            migrationBuilder.AddForeignKey(
                name: "FK_Courses_CourseVersions_Id_PublishedVersionId",
                table: "Courses",
                columns: new[] { "Id", "PublishedVersionId" },
                principalTable: "CourseVersions",
                principalColumns: new[] { "CourseId", "Id" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_CourseVersions_Categories_CategoryId",
                table: "CourseVersions");

            migrationBuilder.DropForeignKey(
                name: "FK_Courses_CourseVersions_Id_DraftVersionId",
                table: "Courses");

            migrationBuilder.DropForeignKey(
                name: "FK_Courses_CourseVersions_Id_PublishedVersionId",
                table: "Courses");

            migrationBuilder.DropTable(
                name: "AdminActivityLogs");

            migrationBuilder.DropTable(
                name: "Announcements");

            migrationBuilder.DropTable(
                name: "CategoryAdminAssignments");

            migrationBuilder.DropTable(
                name: "Certificates");

            migrationBuilder.DropTable(
                name: "CourseAppeals");

            migrationBuilder.DropTable(
                name: "CourseReviewDecisions");

            migrationBuilder.DropTable(
                name: "CourseReviews");

            migrationBuilder.DropTable(
                name: "LessonAttachments");

            migrationBuilder.DropTable(
                name: "LessonProgress");

            migrationBuilder.DropTable(
                name: "Notifications");

            migrationBuilder.DropTable(
                name: "PointTransactions");

            migrationBuilder.DropTable(
                name: "ScreeningResults");

            migrationBuilder.DropTable(
                name: "SubmissionAttachments");

            migrationBuilder.DropTable(
                name: "TaskAttachments");

            migrationBuilder.DropTable(
                name: "TaskSubmissionReviews");

            migrationBuilder.DropTable(
                name: "UserCategories");

            migrationBuilder.DropTable(
                name: "Wallets");

            migrationBuilder.DropTable(
                name: "CourseWarnings");

            migrationBuilder.DropTable(
                name: "TaskSubmissions");

            migrationBuilder.DropTable(
                name: "CourseReports");

            migrationBuilder.DropTable(
                name: "CourseTasks");

            migrationBuilder.DropTable(
                name: "Enrollments");

            migrationBuilder.DropTable(
                name: "Lessons");

            migrationBuilder.DropTable(
                name: "CourseSections");

            migrationBuilder.DropTable(
                name: "Categories");

            migrationBuilder.DropTable(
                name: "CourseVersions");

            migrationBuilder.DropTable(
                name: "Courses");

            migrationBuilder.DropTable(
                name: "MediaAssets");
        }
    }
}
