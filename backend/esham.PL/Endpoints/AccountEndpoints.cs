using esham.BLL.Interfaces;
using esham.PL.DTOs;

namespace esham.PL.Endpoints;

public static class AccountEndpoints
{
    public static IEndpointRouteBuilder MapAccountEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapPost("/auth/register", async (
            RegisterAccountRequest request,
            IAccountService accountService) =>
        {
            var result = await accountService.RegisterAsync(
                new RegisterAccountCommand(request.Name, request.Email, request.Password));

            if (result.Failure != AccountFailure.None || result.Profile is null)
            {
                return ToError(result);
            }

            return Results.Created("/auth/session", new
            {
                profile = new { id = result.Profile.Id },
            });
        })
        .AllowAnonymous()
        .WithName("RegisterAccount");

        endpoints.MapPost("/auth/login", async (
            LoginAccountRequest request,
            IAccountService accountService) =>
        {
            var result = await accountService.LoginAsync(
                new LoginAccountCommand(request.Email, request.Password));

            if (result.Failure != AccountFailure.None || result.Profile is null)
            {
                return ToError(result);
            }

            return Results.Ok(new { profile = ToResponse(result.Profile) });
        })
        .AllowAnonymous()
        .WithName("LoginAccount");

        endpoints.MapPost("/auth/logout", async (IAccountService accountService) =>
        {
            await accountService.SignOutAsync();
            return Results.NoContent();
        })
        .WithName("LogoutAccount");

        endpoints.MapGet("/auth/session", async (IAccountService accountService, HttpContext context) =>
        {
            var result = await accountService.GetCurrentSessionAsync(context.User);
            if (result.Failure != AccountFailure.None || result.Profile is null)
            {
                return ToError(result);
            }

            if (result.OnboardingRequired)
            {
                return Results.Ok(new
                {
                    profile = new { result.Profile.Id, result.Profile.Name },
                    onboardingRequired = true,
                });
            }

            return Results.Ok(new AccountSessionResponse(
                ToResponse(result.Profile),
                OnboardingRequired: false));
        })
        .RequireAuthorization()
        .WithName("GetCurrentAccountSession");

        endpoints.MapPatch("/me", async (
            UpdateProfileRequest request,
            IAccountService accountService,
            HttpContext context) =>
        {
            var result = await accountService.UpdateCurrentProfileAsync(
                context.User,
                new UpdateProfileCommand(
                    request.Name,
                    request.NameEn,
                    request.Username,
                    request.Role,
                    request.Avatar,
                    request.Bio,
                    request.Interests,
                    request.TeachingAreas,
                    request.CustomSkills,
                    request.Goal));

            if (result.Failure != AccountFailure.None)
            {
                return ToError(result);
            }

            return Results.NoContent();
        })
        .RequireAuthorization()
        .WithName("UpdateCurrentProfile");

        return endpoints;
    }

    private static AccountProfileResponse ToResponse(AccountProfile profile) => new(
        profile.Id,
        profile.Name,
        profile.NameEn,
        profile.Email,
        profile.Username,
        profile.Role,
        profile.Avatar,
        profile.Bio,
        profile.Interests,
        profile.TeachingAreas,
        profile.CustomSkills,
        profile.Goal);

    private static IResult ToError(AccountResult result) => result.Failure switch
    {
        AccountFailure.Validation => Results.ValidationProblem(
            new Dictionary<string, string[]>
            {
                ["request"] = result.Errors?.ToArray() ?? ["The request is invalid."],
            }),
        AccountFailure.EmailAlreadyExists => Results.Problem(
            title: "An account with this email already exists.",
            statusCode: StatusCodes.Status409Conflict),
        AccountFailure.UsernameAlreadyExists => Results.Problem(
            title: "An account with this username already exists.",
            statusCode: StatusCodes.Status409Conflict),
        AccountFailure.InvalidCredentials => Results.Problem(
            title: "Email or password is incorrect.",
            statusCode: StatusCodes.Status401Unauthorized),
        AccountFailure.LockedOut => Results.Problem(
            title: "Too many sign-in attempts. Try again later.",
            statusCode: StatusCodes.Status429TooManyRequests),
        AccountFailure.OnboardingRequired => Results.Problem(
            title: "Account onboarding must be completed before signing in.",
            statusCode: StatusCodes.Status409Conflict),
        _ => Results.Problem(
            title: "Authentication is required.",
            statusCode: StatusCodes.Status401Unauthorized),
    };
}