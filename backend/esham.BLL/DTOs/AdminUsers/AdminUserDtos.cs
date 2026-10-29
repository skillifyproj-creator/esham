using System.Text.Json.Serialization;

namespace esham.BLL.DTOs.AdminUsers;

public sealed record AdminUserQuery(int Page = 1, int PageSize = 20, string? Search = null,
    string? Role = null, string? Status = null);
public sealed record AdminUserDto(string Id, string? Name, string? Username, string? Email,
    IReadOnlyList<string> Roles, bool EmailConfirmed, bool LockoutEnabled, DateTimeOffset? LockoutEnd,
    bool IsLockedOut, string Version);
public sealed record AdminUserPage(IReadOnlyList<AdminUserDto> Items, int Page, int PageSize, int TotalCount);
[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record UpdateAdminUserRolesRequest([property: JsonRequired] string[]? Roles, [property: JsonRequired] string? Version);
[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record UpdateAdminUserLockoutRequest([property: JsonRequired] DateTimeOffset? LockoutEnd,
    [property: JsonRequired] string? Version);
