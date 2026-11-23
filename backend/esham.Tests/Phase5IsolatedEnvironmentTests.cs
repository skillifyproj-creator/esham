using System.Text.Json;
using esham.BLL.Interfaces;
using esham.BLL.Services;
using esham.DAL.Data;
using esham.DAL.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
using static esham.Tests.AccountFinalizationTests;
namespace esham.Tests;
public sealed class Phase5SetupFact(string action):FactAttribute
{
    public override string? Skip{get;set;}=Environment.GetEnvironmentVariable("ESHAM_PHASE5_SETUP")==action&&EnrollmentSqlServerTests.Configured()?null:"Explicit guarded Phase5 fixture action only.";
}
public sealed class Phase5IsolatedEnvironmentTests
{
    private static string Root(){var p=Path.GetFullPath(Path.Combine(Phase5SqlTests.Artifacts(),"../phase5-isolated"));Directory.CreateDirectory(p);return p;}
    private static object Financial(AppDbContext db,string[] users)=>db.PointTransactions.AsNoTracking().Where(x=>users.Contains(x.UserId)).OrderBy(x=>x.Id).Select(x=>new{x.Id,x.UserId,x.EnrollmentId,x.Amount,x.TransactionType,x.CreatedAt}).ToArray();
    [Phase5SetupFact("fixtures")]public async Task Prepare_fresh_browser_accounts_and_selected_announcements(){
        using var p=await CompletionSqlServerTests.Provider();using var s=p.CreateScope();var db=s.ServiceProvider.GetRequiredService<AppDbContext>();var gate=Phase5Tests.Gate(db);Assert.True(await gate.IsEnabledAsync(Phase5Capability.Reviews));
        await db.Database.OpenConnectionAsync();using(var cmd=db.Database.GetDbConnection().CreateCommand()){cmd.CommandText="SELECT DB_NAME(),CONVERT(int,SERVERPROPERTY('IsLocalDB')),CONVERT(nvarchar(128),SERVERPROPERTY('ServerName'))";using var r=await cmd.ExecuteReaderAsync();Assert.True(await r.ReadAsync());Assert.Equal(CompletionMutationGate.Catalog,r.GetString(0));Assert.Equal(1,r.GetInt32(1));await File.WriteAllTextAsync(Path.Combine(Root(),"database-identity.json"),JsonSerializer.Serialize(new{database=r.GetString(0),isLocalDb=r.GetInt32(1),server=r.GetString(2)}));}await db.Database.CloseConnectionAsync();
        var f=await LessonProgressSqlServerTests.Fixture(p);var category=await db.CourseVersions.Where(x=>x.Id==f.Purchase.Version).Select(x=>x.CategoryId).SingleAsync();
        var other=await Seed(s.ServiceProvider);var security=await Seed(s.ServiceProvider);var admin=await Seed(s.ServiceProvider,true);
        var manager=s.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        foreach(var (id,role) in new[]{(f.Purchase.Learner,"both"),(f.Purchase.Owner,"instructor"),(other,"learner"),(security,"learner")}){
            var user=(await manager.FindByIdAsync(id))!;Http(s.ServiceProvider,id);var command=Profile(role,"p5_"+Guid.NewGuid().ToString("N")[..12]) with{Interests=[],TeachingAreas=[],LearningCategoryIds=role=="instructor"?null:[category],TeachingCategoryIds=role=="learner"?null:[category]};
            Assert.Equal(AccountFailure.None,(await s.ServiceProvider.GetRequiredService<AccountService>().UpdateCurrentProfileAsync(Principal(id),command)).Failure);
        }
        var learnerNotice=new Announcement{AuthorUserId=admin,Audience="learners",Status="published",PublishedAt=DateTimeOffset.UtcNow,TitleEn="Phase5 learner announcement",TitleAr="إعلان المتعلّمين",ContentEn="Synthetic isolated audience delivery.",ContentAr="إعلان تجريبي معزول للمتعلّمين."};
        var instructorNotice=new Announcement{AuthorUserId=admin,Audience="instructors",Status="published",PublishedAt=DateTimeOffset.UtcNow,TitleEn="Phase5 instructor announcement",ContentEn="Synthetic isolated instructor audience."};db.AddRange(learnerNotice,instructorNotice);await db.SaveChangesAsync();
        async Task<object> Account(string id){var u=(await manager.FindByIdAsync(id))!;return new{id,email=u.Email,password=Password};}
        var ids=new[]{f.Purchase.Learner,f.Purchase.Owner,other,security,admin};var file=Path.Combine(Root(),"browser-fixtures-"+Guid.NewGuid().ToString("N")+".json");
        await File.WriteAllTextAsync(file,JsonSerializer.Serialize(new{learner=await Account(f.Purchase.Learner),instructor=await Account(f.Purchase.Owner),otherLearner=await Account(other),security=await Account(security),admin=await Account(admin),enrollmentId=f.Enrollment,courseId=f.Purchase.Course,versionId=f.Purchase.Version,lessons=new[]{f.Lesson,f.Article},announcementIds=new[]{learnerNotice.Id,instructorNotice.Id},recipients=ids,financialBefore=Financial(db,ids)}));
        await File.WriteAllTextAsync(Path.Combine(Root(),"current-fixture-path.txt"),file);
    }
    [Phase5SetupFact("legacy-review")]public async Task Prepare_selected_synthetic_legacy_review_without_version_attribution(){
        using var p=await CompletionSqlServerTests.Provider();using var s=p.CreateScope();var db=s.ServiceProvider.GetRequiredService<AppDbContext>();
        using var data=JsonDocument.Parse(await File.ReadAllTextAsync((await File.ReadAllTextAsync(Path.Combine(Root(),"current-fixture-path.txt"))).Trim()));var f=data.RootElement;var id=f.GetProperty("enrollmentId").GetGuid();var owner=f.GetProperty("learner").GetProperty("id").GetString();
        var enrollment=await db.Enrollments.SingleAsync(x=>x.Id==id&&x.LearnerUserId==owner&&x.CourseId==f.GetProperty("courseId").GetGuid());Assert.False(await db.CourseReviews.AnyAsync(x=>x.EnrollmentId==id));
        db.CourseReviews.Add(new(){EnrollmentId=id,Rating=4,Comment="A synthetic historical review with intentionally unknown version attribution."});await db.SaveChangesAsync();
    }
    [Phase5SetupFact("deliver")]public async Task Deliver_only_selected_synthetic_announcements(){
        using var p=await CompletionSqlServerTests.Provider();using var data=JsonDocument.Parse(await File.ReadAllTextAsync((await File.ReadAllTextAsync(Path.Combine(Root(),"current-fixture-path.txt"))).Trim()));var recipients=data.RootElement.GetProperty("recipients").EnumerateArray().Select(x=>x.GetString()!).ToArray();
        using var beforeScope=p.CreateScope();var beforeDb=beforeScope.ServiceProvider.GetRequiredService<AppDbContext>();var before=await beforeDb.Notifications.AsNoTracking().Where(x=>recipients.Contains(x.RecipientUserId)&&x.NotificationType=="announcement.published").ToDictionaryAsync(x=>x.Id);
        foreach(var id in data.RootElement.GetProperty("announcementIds").EnumerateArray().Select(x=>x.GetGuid())){using var s=p.CreateScope();await Phase5SqlTests.Delivery(s.ServiceProvider,id,recipients).RecoverAsync();}
        foreach(var entry in before){var current=await beforeDb.Notifications.AsNoTracking().SingleAsync(x=>x.Id==entry.Key);Assert.Equal(entry.Value.IsRead,current.IsRead);Assert.Equal(entry.Value.ReadAt,current.ReadAt);Assert.Equal(entry.Value.CreatedAt,current.CreatedAt);}
    }
    [Phase5SetupFact("invariants")]public async Task Verify_financial_receipt_review_audit_and_certificate_invariants(){
        using var p=await CompletionSqlServerTests.Provider();using var s=p.CreateScope();var db=s.ServiceProvider.GetRequiredService<AppDbContext>();using var data=JsonDocument.Parse(await File.ReadAllTextAsync((await File.ReadAllTextAsync(Path.Combine(Root(),"current-fixture-path.txt"))).Trim()));var f=data.RootElement;
        var ids=f.GetProperty("recipients").EnumerateArray().Select(x=>x.GetString()!).ToArray();Assert.Equal(f.GetProperty("financialBefore").GetRawText(),JsonSerializer.Serialize(Financial(db,ids)));
        foreach(var (kind,balance) in new[]{("learner",0),("instructor",40),("otherLearner",20),("security",20)}){var id=f.GetProperty(kind).GetProperty("id").GetString()!;Assert.Equal(balance,(await db.Wallets.SingleAsync(x=>x.UserId==id)).Balance);Assert.Equal(balance,await db.PointTransactions.Where(x=>x.UserId==id).SumAsync(x=>x.Amount));}
        var e=await db.Enrollments.SingleAsync(x=>x.Id==f.GetProperty("enrollmentId").GetGuid());Assert.Equal(f.GetProperty("versionId").GetGuid(),e.CourseVersionId);Assert.Equal("completed",e.Status);Assert.NotNull(e.CompletedAt);Assert.Equal(1,await db.Certificates.CountAsync(x=>x.EnrollmentId==e.Id));Assert.Equal(1,await db.EnrollmentVersionAccess.CountAsync(x=>x.EnrollmentId==e.Id));Assert.False(await db.CourseReviews.AnyAsync(x=>x.EnrollmentId==e.Id));Assert.True(await db.AdminActivityLogs.AnyAsync(x=>x.CourseId==e.CourseId&&x.Action=="learner.review.moderate"));
        var certificate=await db.Certificates.SingleAsync(x=>x.EnrollmentId==e.Id);Assert.Equal(e.CompletedAt,certificate.IssuedAt);Assert.NotEqual("Changed synthetic profile",certificate.LearnerNameSnapshot);
        await File.WriteAllTextAsync(Path.Combine(Root(),"persisted-invariants.json"),JsonSerializer.Serialize(new{passed=true,ledgerSnapshotUnchanged=true,walletBalancesMatchLedger=true,purchasedVersionUnchanged=true,certificateCount=1,withdrawnReviewRetainedInAudit=true}));
    }
}
