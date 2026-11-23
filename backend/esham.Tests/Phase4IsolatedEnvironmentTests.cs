using System.Text.Json;
using esham.BLL.Services;
using esham.DAL.Data;
using esham.DAL.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
using static esham.Tests.AccountFinalizationTests;
namespace esham.Tests;
public sealed class Phase4SetupFactAttribute(string action):FactAttribute {
    public override string? Skip{get;set;}=Environment.GetEnvironmentVariable("ESHAM_PHASE4_SETUP")==action&&EnrollmentSqlServerTests.Configured()?null:"Explicit guarded Phase4 action only.";
}
public sealed class Phase4IsolatedEnvironmentTests
{
    internal static string Root(){var root=Path.GetFullPath(Environment.GetEnvironmentVariable("ESHAM_PHASE4_ARTIFACTS")??throw new InvalidOperationException("Private fixture directory required."));if(!root.EndsWith(Path.Combine("artifacts","phase4-isolated"),StringComparison.OrdinalIgnoreCase)&&!root.EndsWith(Path.Combine("artifacts","phase4-hardening","browser"),StringComparison.OrdinalIgnoreCase)&&!root.EndsWith(Path.Combine("artifacts","phase5-isolated","phase4-regression"),StringComparison.OrdinalIgnoreCase))throw new InvalidOperationException("Dedicated Phase4 directory required.");Directory.CreateDirectory(root);return root;}
    private static async Task<string> Financial(AppDbContext db,Guid e)=>JsonSerializer.Serialize(new {
        enrollment=await db.Enrollments.Where(x=>x.Id==e).Select(x=>new{x.Id,x.CourseId,x.CourseVersionId,x.LearnerUserId,x.EnrolledAt}).SingleAsync(),
        wallets=await db.Wallets.Where(x=>db.Enrollments.Any(y=>y.Id==e&&(y.LearnerUserId==x.UserId||y.Course.OwnerUserId==x.UserId))).OrderBy(x=>x.UserId).Select(x=>new{x.UserId,x.Balance,x.UpdatedAt}).ToListAsync(),
        ledger=await db.PointTransactions.Where(x=>x.EnrollmentId==e).OrderBy(x=>x.Id).Select(x=>new{x.Id,x.Amount,x.UserId}).ToListAsync(),
        receipts=await db.EnrollmentVersionAccess.Where(x=>x.EnrollmentId==e).OrderBy(x=>x.Id).ToListAsync()});
    [Phase4SetupFact("fixtures")]public async Task Prepare_fresh_Phase4_browser_graph(){
        using var p=await CompletionSqlServerTests.Provider();var f=await LessonProgressSqlServerTests.Fixture(p);using var scope=p.CreateScope();var s=scope.ServiceProvider;var db=s.GetRequiredService<AppDbContext>();Assert.True(await CompletionSqlServerTests.Gate(db).IsEnabledAsync());
        var task=new CourseTask{CourseVersionId=f.Purchase.Version,TitleEn="Phase4 required task"};var sub=new TaskSubmission{EnrollmentId=f.Enrollment,CourseTaskId=task.Id,Status="awaitingReview",SubmittedAt=DateTimeOffset.UtcNow,AnswerText="Synthetic Phase4 work"};db.AddRange(task,sub);await db.SaveChangesAsync();
        var other=await Seed(s);await s.GetRequiredService<AccountService>().UpdateCurrentProfileAsync(Principal(other),Profile("learner","p4_"+other.Replace("-","")[..12]));var admin=await Seed(s,true);
        async Task<object> User(string id){var u=await db.Users.SingleAsync(x=>x.Id==id);return new{id,email=u.Email,password=Password};}
        var fixture=new{learner=await User(f.Purchase.Learner),instructor=await User(f.Purchase.Owner),otherLearner=await User(other),admin=await User(admin),enrollmentId=f.Enrollment,courseId=f.Purchase.Course,versionId=f.Purchase.Version,videoLessonId=f.Lesson,articleLessonId=f.Article,submissionId=sub.Id,before=await Financial(db,f.Enrollment)};
        var path=Path.Combine(Root(),"browser-fixtures-"+Guid.NewGuid().ToString("N")+".json");await File.WriteAllTextAsync(path,JsonSerializer.Serialize(fixture));await File.WriteAllTextAsync(Path.Combine(Root(),"current-fixture-path.txt"),path);
        await using var command=db.Database.GetDbConnection().CreateCommand();await db.Database.OpenConnectionAsync();command.CommandText="SELECT DB_NAME(),CONVERT(int,SERVERPROPERTY('IsLocalDB')),CONVERT(nvarchar(128),SERVERPROPERTY('ServerName'))";await using var reader=await command.ExecuteReaderAsync();await reader.ReadAsync();await File.WriteAllTextAsync(Path.Combine(Root(),"database-identity.json"),JsonSerializer.Serialize(new{database=reader.GetString(0),isLocalDb=reader.GetInt32(1),server=reader.GetString(2)}));
    }
    [Phase4SetupFact("invariants")]public async Task Verify_browser_financial_receipt_and_certificate_invariants(){
        using var p=await CompletionSqlServerTests.Provider();using var scope=p.CreateScope();var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();using var json=JsonDocument.Parse(await File.ReadAllTextAsync(await File.ReadAllTextAsync(Path.Combine(Root(),"current-fixture-path.txt"))));var f=json.RootElement;var e=f.GetProperty("enrollmentId").GetGuid();Assert.Equal(f.GetProperty("before").GetString(),await Financial(db,e));
        var enrollment=await db.Enrollments.SingleAsync(x=>x.Id==e);Assert.Equal("completed",enrollment.Status);Assert.NotNull(enrollment.CompletedAt);var cert=await db.Certificates.SingleAsync(x=>x.EnrollmentId==e);Assert.Equal("revoked",cert.Status);Assert.Equal(1,await db.Notifications.CountAsync(x=>x.Id==cert.Id));Assert.Equal(1,await db.AdminActivityLogs.CountAsync(x=>x.TargetId==cert.Id.ToString("D")));Assert.Equal(1,await db.TaskSubmissionReviews.CountAsync(x=>x.TaskSubmissionId==f.GetProperty("submissionId").GetGuid()));
        await File.WriteAllTextAsync(Path.Combine(Root(),"persisted-invariants.json"),JsonSerializer.Serialize(new{passed=true,originalReceiptAndWalletLedgerUnchanged=true,certificates=1,certificateNotifications=1,revocations=1}));
    }
}
