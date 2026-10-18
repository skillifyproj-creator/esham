using System.Security.Claims;

namespace esham.BLL.Interfaces;

public interface IAccountService
{
    Task<AccountResult> RegisterAsync(RegisterAccountCommand command);

    Task<AccountResult> LoginAsync(LoginAccountCommand command);

    Task SignOutAsync();

    Task<AccountResult> GetCurrentSessionAsync(ClaimsPrincipal principal);

    Task<AccountResult> UpdateCurrentProfileAsync(
        ClaimsPrincipal principal,
        UpdateProfileCommand command);
}