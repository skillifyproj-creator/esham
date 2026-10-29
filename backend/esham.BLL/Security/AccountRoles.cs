namespace esham.BLL.Security;

public static class AccountRoles
{
    public static IReadOnlyList<string> Known { get; } = Array.AsReadOnly(new[] { "Learner", "Instructor", "GeneralAdmin", "CategoryAdmin" });
    public static string? Persona(IEnumerable<string> roles)
    {
        var set = roles.ToHashSet(StringComparer.OrdinalIgnoreCase);
        return (set.Contains("Learner"), set.Contains("Instructor")) switch
        {
            (true, true) => "both", (true, false) => "learner", (false, true) => "instructor", _ => null,
        };
    }
}
