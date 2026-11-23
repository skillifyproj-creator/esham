using System.Security.Claims;
using System.Text.Json;
using esham.BLL.DTOs;
using esham.BLL.DTOs.Reviews;
using esham.BLL.Interfaces;
using esham.BLL.Services;
using esham.DAL.Data;
using esham.DAL.Entities;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Xunit;
using static esham.Tests.AccountFinalizationTests;
namespace esham.Tests;
public sealed class Phase5Tests
{
    internal sealed class MemoryGate(AppDbContext db,bool enabled=true):IPhase5MutationGate{public Task<bool> IsEnabledAsync(Phase5Capability c,CancellationToken ct=default)=>db.Database.IsInMemory()?Task.FromResult(enabled):throw new InvalidOperationException("Memory-only test gate.");}
    internal static IPhase5MutationGate Gate(AppDbContext db)=>db.Database.IsInMemory()?new MemoryGate(db):new Phase5MutationGate(db,Options.Create(new Phase5Options{ReviewsEnabled=true,AccountSecurityEnabled=true,AnnouncementDeliveryEnabled=true,ApprovedIsolatedDatabase=CompletionMutationGate.Catalog}));
    internal static LearnerReviewService Reviews(IServiceProvider s,IPhase5MutationGate? gate=null){var db=s.GetRequiredService<AppDbContext>();return new(db,s.GetRequiredService<UserManager<ApplicationUser>>(),s.GetRequiredService<AccountService>(),gate??Gate(db));}
    internal static AccountSecurityService Security(IServiceProvider s,PrivateRecoveryCapture capture,IPhase5MutationGate? gate=null){var db=s.GetRequiredService<AppDbContext>();return new(db,s.GetRequiredService<UserManager<ApplicationUser>>(),s.GetRequiredService<SignInManager<ApplicationUser>>(),gate??Gate(db),s.GetRequiredService<IDataProtectionProvider>(),Options.Create(new Phase5Options{PrivateRecoveryCaptureEnabled=true}),capture);}
    internal static ReviewWrite Write(Guid version,string? expected=null,Guid? request=null)=>new(request??Guid.NewGuid(),expected,version,5,"A detailed synthetic review of the purchased course.");
    internal static async Task<ClaimsPrincipal> Ticket(IServiceProvider s,string id){Http(s,id);var u=await s.GetRequiredService<UserManager<ApplicationUser>>().FindByIdAsync(id);return await s.GetRequiredService<SignInManager<ApplicationUser>>().CreateUserPrincipalAsync(u!);}
    [Theory][InlineData("learner")][InlineData("both")]
    public async Task Enrolled_reviews_do_not_require_completion_and_replays_preserve_audit(string persona){
        using var p=Services();using var scope=p.CreateScope();var s=scope.ServiceProvider;var f=await LearnerLearningTests.Setup(s,persona);var db=s.GetRequiredService<AppDbContext>();var svc=Reviews(s);var input=Write(f.Purchase.Version);
        var first=await svc.WriteAsync(Principal(f.Purchase.Learner),f.Enrollment,input);Assert.Equal(ServiceFailure.None,first.Failure);Assert.Equal(f.Purchase.Version,first.Value!.Review!.CourseVersionId);
        Assert.True((await svc.WriteAsync(Principal(f.Purchase.Learner),f.Enrollment,input)).Value!.Replayed);Assert.Equal(1,await db.CourseReviews.CountAsync());Assert.Equal("active",(await db.Enrollments.SingleAsync()).Status);
        var reply=await svc.ReplyAsync(Principal(f.Purchase.Owner),f.Enrollment,new(Guid.NewGuid(),first.Value.Review.Version,"Instructor response"));Assert.Equal(ServiceFailure.None,reply.Failure);
        var edit=await svc.WriteAsync(Principal(f.Purchase.Learner),f.Enrollment,Write(f.Purchase.Version,reply.Value!.Review!.Version) with{Rating=4});Assert.Equal("Instructor response",edit.Value!.Review!.InstructorReply);
        var remove=new ReviewRemove(Guid.NewGuid(),edit.Value.Review.Version);Assert.Equal(ServiceFailure.None,(await svc.RemoveAsync(Principal(f.Purchase.Learner),f.Enrollment,remove)).Failure);
        Assert.Null((await svc.WriteAsync(Principal(f.Purchase.Learner),f.Enrollment,input)).Value!.Review);Assert.Empty(await db.CourseReviews.ToListAsync());Assert.Contains(await db.AdminActivityLogs.ToListAsync(),x=>x.PreviousState=="Instructor response");
        Assert.Equal(4,await db.PointTransactions.CountAsync());Assert.Empty(await db.Certificates.ToListAsync());
    }
    [Theory][InlineData("duplicate")][InlineData("stale")][InlineData("wrong-version")][InlineData("foreign")][InlineData("non-learner")][InlineData("short")][InlineData("rating")][InlineData("request-reuse")]
    public async Task Review_validation_and_authorization_fail_closed(string kind){
        using var p=Services();using var scope=p.CreateScope();var s=scope.ServiceProvider;var f=await LearnerLearningTests.Setup(s);var svc=Reviews(s);var input=Write(f.Purchase.Version);var first=(await svc.WriteAsync(Principal(f.Purchase.Learner),f.Enrollment,input)).Value!;
        var actor=kind is "foreign" or "non-learner"?f.Purchase.Owner:f.Purchase.Learner;
        var next=Write(kind=="wrong-version"?Guid.NewGuid():f.Purchase.Version,kind=="duplicate"?null:kind=="stale"?"stale":first.Review!.Version,kind=="request-reuse"?input.RequestId:null);
        if(kind=="short")next=next with{Comment="short"};if(kind=="rating")next=next with{Rating=6};
        Assert.NotEqual(ServiceFailure.None,(await svc.WriteAsync(Principal(actor),f.Enrollment,next)).Failure);
    }
    [Fact]public async Task Only_general_admin_can_remove_and_audit_reason_is_immutable(){
        using var p=Services();using var scope=p.CreateScope();var s=scope.ServiceProvider;var f=await LearnerLearningTests.Setup(s);var svc=Reviews(s);var r=(await svc.WriteAsync(Principal(f.Purchase.Learner),f.Enrollment,Write(f.Purchase.Version))).Value!.Review!;
        var input=new ReviewRemove(Guid.NewGuid(),r.Version,"Abusive content reviewed independently.");Assert.Equal(ServiceFailure.Forbidden,(await svc.RemoveAsync(Principal(f.Purchase.Owner),f.Enrollment,input,true)).Failure);
        var admin=await Seed(s,true);Assert.Equal(ServiceFailure.Validation,(await svc.RemoveAsync(Principal(admin),f.Enrollment,input with{Reason=""},true)).Failure);
        Assert.Equal(ServiceFailure.None,(await svc.RemoveAsync(Principal(admin),f.Enrollment,input,true)).Failure);
        var db=s.GetRequiredService<AppDbContext>();Assert.Contains(await db.AdminActivityLogs.ToListAsync(),x=>x.NewState==input.Reason);
    }
    [Fact]public async Task Legacy_null_review_version_is_not_invented_by_edit_or_audit(){
        using var p=Services();using var scope=p.CreateScope();var s=scope.ServiceProvider;var f=await LearnerLearningTests.Setup(s);var db=s.GetRequiredService<AppDbContext>();var legacy=new CourseReview{EnrollmentId=f.Enrollment,Rating=4,Comment="An existing review with unknown historical attribution."};db.Add(legacy);await db.SaveChangesAsync();var version=LearnerReviewService.Version(legacy);
        var result=await Reviews(s).WriteAsync(Principal(f.Purchase.Learner),f.Enrollment,Write(f.Purchase.Version,version));Assert.Equal(ServiceFailure.None,result.Failure);Assert.Null(result.Value!.Review!.CourseVersionId);Assert.All(await db.AdminActivityLogs.Where(x=>x.TargetType=="LearnerReview"&&x.CourseId==f.Purchase.Course).ToListAsync(),x=>Assert.Null(x.CourseVersionId));
    }
    [Theory][InlineData(Phase5Capability.Reviews)][InlineData(Phase5Capability.AccountSecurity)][InlineData(Phase5Capability.AnnouncementDelivery)]
    public async Task Real_gate_is_disabled_and_never_accepts_non_sql_provider(Phase5Capability capability){using var p=Services();using var scope=p.CreateScope();var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();Assert.False(await new Phase5MutationGate(db,Options.Create(new Phase5Options())).IsEnabledAsync(capability));Assert.False(await GateOnMemory(db).IsEnabledAsync(capability));}
    private static Phase5MutationGate GateOnMemory(AppDbContext db)=>new(db,Options.Create(new Phase5Options{ReviewsEnabled=true,AccountSecurityEnabled=true,AnnouncementDeliveryEnabled=true,ApprovedIsolatedDatabase=CompletionMutationGate.Catalog}));
    [Theory][InlineData("expired")][InlineData("future")][InlineData("wrong-purpose")]
    public async Task Recovery_envelope_expiry_and_purpose_are_enforced_without_consuming_identity_token(string kind){
        using var p=Services();using var s=p.CreateScope();var sp=s.ServiceProvider;var id=await Seed(sp);
        var users=sp.GetRequiredService<UserManager<ApplicationUser>>();var u=(await users.FindByIdAsync(id))!;var stamp=u.SecurityStamp;
        var identityToken=await users.GeneratePasswordResetTokenAsync(u);var protection=sp.GetRequiredService<IDataProtectionProvider>();
        var protector=protection.CreateProtector(kind=="wrong-purpose"?"ESHAM.OtherPurpose":"ESHAM.Phase5.PasswordRecovery.v1").ToTimeLimitedDataProtector();
        var envelope=JsonSerializer.Serialize(new{UserId=id,IdentityToken=identityToken});
        var token=protector.Protect(envelope,DateTimeOffset.UtcNow.AddSeconds(kind=="expired"?-1:60));
        var result=await Security(sp,new()).ResetAsync(new(token,"ExpiryBoundaryPassword789!"));
        Assert.Equal(kind=="future"?ServiceFailure.None:ServiceFailure.Validation,result.Failure);
        if(kind!="future"){
            Assert.Equal(stamp,(await users.FindByIdAsync(id))!.SecurityStamp);
            var valid=protection.CreateProtector("ESHAM.Phase5.PasswordRecovery.v1").ToTimeLimitedDataProtector().Protect(envelope,TimeSpan.FromMinutes(1));
            Assert.Equal(ServiceFailure.None,(await Security(sp,new()).ResetAsync(new(valid,"ExpiryBoundaryPassword789!"))).Failure);
        }
    }
    [Fact]public async Task Issued_recovery_envelope_expires_thirty_minutes_after_issue(){
        using var p=Services();using var s=p.CreateScope();var id=await Seed(s.ServiceProvider);var user=(await s.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>().FindByIdAsync(id))!;var capture=new PrivateRecoveryCapture();var before=DateTimeOffset.UtcNow;
        await Security(s.ServiceProvider,capture).ForgotAsync(new(user.Email));var after=DateTimeOffset.UtcNow;
        s.ServiceProvider.GetRequiredService<IDataProtectionProvider>().CreateProtector("ESHAM.Phase5.PasswordRecovery.v1").ToTimeLimitedDataProtector().Unprotect(capture.TakeForIsolatedTest(user.Email!)!,out var expires);
        Assert.InRange(expires,before.AddMinutes(30),after.AddMinutes(30));
    }
    [Fact]public async Task Password_change_revocation_reset_and_stale_profile_preserve_financial_history(){
        using var p=Services();using var scope=p.CreateScope();var s=scope.ServiceProvider;var f=await LearnerLearningTests.Setup(s);var db=s.GetRequiredService<AppDbContext>();var capture=new PrivateRecoveryCapture();var svc=Security(s,capture);var actor=await Ticket(s,f.Purchase.Learner);var old=(await db.Users.SingleAsync(x=>x.Id==f.Purchase.Learner)).SecurityStamp;
        Assert.Equal(ServiceFailure.None,(await svc.PasswordAsync(actor,new(Password,"NewAccount456!"))).Failure);Assert.NotEqual(old,(await db.Users.SingleAsync(x=>x.Id==f.Purchase.Learner)).SecurityStamp);
        Assert.Equal(ServiceFailure.Unauthenticated,(await svc.RevokeAsync(actor,new("NewAccount456!"))).Failure);
        Assert.Equal(AccountFailure.Unauthenticated,(await s.GetRequiredService<AccountService>().UpdateCurrentRoleAsync(actor,"both")).Failure);
        var u=await db.Users.SingleAsync(x=>x.Id==f.Purchase.Learner);Assert.True((await svc.ForgotAsync(new(u.Email))).Value);var token=capture.TakeForIsolatedTest(u.Email!)!;Assert.NotNull(token);
        Assert.Equal(ServiceFailure.None,(await svc.ResetAsync(new(token,"ResetAccount789!"))).Failure);Assert.Equal(ServiceFailure.Validation,(await svc.ResetAsync(new(token,"ResetAgain987!"))).Failure);
        Assert.True(await s.GetRequiredService<UserManager<ApplicationUser>>().CheckPasswordAsync((await db.Users.SingleAsync(x=>x.Id==u.Id)),"ResetAccount789!"));Assert.Equal(4,await db.PointTransactions.CountAsync());Assert.Equal(2,await db.Wallets.CountAsync());
    }
    [Fact]public async Task Failed_password_confirmation_keeps_lockout_counter_and_recovery_does_not_reveal_users(){
        using var p=Services();using var scope=p.CreateScope();var s=scope.ServiceProvider;var id=await Seed(s);var capture=new PrivateRecoveryCapture();var svc=Security(s,capture);var actor=await Ticket(s,id);
        for(var i=0;i<5;i++)Assert.NotEqual(ServiceFailure.None,(await svc.PasswordAsync(actor,new("wrong password","NextPassword789!"))).Failure);
        Assert.True(await s.GetRequiredService<UserManager<ApplicationUser>>().IsLockedOutAsync((await s.GetRequiredService<UserManager<ApplicationUser>>().FindByIdAsync(id))!));
        Assert.True((await svc.ForgotAsync(new("missing@example.test"))).Value);Assert.Null(capture.TakeForIsolatedTest("missing@example.test"));Assert.NotEqual(ServiceFailure.None,(await svc.ResetAsync(new("not-a-token","NextPassword789!"))).Failure);
    }
    [Theory][InlineData("")][InlineData("%")][InlineData("=")][InlineData("\u0000")]
    public async Task Malformed_recovery_tokens_return_validation_without_server_errors(string token){using var p=Services();using var s=p.CreateScope();Assert.Equal(ServiceFailure.Validation,(await Security(s.ServiceProvider,new()).ResetAsync(new(token,"ValidNewPassword789!"))).Failure);}
    [Theory][InlineData("12345678")][InlineData("abcdefgh")][InlineData("Ab1")][InlineData("")]
    public async Task Change_and_reset_preserve_registration_password_rules_without_consuming_a_valid_token(string weak){
        using var p=Services();using var s=p.CreateScope();var id=await Seed(s.ServiceProvider);var capture=new PrivateRecoveryCapture();var svc=Security(s.ServiceProvider,capture);var ticket=await Ticket(s.ServiceProvider,id);
        Assert.Equal(ServiceFailure.Validation,(await svc.PasswordAsync(ticket,new(Password,weak))).Failure);var user=(await s.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>().FindByIdAsync(id))!;await svc.ForgotAsync(new(user.Email));var token=capture.TakeForIsolatedTest(user.Email!)!;
        Assert.Equal(ServiceFailure.Validation,(await svc.ResetAsync(new(token,weak))).Failure);Assert.Equal(ServiceFailure.None,(await svc.ResetAsync(new(token,"ValidNewPassword789!"))).Failure);
    }
    [Fact]public async Task Announcement_allowlist_current_memberships_and_republish_are_repeatable(){
        using var p=Services();using var scope=p.CreateScope();var s=scope.ServiceProvider;var f=await LearnerLearningTests.Setup(s,"both");var db=s.GetRequiredService<AppDbContext>();var admin=await Seed(s,true);
        var a=new Announcement{AuthorUserId=admin,Audience="learners",Status="published",PublishedAt=DateTimeOffset.UtcNow,TitleEn="Synthetic announcement",ContentEn="Private synthetic body"};var excluded=new Announcement{AuthorUserId=admin,Audience="all",Status="published",PublishedAt=DateTimeOffset.UtcNow,TitleEn="Not selected",ContentEn="Never delivered"};db.AddRange(a,excluded);await db.SaveChangesAsync();
        var svc=new AnnouncementDeliveryService(db,new MemoryGate(db),Options.Create(new Phase5Options{AnnouncementIds=[a.Id]}));Assert.Equal(1,await svc.RecoverAsync());Assert.Equal(0,await svc.RecoverAsync());
        var n=await db.Notifications.SingleAsync(x=>x.NotificationType=="announcement.published");n.IsRead=true;n.ReadAt=DateTimeOffset.UtcNow;await db.SaveChangesAsync();await svc.RecoverAsync();Assert.True((await db.Notifications.SingleAsync(x=>x.Id==n.Id)).IsRead);
        var saved=await db.Announcements.SingleAsync(x=>x.Id==a.Id);saved.PublishedAt=saved.PublishedAt!.Value.AddTicks(1);await db.SaveChangesAsync();Assert.Equal(1,await svc.RecoverAsync());
        var learner=JsonSerializer.SerializeToElement((await svc.FeedAsync(Principal(f.Purchase.Learner))).Value);var instructor=JsonSerializer.SerializeToElement((await svc.FeedAsync(Principal(f.Purchase.Owner))).Value);Assert.Equal(2,learner.GetProperty("Items").GetArrayLength());Assert.Equal(1,instructor.GetProperty("Items").GetArrayLength());
    }
}
