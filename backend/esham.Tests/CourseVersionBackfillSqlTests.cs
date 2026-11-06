using esham.DAL.Data;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Xunit;
namespace esham.Tests;

public sealed class VersionLocalDbFactAttribute : FactAttribute
{
    public VersionLocalDbFactAttribute()
    {
        var value=Environment.GetEnvironmentVariable("ESHAM_ACCOUNT_TEST_SQLSERVER");
        if(Environment.GetEnvironmentVariable("ESHAM_RUN_ISOLATED_SQL_TESTS")!="1" || string.IsNullOrWhiteSpace(value)
            || !new SqlConnectionStringBuilder(value).DataSource.StartsWith("(localdb)\\",StringComparison.OrdinalIgnoreCase))
            Skip="Requires explicit isolated LocalDB opt-in; never creates a hosted database.";
    }
}
public sealed class CourseVersionBackfillSqlTests
{
    [VersionLocalDbFact] public async Task Additive_migration_preserves_populated_legacy_data_without_inventing_lineage_or_notifications()
    {
        var parsed=new SqlConnectionStringBuilder(Environment.GetEnvironmentVariable("ESHAM_ACCOUNT_TEST_SQLSERVER"));
        Assert.StartsWith("Esham_AccountTests_",parsed.InitialCatalog);parsed.InitialCatalog="Esham_AccountTests_Backfill_"+Guid.NewGuid().ToString("N");
        await using var db=new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlServer(parsed.ConnectionString).Options);
        await db.GetService<IMigrator>().MigrateAsync("20261023195532_AddEshamDomainModel");
        await db.Database.ExecuteSqlRawAsync(@"
DECLARE @now datetimeoffset=SYSUTCDATETIME();
INSERT INTO AspNetUsers (Id,UserName,NormalizedUserName,EmailConfirmed,PhoneNumberConfirmed,TwoFactorEnabled,LockoutEnabled,AccessFailedCount,Interests,TeachingAreas,CustomSkills)
VALUES ('owner','owner','OWNER',0,0,0,0,0,'[]','[]','[]'),('active','active','ACTIVE',0,0,0,0,0,'[]','[]','[]'),('done','done','DONE',0,0,0,0,0,'[]','[]','[]'),('canceled','canceled','CANCELED',0,0,0,0,0,'[]','[]','[]');
INSERT INTO Categories (Id,NameAr,NameEn,IsActive,DisplayOrder,CreatedAt,UpdatedAt)
VALUES ('10000000-0000-4000-8000-000000000001','Category','Category',1,0,@now,@now);
INSERT INTO Courses (Id,OwnerUserId,SafetyStatus,EnrollmentPaused,CreatedAt,UpdatedAt)
VALUES ('20000000-0000-4000-8000-000000000001','owner','active',0,@now,@now);
INSERT INTO CourseVersions (Id,CourseId,CategoryId,VersionNumber,TitleEn,Objectives,Language,Level,ReviewStatus,CreatedAt,UpdatedAt,ApprovedAt)
VALUES ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',1,'Same title','[]','en','beginner','approved',@now,@now,@now),
('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',2,'Same title','[]','en','beginner','approved',@now,@now,@now);
UPDATE Courses SET DraftVersionId='30000000-0000-4000-8000-000000000002',PublishedVersionId='30000000-0000-4000-8000-000000000002' WHERE Id='20000000-0000-4000-8000-000000000001';
INSERT INTO CourseSections (Id,CourseVersionId,TitleEn,SortOrder,CreatedAt,UpdatedAt)
VALUES ('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','Same section',0,@now,@now),
('40000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002','Same section',0,@now,@now);
INSERT INTO Lessons (Id,CourseSectionId,TitleEn,ContentType,SortOrder,IsPreview,CreatedAt,UpdatedAt)
VALUES ('50000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','Same lesson','article',0,0,@now,@now),
('50000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000002','Same lesson','article',0,0,@now,@now);
INSERT INTO CourseTasks (Id,CourseVersionId,TitleEn,SortOrder,IsReady,CreatedAt,UpdatedAt)
VALUES ('60000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','Same task',0,1,@now,@now),
('60000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002','Same task',0,1,@now,@now);
INSERT INTO Enrollments (Id,LearnerUserId,CourseId,CourseVersionId,Status,EnrolledAt,CompletedAt)
VALUES ('70000000-0000-4000-8000-000000000001','active','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','active',@now,NULL),
('70000000-0000-4000-8000-000000000002','done','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','completed',@now,@now),
('70000000-0000-4000-8000-000000000003','canceled','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','canceled',@now,NULL);
INSERT INTO LessonProgress (Id,EnrollmentId,LessonId,IsCompleted,CompletedAt,LastPositionSeconds,UpdatedAt)
VALUES (NEWID(),'70000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',1,@now,90,@now);
INSERT INTO TaskSubmissions (Id,EnrollmentId,CourseTaskId,AttemptNumber,AnswerText,Status,CreatedAt,SubmittedAt)
VALUES ('80000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001',1,'Historical answer','approved',@now,@now);
INSERT INTO Certificates (Id,EnrollmentId,VerificationCode,LearnerNameSnapshot,InstructorNameSnapshot,IssuedAt,Status)
VALUES (NEWID(),'70000000-0000-4000-8000-000000000002','legacy-proof','Original learner','Original instructor',@now,'issued');
INSERT INTO CourseReviews (Id,EnrollmentId,Rating,Comment,CreatedAt,UpdatedAt)
VALUES (NEWID(),'70000000-0000-4000-8000-000000000001',5,'Original review',@now,@now);
");
        await db.Database.MigrateAsync();
        var lessons=await db.Lessons.OrderBy(x=>x.Id).ToListAsync();Assert.All(lessons,x=>Assert.Equal(x.Id,x.LogicalLessonId));Assert.NotEqual(lessons[0].LogicalLessonId,lessons[1].LogicalLessonId);
        Assert.All(await db.CourseTasks.ToListAsync(),x=>Assert.Equal(x.Id,x.LogicalTaskId));
        Assert.Equal(4,await db.EnrollmentVersionAccess.CountAsync());Assert.False(await db.EnrollmentVersionAccess.AnyAsync(x=>x.Enrollment.LearnerUserId=="canceled"));
        Assert.Empty(await db.Notifications.ToListAsync());Assert.Null((await db.Certificates.SingleAsync()).CourseVersionId);Assert.Null((await db.CourseReviews.SingleAsync()).CourseVersionId);
        var progress=await db.LessonProgressRecords.SingleAsync();Assert.True(progress.IsCompleted);Assert.Equal(90,progress.LastPositionSeconds);
        Assert.Equal("Historical answer",(await db.TaskSubmissions.SingleAsync()).AnswerText);
        Assert.Null((await db.TaskSubmissions.SingleAsync()).IsOptionalAtCreation);
        Assert.All(await db.Enrollments.ToListAsync(),x=>Assert.Equal(Guid.Parse("30000000-0000-4000-8000-000000000001"),x.CourseVersionId));
        Assert.NotNull((await db.Enrollments.SingleAsync(x=>x.Status=="completed")).CompletedAt);
    }
}
