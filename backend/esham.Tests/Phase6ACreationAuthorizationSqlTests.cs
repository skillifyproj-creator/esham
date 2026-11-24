using System.Data;
using System.Data.Common;
using System.Text.Json;
using System.Collections.Concurrent;
using esham.BLL.DTOs;
using esham.BLL.DTOs.Categories;
using esham.BLL.Services;
using esham.DAL.Data;
using esham.DAL.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
using static esham.Tests.AccountFinalizationTests;
namespace esham.Tests;

public sealed class Phase6ACreationAuthorizationSqlTests
{
    private sealed class Probe : DbCommandInterceptor
    {
        public string? Context; private int paused;
        public TaskCompletionSource Reached=new(TaskCreationOptions.RunContinuationsAsynchronously),Release=new(TaskCreationOptions.RunContinuationsAsynchronously);
        public ConcurrentQueue<int> Errors=new();
        public override async ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(DbCommand c,CommandEventData e,InterceptionResult<DbDataReader> r,CancellationToken ct=default)
        {if(e.Context?.ContextId.ToString()==Context&&Interlocked.Exchange(ref paused,1)==0){Assert.NotNull(e.Context!.Database.CurrentTransaction);Reached.SetResult();await Release.Task.WaitAsync(ct);}return r;}
        public override Task CommandFailedAsync(DbCommand c,CommandErrorEventData e,CancellationToken ct=default)
        {if(e.Exception is Microsoft.Data.SqlClient.SqlException sql)foreach(Microsoft.Data.SqlClient.SqlError error in sql.Errors)Errors.Enqueue(error.Number);return Task.CompletedTask;}
    }
    public static IEnumerable<object[]> Cases()=>from operation in new[]{"course","category-create","category-update","category-status"}
        from scenario in new[]{"authorized","revoked","locked","wrong-role","concurrent"} select new object[]{operation,scenario};

    private static async Task<string> Actor(IServiceProvider s){var id=await Seed(s);Assert.Equal(esham.BLL.Interfaces.AccountFailure.None,(await s.GetRequiredService<AccountService>().UpdateCurrentProfileAsync(Principal(id),Profile("instructor","p6ac_"+Guid.NewGuid().ToString("N")[..12]))).Failure);var users=s.GetRequiredService<UserManager<ApplicationUser>>();Assert.True((await users.AddToRoleAsync((await users.FindByIdAsync(id))!,"GeneralAdmin")).Succeeded);return id;}
    private static async Task<ServiceFailure> Write(AppDbContext db,string operation,Guid category,string marker,CourseActor actor){
        var service=new CategoryService(db);
        return operation switch{
            "course"=>(await new CourseService(db).CreateAsync(actor,new(category,null,marker,null,"Synthetic creation",[]))).Failure,
            "category-create"=>(await service.CreateAsync(new(marker,marker,null,null,null,0),actor)).Failure,
            "category-update"=>(await service.UpdateAsync(category,new(marker,marker,null,null,null,0),actor)).Failure,
            _=>(await service.ChangeStatusAsync(category,false,actor)).Failure
        };
    }
    private static async Task<string> Snapshot(AppDbContext db,Guid category,string owner,string marker)=>JsonSerializer.Serialize(new{
        category=await db.Categories.AsNoTracking().Where(x=>x.Id==category).Select(x=>new{x.NameAr,x.NameEn,x.IsActive,x.ParentCategoryId,x.UpdatedAt}).SingleAsync(),
        created=await db.Categories.CountAsync(x=>x.NameEn==marker),courses=await db.Courses.CountAsync(x=>x.OwnerUserId==owner),versions=await db.CourseVersions.CountAsync(x=>x.Course.OwnerUserId==owner)
    });

    public static IEnumerable<object[]> BlockedCases()=>from operation in new[]{"course","category-create","category-update","category-status"}
        from change in new[]{"revoked","locked"} select new object[]{operation,change};

    [Phase1SqlTheory][MemberData(nameof(BlockedCases))]
    public async Task Real_SQL_gate_wait_does_not_retain_captured_creation_authorization(string operation,string change)
    {
        var probe=new Probe();using var provider=await CompletionSqlServerTests.Provider(probe);string id;Guid category;var marker="Synthetic_R3_blocked_"+Guid.NewGuid().ToString("N");string before;
        using(var setup=provider.CreateScope()){var s=setup.ServiceProvider;var db=s.GetRequiredService<AppDbContext>();Assert.True(await CompletionSqlServerTests.Gate(db).IsEnabledAsync());id=await Actor(s);var c=new Category{NameAr=marker,NameEn=marker};db.Categories.Add(c);await db.SaveChangesAsync();category=c.Id;before=await Snapshot(db,category,id,marker);}
        using var blocker=provider.CreateScope();var hold=blocker.ServiceProvider.GetRequiredService<AppDbContext>();
        await hold.Database.CreateExecutionStrategy().ExecuteAsync(async()=>{
            await using var tx=await hold.Database.BeginTransactionAsync(IsolationLevel.Serializable);
            var resource=operation=="course"?"Esham.CourseCreation.v1":"Esham.CategoryTreeWrites.v1";
            await hold.Database.ExecuteSqlInterpolatedAsync($"DECLARE @r int; EXEC @r=sys.sp_getapplock @Resource={resource},@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=5000; IF @r<0 THROW 51000,'Test gate unavailable.',1;");
            using var writer=provider.CreateScope();var db=writer.ServiceProvider.GetRequiredService<AppDbContext>();await db.Database.OpenConnectionAsync();var spid=((Microsoft.Data.SqlClient.SqlConnection)db.Database.GetDbConnection()).ServerProcessId;
            var pending=Task.Run(()=>Write(db,operation,category,marker+"_after",new(id,true,true)));
            using var observer=provider.CreateScope();var monitor=observer.ServiceProvider.GetRequiredService<AppDbContext>();var until=DateTime.UtcNow.AddSeconds(10);var blocked=false;
            while(DateTime.UtcNow<until&&!pending.IsCompleted){
                blocked=await monitor.Database.SqlQuery<int>($"SELECT COUNT(*) AS [Value] FROM sys.dm_exec_requests WHERE session_id={spid} AND blocking_session_id>0 AND wait_type LIKE 'LCK_M_%'").SingleAsync()>0;
                if(blocked)break;await Task.Delay(25);
            }
            try{
                Assert.True(blocked,"The writer must really be blocked inside SQL before revocation.");
                using var security=provider.CreateScope();var s=security.ServiceProvider;var securityDb=s.GetRequiredService<AppDbContext>();var users=s.GetRequiredService<UserManager<ApplicationUser>>();
                await securityDb.Database.CreateExecutionStrategy().ExecuteAsync(async()=>{
                    await using var st=await securityDb.Database.BeginTransactionAsync(IsolationLevel.Serializable);var u=await securityDb.Users.FromSqlInterpolated($"SELECT * FROM [AspNetUsers] WITH (UPDLOCK,HOLDLOCK) WHERE [Id]={id}").SingleAsync();
                    if(change=="revoked")Assert.True((await users.RemoveFromRoleAsync(u,operation=="course"?"Instructor":"GeneralAdmin")).Succeeded);
                    else{u.LockoutEnabled=true;u.LockoutEnd=DateTimeOffset.UtcNow.AddHours(1);Assert.True((await users.UpdateAsync(u)).Succeeded);}
                    await st.CommitAsync();
                });
            }finally{await tx.CommitAsync();}
            Assert.Equal(ServiceFailure.Forbidden,await pending.WaitAsync(TimeSpan.FromSeconds(30)));
        });
        using var verify=provider.CreateScope();Assert.Equal(before,await Snapshot(verify.ServiceProvider.GetRequiredService<AppDbContext>(),category,id,marker));Assert.Empty(probe.Errors);
    }

    public static IEnumerable<object[]> SelectionCases()=>from kind in new[]{"learning","teaching"}
        from scenario in new[]{"authorized","locked","revoked","expired-lockout","disabled-lockout","concurrent"} select new object[]{kind,scenario};

    [Phase1SqlTheory][MemberData(nameof(SelectionCases))]
    public async Task Category_selection_wait_rechecks_current_lockout_without_changing_membership_policy(string kind,string scenario)
    {
        var probe=new Probe();using var provider=await CompletionSqlServerTests.Provider(probe);string id;Guid category;
        using(var setup=provider.CreateScope()){
            var s=setup.ServiceProvider;var db=s.GetRequiredService<AppDbContext>();Assert.True(await CompletionSqlServerTests.Gate(db).IsEnabledAsync());id=await Actor(s);
            var users=s.GetRequiredService<UserManager<ApplicationUser>>();Assert.True((await users.AddToRoleAsync((await users.FindByIdAsync(id))!,"Learner")).Succeeded);
            var c=new Category{NameAr="Synthetic selection",NameEn="Synthetic selection"};db.Categories.Add(c);await db.SaveChangesAsync();category=c.Id;
        }
        using var writer=provider.CreateScope();var ws=writer.ServiceProvider;var writeDb=ws.GetRequiredService<AppDbContext>();probe.Context=writeDb.ContextId.ToString();
        var pending=Task.Run(()=>new UserCategoryService(writeDb,ws.GetRequiredService<UserManager<ApplicationUser>>()).ReplaceCurrentAsync(Principal(id),kind,new([category])));
        await probe.Reached.Task.WaitAsync(TimeSpan.FromSeconds(10));Assert.False(pending.IsCompleted);
        try{
            if(scenario!="authorized"&&scenario!="concurrent"){
                using var security=provider.CreateScope();var s=security.ServiceProvider;var db=s.GetRequiredService<AppDbContext>();var users=s.GetRequiredService<UserManager<ApplicationUser>>();
                await db.Database.CreateExecutionStrategy().ExecuteAsync(async()=>{
                    await using var tx=await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
                    var u=await db.Users.FromSqlInterpolated($"SELECT * FROM [AspNetUsers] WITH (UPDLOCK,HOLDLOCK) WHERE [Id]={id}").SingleAsync();
                    if(scenario=="revoked")Assert.True((await users.RemoveFromRoleAsync(u,kind=="learning"?"Learner":"Instructor")).Succeeded);
                    else{u.LockoutEnabled=scenario!="disabled-lockout";u.LockoutEnd=scenario=="expired-lockout"?DateTimeOffset.UtcNow.AddHours(-1):DateTimeOffset.UtcNow.AddHours(1);Assert.True((await users.UpdateAsync(u)).Succeeded);}
                    await tx.CommitAsync();
                });
            }
        }finally{probe.Release.TrySetResult();}
        var result=await pending.WaitAsync(TimeSpan.FromSeconds(30));var allowed=scenario is not("locked" or "revoked");
        Assert.Equal(allowed?ServiceFailure.None:ServiceFailure.Forbidden,result.Failure);
        if(scenario=="concurrent"){
            async Task Replace(){using var s=provider.CreateScope();var sp=s.ServiceProvider;Assert.Equal(ServiceFailure.None,(await new UserCategoryService(sp.GetRequiredService<AppDbContext>(),sp.GetRequiredService<UserManager<ApplicationUser>>()).ReplaceCurrentAsync(Principal(id),kind,new([category]))).Failure);}
            await Task.WhenAll(Replace(),Replace());
        }
        using var verify=provider.CreateScope();var check=verify.ServiceProvider.GetRequiredService<AppDbContext>();Assert.Equal(allowed?1:0,await check.UserCategories.CountAsync(x=>x.UserId==id&&x.Kind==kind&&x.CategoryId==category));Assert.Empty(probe.Errors);
        Assert.Equal(20,(await check.Wallets.SingleAsync(x=>x.UserId==id)).Balance);Assert.Equal(1,await check.PointTransactions.CountAsync(x=>x.UserId==id));
    }

    [Phase1SqlFact]
    public async Task Creation_tree_and_existing_authoring_share_no_lock_inversion_and_preserve_tree_invariants()
    {
        var probe=new Probe();using var provider=await CompletionSqlServerTests.Provider(probe);
        string first,second;Guid reference,target,left,right,course;var prefix="Synthetic_R3_mix_"+Guid.NewGuid().ToString("N");
        using(var setup=provider.CreateScope()){
            var s=setup.ServiceProvider;var db=s.GetRequiredService<AppDbContext>();Assert.True(await CompletionSqlServerTests.Gate(db).IsEnabledAsync());
            first=await Actor(s);second=await Actor(s);var draft=await CourseReviewWorkflowTests.Seed(db,first,Guid.NewGuid().ToString());course=draft.CourseId;reference=draft.CategoryId;
            var nodes=Enumerable.Range(0,3).Select(i=>new Category{NameAr=prefix+i,NameEn=prefix+i}).ToArray();db.Categories.AddRange(nodes);await db.SaveChangesAsync();target=nodes[0].Id;left=nodes[1].Id;right=nodes[2].Id;
        }
        for(var wave=0;wave<4;wave++){
            var start=new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
            async Task<ServiceFailure> Run(int index){using var scope=provider.CreateScope();var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();var actor=new CourseActor(index%2==0?first:second,true,true);await start.Task;
                return index switch{
                    0 or 1=>(await new CourseService(db).CreateAsync(actor,new(reference,null,prefix+index,null,null,[]))).Failure,
                    2=>(await new CategoryService(db).CreateAsync(new(prefix,prefix,null,null,null,0),actor)).Failure,
                    3=>(await new CategoryService(db).UpdateAsync(target,new(prefix,prefix,null,null,null,0),actor)).Failure,
                    4=>(await new CategoryService(db).ChangeStatusAsync(target,true,actor)).Failure,
                    5=>(await new CourseService(db).UpdateDraftAsync(course,new(first,true,false),new(){TitleEn=prefix})).Failure,
                    _=>(await new CurriculumService(db).SaveSectionAsync(course,null,new(first,true,false),new(null,prefix,wave+3))).Failure
                };}
            var tasks=Enumerable.Range(0,7).Select(Run).ToArray();start.SetResult();Assert.All(await Task.WhenAll(tasks).WaitAsync(TimeSpan.FromSeconds(90)),x=>Assert.Equal(ServiceFailure.None,x));
        }
        var treeStart=new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        async Task<ServiceFailure> Reparent(Guid child,Guid parent,string owner){using var scope=provider.CreateScope();await treeStart.Task;return(await new CategoryService(scope.ServiceProvider.GetRequiredService<AppDbContext>()).UpdateAsync(child,new(prefix,prefix,null,null,parent,0),new(owner,true,true))).Failure;}
        var parents=new[]{Reparent(left,right,first),Reparent(right,left,second)};treeStart.SetResult();var tree=await Task.WhenAll(parents).WaitAsync(TimeSpan.FromSeconds(40));Assert.Equal(1,tree.Count(x=>x==ServiceFailure.None));Assert.Equal(1,tree.Count(x=>x==ServiceFailure.Validation));
        using var verify=provider.CreateScope();var check=verify.ServiceProvider.GetRequiredService<AppDbContext>();Assert.Empty(probe.Errors);
        var pair=await check.Categories.Where(x=>x.Id==left||x.Id==right).ToDictionaryAsync(x=>x.Id,x=>x.ParentCategoryId);Assert.False(pair[left]==right&&pair[right]==left);
        foreach(var owner in new[]{first,second}){Assert.Equal(20,(await check.Wallets.SingleAsync(x=>x.UserId==owner)).Balance);Assert.Equal(1,await check.PointTransactions.CountAsync(x=>x.UserId==owner));}
        Assert.Equal(4,await check.Courses.CountAsync(x=>x.OwnerUserId==second));Assert.Equal(5,await check.Courses.CountAsync(x=>x.OwnerUserId==first));
        var path=Path.GetFullPath(Path.Combine(Phase5SqlTests.Artifacts(),"../phase6a-results"));Directory.CreateDirectory(path);await File.WriteAllTextAsync(Path.Combine(path,"round3-creation-tree-mixed.json"),JsonSerializer.Serialize(new{waves=4,operationsPerWave=7,opposingReparents=2,sqlErrors=probe.Errors.ToArray()}));
    }

    [Phase1SqlTheory][MemberData(nameof(Cases))]
    public async Task Captured_creation_authority_cannot_outlive_current_membership_or_lockout(string operation,string scenario){
        var probe=new Probe();using var provider=await CompletionSqlServerTests.Provider(probe);string id;Guid category;var marker="Synthetic_R3_"+Guid.NewGuid().ToString("N");string before;
        using(var scope=provider.CreateScope()){var s=scope.ServiceProvider;var db=s.GetRequiredService<AppDbContext>();Assert.True(await CompletionSqlServerTests.Gate(db).IsEnabledAsync());id=await Actor(s);var row=new Category{NameAr=marker+"_before",NameEn=marker+"_before"};db.Categories.Add(row);await db.SaveChangesAsync();category=row.Id;
            if(scenario=="wrong-role"){var users=s.GetRequiredService<UserManager<ApplicationUser>>();Assert.True((await users.RemoveFromRoleAsync((await users.FindByIdAsync(id))!,operation=="course"?"Instructor":"GeneralAdmin")).Succeeded);}
            before=await Snapshot(db,category,id,marker);
        }
        var actor=new CourseActor(id,true,true);using var writer=provider.CreateScope();var writeDb=writer.ServiceProvider.GetRequiredService<AppDbContext>();probe.Context=writeDb.ContextId.ToString();
        var pending=Task.Run(()=>Write(writeDb,operation,category,marker,actor));
        // Barrier is before the first transactional reader, not a fake authorization result.
        // It permits a separate real SQL security transaction to commit while the request waits.
        await probe.Reached.Task.WaitAsync(TimeSpan.FromSeconds(10));Assert.False(pending.IsCompleted);
        try{
            if(scenario is "revoked" or "locked"){
                using var revoke=provider.CreateScope();var s=revoke.ServiceProvider;var db=s.GetRequiredService<AppDbContext>();var users=s.GetRequiredService<UserManager<ApplicationUser>>();
                await db.Database.CreateExecutionStrategy().ExecuteAsync(async()=>{
                    await using var tx=await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
                    var user=await db.Users.FromSqlInterpolated($"SELECT * FROM [AspNetUsers] WITH (UPDLOCK,HOLDLOCK) WHERE [Id]={id}").SingleAsync();
                    if(scenario=="revoked")Assert.True((await users.RemoveFromRoleAsync(user,operation=="course"?"Instructor":"GeneralAdmin")).Succeeded);
                    else{user.LockoutEnabled=true;user.LockoutEnd=DateTimeOffset.UtcNow.AddHours(1);Assert.True((await users.UpdateAsync(user)).Succeeded);}
                    Assert.True((await users.UpdateSecurityStampAsync(user)).Succeeded);await tx.CommitAsync();
                });
            }
        }finally{probe.Release.TrySetResult();}
        var result=await pending.WaitAsync(TimeSpan.FromSeconds(30));
        if(scenario=="concurrent"){
            using var a=provider.CreateScope();using var b=provider.CreateScope();var start=new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
            async Task<ServiceFailure> Next(AppDbContext db){await start.Task;return await Write(db,operation,category,marker+Guid.NewGuid().ToString("N"),actor);}
            var work=new[]{Next(a.ServiceProvider.GetRequiredService<AppDbContext>()),Next(b.ServiceProvider.GetRequiredService<AppDbContext>())};start.SetResult();Assert.All(await Task.WhenAll(work).WaitAsync(TimeSpan.FromSeconds(40)),x=>Assert.Equal(ServiceFailure.None,x));
        }
        using var verify=provider.CreateScope();var check=verify.ServiceProvider.GetRequiredService<AppDbContext>();var after=await Snapshot(check,category,id,marker);var success=scenario is "authorized" or "concurrent";
        var path=Path.GetFullPath(Path.Combine(Phase5SqlTests.Artifacts(),"../phase6a-results"));Directory.CreateDirectory(path);
        await File.WriteAllTextAsync(Path.Combine(path,$"round3-{operation}-{scenario}.json"),JsonSerializer.Serialize(new{operation,scenario,result=result.ToString(),unchanged=before==after,sqlErrors=probe.Errors.ToArray()}));
        Assert.Equal(success?ServiceFailure.None:ServiceFailure.Forbidden,result);if(!success)Assert.Equal(before,after);Assert.Empty(probe.Errors);
        Assert.Equal(20,(await check.Wallets.SingleAsync(x=>x.UserId==id)).Balance);Assert.Equal(1,await check.PointTransactions.CountAsync(x=>x.UserId==id));
    }
}
