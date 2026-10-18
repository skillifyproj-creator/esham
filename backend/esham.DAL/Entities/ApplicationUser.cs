using Microsoft.AspNetCore.Identity;

namespace esham.DAL.Entities;

public sealed class ApplicationUser : IdentityUser
{
    public string? Name { get; set; }

    public string? NameEn { get; set; }

    public string? Role { get; set; }

    public string? Avatar { get; set; }

    public string? Bio { get; set; }

    public List<int> Interests { get; set; } = [];

    public List<int> TeachingAreas { get; set; } = [];

    public List<string> CustomSkills { get; set; } = [];

    public int? Goal { get; set; }
}