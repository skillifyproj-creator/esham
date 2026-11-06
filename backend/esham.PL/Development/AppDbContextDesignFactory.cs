using esham.DAL.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
namespace esham.PL.Development;

// EF tooling never starts the application, its seeders, or its hosted database.
// This factory only builds the model. Reviewed SQL application is a separate explicit step.
public sealed class AppDbContextDesignFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args) => new(new DbContextOptionsBuilder<AppDbContext>()
        .UseSqlServer("Server=localhost;Database=EshamDesignOnly;Integrated Security=True;TrustServerCertificate=True").Options);
}
