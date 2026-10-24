using esham.DAL.Entities;
using Microsoft.AspNetCore.Identity;

namespace esham.PL.Development;

/// <summary>Development provisioning only; never infers grants from profile data.</summary>
public static class DevelopmentIdentityRoles
{
    public static IReadOnlyList<string> KnownRoles { get; } =
        Array.AsReadOnly(new[] { "Learner", "Instructor", "GeneralAdmin", "CategoryAdmin" });

    public static async Task SeedAsync(RoleManager<IdentityRole> manager)
    {
        foreach (var role in KnownRoles)
        {
            if (await manager.RoleExistsAsync(role)) continue;
            var result = await manager.CreateAsync(new IdentityRole(role));
            // Another development instance may have created the same normalized role.
            if (!result.Succeeded && !await manager.RoleExistsAsync(role))
                RequireSuccess(result);
        }
    }

    public static async Task AssignAsync(UserManager<ApplicationUser> manager, string email, string role)
    {
        if (string.IsNullOrWhiteSpace(email))
            throw new ArgumentException("An explicit existing user email is required.");
        if (!KnownRoles.Contains(role, StringComparer.Ordinal))
            throw new ArgumentException("Role must be Learner, Instructor, GeneralAdmin, or CategoryAdmin.");
        var user = await manager.FindByEmailAsync(email.Trim())
            ?? throw new ArgumentException("No existing user has that email. No user was created.");

        if (!await manager.IsInRoleAsync(user, role))
            RequireSuccess(await manager.AddToRoleAsync(user, role));

        // Only learner/instructor personas have a representation in the legacy frontend.
        // Admin membership is orthogonal and must never be inferred from this string.
        var roles = await manager.GetRolesAsync(user);
        var legacy = LegacyPersona(roles);
        if (legacy is not null && user.Role != legacy)
        {
            user.Role = legacy;
            RequireSuccess(await manager.UpdateAsync(user));
        }
        RequireSuccess(await manager.UpdateSecurityStampAsync(user));
        Console.WriteLine($"Assigned {role} to user ID {user.Id}. Sign out and sign in again.");
    }

    public static string? LegacyPersona(IEnumerable<string> roles)
    {
        var learner = roles.Contains("Learner", StringComparer.OrdinalIgnoreCase);
        var instructor = roles.Contains("Instructor", StringComparer.OrdinalIgnoreCase);
        return (learner, instructor) switch
        {
            (true, true) => "both",
            (true, false) => "learner",
            (false, true) => "instructor",
            _ => null
        };
    }

    public static async Task AuditAsync(
        UserManager<ApplicationUser> users, RoleManager<IdentityRole> roles)
    {
        foreach (var role in KnownRoles)
            Console.WriteLine($"Role {role}: {(await roles.RoleExistsAsync(role) ? "present" : "MISSING")}");
        // Materialize before issuing more queries on the same scoped DbContext.
        var allUsers = Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions
            .ToListAsync(users.Users);
        var auditedUsers = await allUsers;
        Console.WriteLine($"Users audited: {auditedUsers.Count}");
        var mismatches = 0;
        foreach (var user in auditedUsers)
        {
            var memberships = await users.GetRolesAsync(user);
            var expected = LegacyPersona(memberships);
            if (user.Role != expected)
            {
                mismatches++;
                Console.WriteLine($"MISMATCH user ID {user.Id}: legacy={user.Role ?? "(null)"}; " +
                    $"Identity=[{string.Join(", ", memberships)}]; persona={expected ?? "(none)"}");
            }
        }
        Console.WriteLine($"Legacy/persona mismatches: {mismatches}. Audit changes no users.");
    }

    public static async Task<bool> RunCommandAsync(WebApplication app, string[] args)
    {
        var index = Array.IndexOf(args, "--identity-roles");
        if (index < 0) return false;
        if (!app.Environment.IsDevelopment())
            throw new InvalidOperationException("Identity role commands are available only in Development.");

        var commandArgs = args.Skip(index + 1).ToArray();
        var audit = commandArgs.SequenceEqual(new[] { "audit" });
        var seed = commandArgs.SequenceEqual(new[] { "seed" });
        var assign = commandArgs.Length == 5 && commandArgs[0] == "assign"
            && commandArgs[1] == "--email" && commandArgs[3] == "--role"
            && !string.IsNullOrWhiteSpace(commandArgs[2])
            && KnownRoles.Contains(commandArgs[4], StringComparer.Ordinal);
        if (!audit && !assign && !seed)
            throw new ArgumentException(
                "Usage: --identity-roles audit | --identity-roles seed | --identity-roles assign --email <email> --role <known-role>");

        await using var scope = app.Services.CreateAsyncScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var roles = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
        if (seed) await SeedAsync(roles);
        if (assign)
        {
            await SeedAsync(roles);
            await AssignAsync(users, commandArgs[2], commandArgs[4]);
        }
        await AuditAsync(users, roles);
        return true;
    }

    private static void RequireSuccess(IdentityResult result)
    {
        if (!result.Succeeded)
            throw new InvalidOperationException(string.Join("; ",
                result.Errors.Select(error => $"{error.Code}: {error.Description}")));
    }
}
