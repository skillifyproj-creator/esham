using System.Text.Json;
using esham.BLL.Services;
using esham.DAL.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
using static esham.Tests.AccountFinalizationTests;
namespace esham.Tests;
public sealed class Phase3SetupFactAttribute(string action):FactAttribute {
    public override string? Skip{get;set;}=Environment.GetEnvironmentVariable("ESHAM_PHASE3_SETUP")==action&&EnrollmentSqlServerTests.Configured()?null:"Explicit guarded Phase 3 fixture action only.";
}
public sealed class Phase3IsolatedEnvironmentTests
{
    private static string Root(){var path=Path.GetFullPath(Environment.GetEnvironmentVariable("ESHAM_PHASE3_ARTIFACTS")??throw new InvalidOperationException("Phase3 artifacts required."));
        if(!path.EndsWith(Path.Combine("artifacts","phase3-isolated"),StringComparison.OrdinalIgnoreCase))throw new InvalidOperationException("Dedicated Phase3 artifacts required.");Directory.CreateDirectory(path);return path;}
    [Phase3SetupFact("fixtures")] public async Task Fresh_synthetic_submission_browser_fixture(){
        using var p=await SubmissionSqlServerTests.Provider();var f=await SubmissionSqlServerTests.Setup(p);using var scope=p.CreateScope();var s=scope.ServiceProvider;var db=s.GetRequiredService<AppDbContext>();
        Assert.True(await SubmissionSqlServerTests.Gate(db).IsEnabledAsync());
        var task=await db.CourseTasks.SingleAsync(t=>t.Id==f.Task);task.DescriptionAr="طبّق المهارة واشرح عملك";task.DescriptionEn="Apply the skill and explain your work";await db.SaveChangesAsync();
        var other=await Seed(s);await s.GetRequiredService<AccountService>().UpdateCurrentProfileAsync(Principal(other),Profile("learner","p3_"+other.Replace("-","")[..12]));
        var learner=await db.Users.SingleAsync(x=>x.Id==f.Actor);var owner=await db.Users.SingleAsync(x=>x.Id==f.Learning.Purchase.Owner);var foreign=await db.Users.SingleAsync(x=>x.Id==other);
        var before=LearnerSubmissionTests.StripAttempts(await Phase2IsolatedEnvironmentTests.Snapshot(db,f.Enrollment,f.Actor,owner.Id));
        var value=new{learner=new{id=learner.Id,email=learner.Email,password=Password},instructor=new{id=owner.Id,email=owner.Email,password=Password},otherLearner=new{id=foreign.Id,email=foreign.Email,password=Password},enrollmentId=f.Enrollment,courseId=f.Learning.Purchase.Course,versionId=f.Version,taskId=f.Task,before};
        var file=Path.Combine(Root(),"browser-fixtures-"+Guid.NewGuid().ToString("N")+".json");await File.WriteAllTextAsync(file,JsonSerializer.Serialize(value));await File.WriteAllTextAsync(Path.Combine(Root(),"current-fixture-path.txt"),file);
        await File.WriteAllBytesAsync(Path.Combine(Root(),"synthetic.docx"),SubmissionFileTests.Docx());
        var pdf="%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Count 0 /Kids [] >>\nendobj\n";
        var offset=System.Text.Encoding.ASCII.GetByteCount(pdf);var one=pdf.IndexOf("1 0 obj",StringComparison.Ordinal);var two=pdf.IndexOf("2 0 obj",StringComparison.Ordinal);
        pdf+=$"xref\n0 3\n0000000000 65535 f \n{one:D10} 00000 n \n{two:D10} 00000 n \ntrailer\n<< /Size 3 /Root 1 0 R >>\nstartxref\n{offset}\n%%EOF\n";
        await File.WriteAllTextAsync(Path.Combine(Root(),"synthetic.pdf"),pdf,new System.Text.ASCIIEncoding());
    }
    [Phase3SetupFact("invariants")] public async Task Verify_submission_browser_invariants(){
        using var p=await SubmissionSqlServerTests.Provider();using var scope=p.CreateScope();var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();
        using var json=JsonDocument.Parse(await File.ReadAllTextAsync(await File.ReadAllTextAsync(Path.Combine(Root(),"current-fixture-path.txt"))));var f=json.RootElement;
        var e=f.GetProperty("enrollmentId").GetGuid();var learner=f.GetProperty("learner").GetProperty("id").GetString()!;var owner=f.GetProperty("instructor").GetProperty("id").GetString()!;
        Assert.Equal(f.GetProperty("before").GetString(),LearnerSubmissionTests.StripAttempts(await Phase2IsolatedEnvironmentTests.Snapshot(db,e,learner,owner)));
        var attempts=await db.TaskSubmissions.AsNoTracking().Where(x=>x.EnrollmentId==e).OrderBy(x=>x.AttemptNumber).ToListAsync();
        Assert.Equal(3,attempts.Count);Assert.Equal(new[]{"rejected","approved","rejected"},attempts.Select(x=>x.Status));Assert.Equal(new[]{1,2,3},attempts.Select(x=>x.AttemptNumber));Assert.True(attempts[2].IsOptionalAtCreation);
        Assert.Equal(3,await db.Notifications.CountAsync(x=>x.NotificationType=="task.submitted"&&x.RecipientUserId==owner));Assert.Equal(3,await db.Notifications.CountAsync(x=>x.NotificationType=="task.assessed"&&x.RecipientUserId==learner));
        Assert.False(await db.LessonProgressRecords.AnyAsync(x=>x.EnrollmentId==e));
        await File.WriteAllTextAsync(Path.Combine(Root(),"persisted-invariants.json"),JsonSerializer.Serialize(new{passed=true,attempts=3,notifications=6,financialAttributionCompletionCertificatesAndProgressUnchanged=true}));
    }
}
