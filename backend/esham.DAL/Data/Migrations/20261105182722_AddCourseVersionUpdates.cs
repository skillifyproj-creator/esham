using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace esham.DAL.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddCourseVersionUpdates : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(name: "IsOptionalAtCreation", table: "TaskSubmissions", type: "bit", nullable: true);
            migrationBuilder.AddColumn<Guid>(
                name: "LogicalLessonId",
                table: "Lessons",
                type: "uniqueidentifier",
                nullable: false,
                defaultValueSql: "NEWID()");

            migrationBuilder.AddColumn<Guid>(
                name: "LogicalTaskId",
                table: "CourseTasks",
                type: "uniqueidentifier",
                nullable: false,
                defaultValueSql: "NEWID()");

            // Each existing row starts its own lineage. Never infer historical clones by title/order/media.
            migrationBuilder.Sql("UPDATE [Lessons] SET [LogicalLessonId] = [Id]; UPDATE [CourseTasks] SET [LogicalTaskId] = [Id];");

            migrationBuilder.AddColumn<Guid>(
                name: "CourseVersionId",
                table: "CourseReviews",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "CourseVersionId",
                table: "Certificates",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddUniqueConstraint(
                name: "AK_Enrollments_Id_CourseId",
                table: "Enrollments",
                columns: new[] { "Id", "CourseId" });

            migrationBuilder.CreateTable(
                name: "EnrollmentVersionAccess",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EnrollmentId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CourseId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CourseVersionId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PreviousCourseVersionId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    GrantedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    Reason = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    WasCourseCompleted = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EnrollmentVersionAccess", x => x.Id);
                    table.CheckConstraint("CK_EnrollmentVersionAccess_Reason", "[Reason] IN ('enrolled','publication','baseline')");
                    table.ForeignKey(
                        name: "FK_EnrollmentVersionAccess_CourseVersions_CourseId_CourseVersionId",
                        columns: x => new { x.CourseId, x.CourseVersionId },
                        principalTable: "CourseVersions",
                        principalColumns: new[] { "CourseId", "Id" });
                    table.ForeignKey(
                        name: "FK_EnrollmentVersionAccess_CourseVersions_CourseId_PreviousCourseVersionId",
                        columns: x => new { x.CourseId, x.PreviousCourseVersionId },
                        principalTable: "CourseVersions",
                        principalColumns: new[] { "CourseId", "Id" });
                    table.ForeignKey(
                        name: "FK_EnrollmentVersionAccess_Enrollments_EnrollmentId_CourseId",
                        columns: x => new { x.EnrollmentId, x.CourseId },
                        principalTable: "Enrollments",
                        principalColumns: new[] { "Id", "CourseId" });
                });

            migrationBuilder.CreateIndex(
                name: "IX_Lessons_CourseSectionId_LogicalLessonId",
                table: "Lessons",
                columns: new[] { "CourseSectionId", "LogicalLessonId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Lessons_LogicalLessonId",
                table: "Lessons",
                column: "LogicalLessonId");

            migrationBuilder.CreateIndex(
                name: "IX_CourseTasks_CourseVersionId_LogicalTaskId",
                table: "CourseTasks",
                columns: new[] { "CourseVersionId", "LogicalTaskId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CourseTasks_LogicalTaskId",
                table: "CourseTasks",
                column: "LogicalTaskId");

            migrationBuilder.CreateIndex(
                name: "IX_CourseReviews_CourseVersionId",
                table: "CourseReviews",
                column: "CourseVersionId");

            migrationBuilder.CreateIndex(
                name: "IX_Certificates_CourseVersionId",
                table: "Certificates",
                column: "CourseVersionId");

            migrationBuilder.CreateIndex(
                name: "IX_EnrollmentVersionAccess_CourseId_CourseVersionId",
                table: "EnrollmentVersionAccess",
                columns: new[] { "CourseId", "CourseVersionId" });

            migrationBuilder.CreateIndex(
                name: "IX_EnrollmentVersionAccess_CourseId_PreviousCourseVersionId",
                table: "EnrollmentVersionAccess",
                columns: new[] { "CourseId", "PreviousCourseVersionId" });

            migrationBuilder.CreateIndex(
                name: "IX_EnrollmentVersionAccess_EnrollmentId_CourseId",
                table: "EnrollmentVersionAccess",
                columns: new[] { "EnrollmentId", "CourseId" });

            migrationBuilder.CreateIndex(
                name: "IX_EnrollmentVersionAccess_EnrollmentId_CourseVersionId",
                table: "EnrollmentVersionAccess",
                columns: new[] { "EnrollmentId", "CourseVersionId" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Certificates_CourseVersions_CourseVersionId",
                table: "Certificates",
                column: "CourseVersionId",
                principalTable: "CourseVersions",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_CourseReviews_CourseVersions_CourseVersionId",
                table: "CourseReviews",
                column: "CourseVersionId",
                principalTable: "CourseVersions",
                principalColumn: "Id");

            // Availability at deployment is known; earlier unseen publication history is not reconstructed.
            // Existing certificates/reviews retain nullable attribution rather than guessing an earned version.
            migrationBuilder.Sql(@"
INSERT INTO [EnrollmentVersionAccess] ([Id],[EnrollmentId],[CourseId],[CourseVersionId],[PreviousCourseVersionId],[GrantedAt],[Reason],[WasCourseCompleted])
SELECT NEWID(),e.[Id],e.[CourseId],e.[CourseVersionId],NULL,SYSUTCDATETIME(),'baseline',
       CASE WHEN e.[Status]='completed' OR e.[CompletedAt] IS NOT NULL THEN 1 ELSE 0 END
FROM [Enrollments] e
WHERE e.[Status] IN ('active','completed');
INSERT INTO [EnrollmentVersionAccess] ([Id],[EnrollmentId],[CourseId],[CourseVersionId],[PreviousCourseVersionId],[GrantedAt],[Reason],[WasCourseCompleted])
SELECT NEWID(),e.[Id],e.[CourseId],c.[PublishedVersionId],e.[CourseVersionId],SYSUTCDATETIME(),'baseline',
       CASE WHEN e.[Status]='completed' OR e.[CompletedAt] IS NOT NULL THEN 1 ELSE 0 END
FROM [Enrollments] e
JOIN [Courses] c ON c.[Id]=e.[CourseId]
JOIN [CourseVersions] v ON v.[Id]=c.[PublishedVersionId] AND v.[CourseId]=c.[Id]
JOIN [Categories] cat ON cat.[Id]=v.[CategoryId]
WHERE e.[Status] IN ('active','completed') AND c.[SafetyStatus]='active' AND v.[ReviewStatus]='approved'
  AND cat.[IsActive]=1 AND c.[PublishedVersionId]<>e.[CourseVersionId];");

        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "IsOptionalAtCreation", table: "TaskSubmissions");
            migrationBuilder.DropForeignKey(
                name: "FK_Certificates_CourseVersions_CourseVersionId",
                table: "Certificates");

            migrationBuilder.DropForeignKey(
                name: "FK_CourseReviews_CourseVersions_CourseVersionId",
                table: "CourseReviews");

            migrationBuilder.DropTable(
                name: "EnrollmentVersionAccess");

            migrationBuilder.DropIndex(
                name: "IX_Lessons_CourseSectionId_LogicalLessonId",
                table: "Lessons");

            migrationBuilder.DropIndex(
                name: "IX_Lessons_LogicalLessonId",
                table: "Lessons");

            migrationBuilder.DropUniqueConstraint(
                name: "AK_Enrollments_Id_CourseId",
                table: "Enrollments");

            migrationBuilder.DropIndex(
                name: "IX_CourseTasks_CourseVersionId_LogicalTaskId",
                table: "CourseTasks");

            migrationBuilder.DropIndex(
                name: "IX_CourseTasks_LogicalTaskId",
                table: "CourseTasks");

            migrationBuilder.DropIndex(
                name: "IX_CourseReviews_CourseVersionId",
                table: "CourseReviews");

            migrationBuilder.DropIndex(
                name: "IX_Certificates_CourseVersionId",
                table: "Certificates");

            migrationBuilder.DropColumn(
                name: "LogicalLessonId",
                table: "Lessons");

            migrationBuilder.DropColumn(
                name: "LogicalTaskId",
                table: "CourseTasks");

            migrationBuilder.DropColumn(
                name: "CourseVersionId",
                table: "CourseReviews");

            migrationBuilder.DropColumn(
                name: "CourseVersionId",
                table: "Certificates");
        }
    }
}
