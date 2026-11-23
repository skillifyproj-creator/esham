using esham.DAL.Data;
using esham.DAL.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using esham.BLL.Interfaces;
using esham.BLL.Services;
using esham.PL.Endpoints;
using esham.PL.Development;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
if (string.IsNullOrWhiteSpace(connectionString))
{
    throw new InvalidOperationException(
        "Connection string 'DefaultConnection' is not configured. " +
        "Set 'ConnectionStrings:DefaultConnection' using User Secrets for local development " +
        "or 'ConnectionStrings__DefaultConnection' in the deployment environment.");
}

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(connectionString, sqlOptions =>
        sqlOptions.EnableRetryOnFailure(
            maxRetryCount: 5,
            maxRetryDelay: TimeSpan.FromSeconds(10),
            errorNumbersToAdd: null)));
builder.Services.AddIdentity<ApplicationUser, IdentityRole>(options =>
    {
        options.User.RequireUniqueEmail = true;
        options.Password.RequiredLength = 8;
        options.Password.RequireDigit = true;
        options.Password.RequireLowercase = false;
        options.Password.RequireUppercase = false;
        options.Password.RequireNonAlphanumeric = false;
    })
    .AddEntityFrameworkStores<AppDbContext>()
    .AddDefaultTokenProviders();
builder.Services.AddScoped<IAccountService, AccountService>();
builder.Services.Configure<Phase5Options>(builder.Configuration.GetSection("Phase5"));
builder.Services.AddScoped<IPhase5MutationGate, Phase5MutationGate>();
builder.Services.AddScoped<LearnerReviewService>();
builder.Services.AddScoped<AccountSecurityService>();
builder.Services.AddSingleton<PrivateRecoveryCapture>(services=>{
    // Optional file capture is confined to a private, non-served isolated test directory.
    var configured=builder.Configuration["Phase5:PrivateRecoveryCaptureDirectory"];
    if(string.IsNullOrWhiteSpace(configured))return new();
    var expected=Path.GetFullPath(Path.Combine(builder.Environment.ContentRootPath,"../../artifacts/phase5-isolated/recovery"));
    if(!builder.Environment.IsDevelopment()||Path.GetFullPath(configured)!=expected)throw new InvalidOperationException("Recovery capture requires the dedicated isolated development directory.");
    return new(expected);
});
builder.Services.AddScoped<AnnouncementDeliveryService>();
builder.Services.AddHostedService<esham.PL.Services.AnnouncementDeliveryRecoveryService>();
builder.Services.Configure<CourseCompletionOptions>(builder.Configuration.GetSection("CourseCompletion"));
builder.Services.AddScoped<ICompletionMutationGate, CompletionMutationGate>();
builder.Services.AddScoped<EnrollmentCompletionService>();
builder.Services.AddScoped<CertificateService>();
builder.Services.AddHostedService<esham.PL.Services.CompletionRecoveryService>();
builder.Services.AddRateLimiter(options => {
    options.RejectionStatusCode = 429;
    options.AddPolicy("account-security", c => RateLimitPartition.GetFixedWindowLimiter(
        c.Connection.RemoteIpAddress?.ToString() ?? "unknown", _ => new FixedWindowRateLimiterOptions {
            PermitLimit=10, Window=TimeSpan.FromMinutes(15), QueueLimit=0, AutoReplenishment=true }));
    options.AddPolicy("certificate-verification", c => RateLimitPartition.GetFixedWindowLimiter(
        c.Connection.RemoteIpAddress?.ToString() ?? "unknown", _ => new FixedWindowRateLimiterOptions {
            PermitLimit=20, Window=TimeSpan.FromMinutes(1), QueueLimit=0, AutoReplenishment=true }));
});
builder.Services.AddScoped<IUserCategoryService, UserCategoryService>();
builder.Services.AddScoped<IAdminUserService, AdminUserService>();
builder.Services.AddScoped<CategoryAdminProvisioningService>();
builder.Services.AddScoped<INotificationService, NotificationService>();
builder.Services.AddScoped<INotificationWriter, NotificationWriter>();
builder.Services.Configure<EnrollmentPurchaseOptions>(builder.Configuration.GetSection("EnrollmentPurchases"));
builder.Services.AddScoped<EnrollmentPurchaseGate>();
builder.Services.AddScoped<IEnrollmentPurchaseGate>(services => services.GetRequiredService<EnrollmentPurchaseGate>());
builder.Services.AddScoped<IEnrollmentService, EnrollmentService>();
builder.Services.AddScoped<IWalletService, WalletService>();
builder.Services.Configure<LearningProgressOptions>(builder.Configuration.GetSection("LearningProgress"));
builder.Services.AddScoped<ILearningProgressWriteGate, LearningProgressWriteGate>();
builder.Services.AddScoped<LearnerLearningAccess>();
builder.Services.AddScoped<ILearnerLearningService, LearnerLearningService>();
builder.Services.AddScoped<ILessonProgressService, LessonProgressService>();
builder.Services.Configure<SubmissionMutationOptions>(builder.Configuration.GetSection("SubmissionMutations"));
builder.Services.AddScoped<ISubmissionMutationGate, SubmissionMutationGate>();
builder.Services.AddScoped<ILearnerSubmissionService, LearnerSubmissionService>();
builder.Services.Configure<SecurityStampValidatorOptions>(options => options.ValidationInterval = TimeSpan.Zero);
builder.Services.AddScoped<ICategoryService, CategoryService>();
builder.Services.AddScoped<ICourseService, CourseService>();
builder.Services.AddScoped<ICurriculumService, CurriculumService>();
builder.Services.AddScoped<ICourseTaskService, CourseTaskService>();
builder.Services.AddScoped<ILessonMediaService, LessonMediaService>();
builder.Services.AddScoped<ICourseSubmissionEligibilityService, CourseSubmissionEligibilityService>();
builder.Services.AddScoped<ICourseReviewService, CourseReviewService>();
builder.Services.AddScoped<AnnouncementService>();
builder.Services.AddScoped<CourseSafetyService>();
builder.Services.AddScoped<AdminActivityService>();
builder.Services.AddScoped<InstructorInsightsService>();
builder.Services.AddScoped<AdminIntegrationService>();
builder.Services.AddScoped<ICourseVersionUpdates, CourseVersionUpdates>();
builder.Services.AddScoped<ICourseCoverService, CourseCoverService>();
// Explicit configuration is required outside Development; files are never exposed by static middleware.
var mediaRoot = builder.Configuration["Media:StorageRoot"];
if (string.IsNullOrWhiteSpace(mediaRoot) && builder.Environment.IsDevelopment())
    mediaRoot = Path.GetFullPath(Path.Combine(builder.Environment.ContentRootPath, "../storage/media"));
builder.Services.AddSingleton<IMediaStorage>(_ => new esham.PL.Storage.LocalMediaStorage(
    mediaRoot ?? throw new InvalidOperationException("Configure Media:StorageRoot or a production IMediaStorage provider before using lesson media.")));
builder.Services.AddScoped<ISubmissionAttachmentWriter>(s => new esham.PL.Storage.SubmissionAttachmentWriter(s.GetRequiredService<AppDbContext>(),
    s.GetRequiredService<ISubmissionMutationGate>(), mediaRoot ?? ""));
builder.Services.AddExceptionHandler<ApiExceptionHandler>();
builder.Services.AddProblemDetails();
builder.Services.ConfigureApplicationCookie(options =>
{
    options.Cookie.Name = "Esham.Identity";
    AccountCookieValidation.Configure(options);
    options.Cookie.HttpOnly = true;
    options.Cookie.SameSite = SameSiteMode.Lax;
    options.Cookie.SecurePolicy = builder.Environment.IsDevelopment()
        ? CookieSecurePolicy.SameAsRequest
        : CookieSecurePolicy.Always;
    options.Events.OnRedirectToLogin = context =>
    {
        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
        return Task.CompletedTask;
    };
    options.Events.OnRedirectToAccessDenied = context =>
    {
        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        return Task.CompletedTask;
    };
});
builder.Services.AddAuthorization();

var frontendOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
builder.Services.AddCors(options => options.AddPolicy("Frontend", policy =>
{
    policy.WithOrigins(frontendOrigins)
        .AllowAnyHeader()
        .AllowAnyMethod()
        .AllowCredentials();
}));

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();
if (args.Contains("--reconcile-submission-uploads", StringComparer.Ordinal)) {
    using var reconciliation = app.Services.CreateScope();
    var count = await reconciliation.ServiceProvider.GetRequiredService<ISubmissionAttachmentWriter>().ReconcilePendingAsync(CancellationToken.None);
    Console.WriteLine($"Reconciled {count} eligible isolated submission upload journals.");
    return;
}
if (await DevelopmentIdentityRoles.RunCommandAsync(app, args)) return;

if (app.Environment.IsDevelopment() && app.Configuration.GetValue("SeedData:Enabled", true))
{
    await using var scope = app.Services.CreateAsyncScope();
    await DevelopmentIdentityRoles.SeedAsync(
        scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>());
}

if (app.Configuration.GetValue("SeedData:Enabled", true))
await using (var catalogScope = app.Services.CreateAsyncScope())
{
    var db = catalogScope.ServiceProvider.GetRequiredService<AppDbContext>();
    var categories = await DefaultCategorySeeder.SeedAsync(db);
    if (app.Environment.IsDevelopment() && app.Configuration.GetValue("SeedData:DemoCourses", true))
        await DemoCourseSeeder.SeedAsync(db,
            catalogScope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>(),
            catalogScope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>(), categories);
}

app.UseExceptionHandler();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("Frontend");
app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

var summaries = new[]
{
    "Freezing", "Bracing", "Chilly", "Cool", "Mild", "Warm", "Balmy", "Hot", "Sweltering", "Scorching"
};

app.MapAccountEndpoints();
app.MapUserCategoryEndpoints();
app.MapAdminUserEndpoints();
app.MapNotificationEndpoints();
app.MapCategoryEndpoints();
app.MapCourseEndpoints();
app.MapCourseReviewEndpoints();
app.MapPlatformModerationEndpoints();
app.MapInstructorInsightsEndpoints();
app.MapAdminIntegrationEndpoints();
app.MapEnrollmentVersionEndpoints();
app.MapEnrollmentEndpoints();
app.MapWalletEndpoints();
app.MapLearnerLearningEndpoints();
app.MapCompletionEndpoints();
app.MapLearnerReviewEndpoints();
app.MapAccountSecurityEndpoints();
app.MapAnnouncementFeedEndpoints();
app.MapLearnerSubmissionEndpoints();
app.MapCurriculumEndpoints();
app.MapCourseTaskEndpoints();
app.MapLessonMediaEndpoints();
app.MapCourseCoverEndpoints();

app.MapGet("/weatherforecast", () =>
{
    var forecast =  Enumerable.Range(1, 5).Select(index =>
        new WeatherForecast
        (
            DateOnly.FromDateTime(DateTime.Now.AddDays(index)),
            Random.Shared.Next(-20, 55),
            summaries[Random.Shared.Next(summaries.Length)]
        ))
        .ToArray();
    return forecast;
});

// Read-only development verification handshake: no server/database identity or secrets exposed.
if (app.Environment.IsDevelopment())
    app.MapGet("/development/test-isolation", async (EnrollmentPurchaseGate gate, ILearningProgressWriteGate progress, ISubmissionMutationGate submissions, ICompletionMutationGate completion, IPhase5MutationGate phase5, CancellationToken ct) => {
        // Verify the actual connected identity before browser mutation guards allow requests.
        var isolated = await gate.VerifyTargetAsync(ct);
        var expectedMediaRoot = Path.GetFullPath(Path.Combine(app.Environment.ContentRootPath, "../../artifacts/phase2-isolated/media"));
        var mediaIsolated = isolated && !string.IsNullOrWhiteSpace(mediaRoot) && string.Equals(Path.GetFullPath(mediaRoot), expectedMediaRoot, StringComparison.OrdinalIgnoreCase);
        return Results.Ok(new { isolated, purchasesEnabled = isolated && await gate.IsEnabledAsync(ct), progressWritesEnabled = isolated && await progress.IsEnabledAsync(ct), submissionMutationsEnabled = isolated && await submissions.IsEnabledAsync(ct), completionMutationsEnabled = isolated && await completion.IsEnabledAsync(ct), phase5ReviewsEnabled=isolated&&await phase5.IsEnabledAsync(Phase5Capability.Reviews,ct),phase5AccountSecurityEnabled=isolated&&await phase5.IsEnabledAsync(Phase5Capability.AccountSecurity,ct),phase5AnnouncementDeliveryEnabled=isolated&&await phase5.IsEnabledAsync(Phase5Capability.AnnouncementDelivery,ct),mediaIsolated });
    }).AllowAnonymous();

app.Run();

record WeatherForecast(DateOnly Date, int TemperatureC, string? Summary)
{
    public int TemperatureF => 32 + (int)(TemperatureC / 0.5556);
}
