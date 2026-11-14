# Windows development database setup

The runtime is ASP.NET Core 9 with EF Core 9 and Microsoft SQL Server, including ASP.NET Identity in the same AppDbContext. `Program.cs` requires `ConnectionStrings:DefaultConnection` and registers `UseSqlServer`. The EF design-time factory's `EshamDesignOnly` string is for tooling, not the application database. `backend/.env.example` is historical; ASP.NET does not load it automatically.

The application already has a UserSecretsId in `esham.PL/esham.PL.csproj`. Secrets belong to this project and this Windows user; cloning Git does not transfer them. No usable remote connection is present in the current checkout. `appsettings.json` intentionally has an empty connection string. Do not replace it with credentials.

## Information to obtain from Fatima

Ask for the approved development database connection string through a private channel, including:

- SQL Server hostname or instance, TCP port, and exact existing database name.
- Authentication method: SQL login and password, or Windows/Entra identity and its access requirements. The runtime identity needs appropriate existing application permissions; do not use a migration/admin login just to run the app.
- Required TLS settings and certificate trust/CA instructions. Do not bypass certificate validation merely to make a remote connection work.
- VPN, IP allowlist/firewall and network access requirements for this machine.
- Confirmation that the existing database schema matches this checkout; Fatima coordinates any migrations.
- Separately, approved media storage access/configuration if existing uploaded images or videos are needed. Database access alone does not restore local media files.

SQL authentication format (placeholders only):

```text
Server=tcp:<host>,<port>;Database=<existing-database>;User ID=<login>;Password=<password>;Encrypt=True;TrustServerCertificate=False;
```

Windows authentication format, when explicitly supported by the target server and your identity:

```text
Server=<approved-host-or-instance>;Database=<existing-database>;Integrated Security=True;Encrypt=True;TrustServerCertificate=False;
```

Use Fatima's approved options rather than guessing a host/database or creating a new database. A connection string can use additional provider-supported options according to that server's authentication requirements.

## Secure local configuration

From the repository root, after receiving the approved connection:

```powershell
.\backend\scripts\Set-DevelopmentConnection.ps1
```

The script asks for the complete string with hidden input, sends JSON to `dotnet user-secrets set` through stdin, and never prints credentials or puts them in process arguments. Alternatively, use an existing private file containing only the string:

```powershell
.\backend\scripts\Set-DevelopmentConnection.ps1 -ConnectionStringFile 'C:\private\approved-esham-connection.txt'
```

Keep that file outside the repository and protect it with Windows file permissions. Do not paste secrets into chat or run `dotnet user-secrets list` for shared diagnostics. User Secrets is a per-user local configuration store, not encrypted storage; protect the Windows account and profile directory.

The script also sets `SeedData:Enabled=false` and `SeedData:DemoCourses=false`. These prevent ordinary startup from seeding roles, categories and demo courses. The code otherwise defaults seeding to enabled, including catalog writes. Environment variables override User Secrets: do not set either `SeedData__*` variable to true against the shared database. No migration, database creation or database write is needed for configuration or the verification below.

## Frontend and backend origins

`frontend/.env.local` (Git ignored) should contain this public browser setting, preserving unrelated settings:

```dotenv
VITE_API_BASE_URL=http://localhost:5206
VITE_GOOGLE_AUTH_ENABLED=false
```

Restart Vite after changing environment files, then reload the page. The frontend runs at `http://localhost:5174`; `vite.config.js` selects that strict port. `appsettings.Development.json` already permits this exact origin with credentialed CORS. Client requests already use `credentials: 'include'`. Keep both sides on `localhost`, rather than mixing it with `127.0.0.1`. Use the HTTP backend profile for this local HTTP setup; the HTTPS profile requires a trusted development certificate and matching browser/API configuration.

## Start and verify without changing database records

```powershell
dotnet build .\backend\esham.sln --no-restore
dotnet run --project .\backend\esham.PL --launch-profile http --no-build
```

In another terminal, check the listener and credentialed CORS preflight:

```powershell
Invoke-WebRequest -UseBasicParsing 'http://localhost:5206/swagger/index.html'
$headers = @{
    Origin = 'http://localhost:5174'
    'Access-Control-Request-Method' = 'GET'
    'Access-Control-Request-Headers' = 'content-type,x-requested-with'
}
(Invoke-WebRequest -UseBasicParsing -Method Options -Uri 'http://localhost:5206/api/categories' -Headers $headers).Headers
```

Expect the exact allowed origin `http://localhost:5174` and `Access-Control-Allow-Credentials: true`. Swagger/listening alone does not prove SQL connectivity. Verify a read-only database-backed route, without printing database contents:

```powershell
(Invoke-WebRequest -UseBasicParsing 'http://localhost:5206/api/categories').StatusCode
```

Expect 200. Do not test registration, login lockout, profile edits, POST/PUT/PATCH/DELETE or other writes simply to verify connectivity. Do not run `dotnet ef database update`, seed commands, reset scripts or schema creation against the shared database.

## Historical setup checkpoint — November 13, 2026

On November 13, 2026: backend build passed with zero warnings/errors; the frontend at port 5174 returned 200. The local frontend API setting was created, and Vite's configuration loader resolves it to `http://localhost:5206`. The already-running Vite process had not picked it up at verification time and needs a restart. CORS already includes port 5174. Both startup-seeding settings were saved as false in User Secrets. No connection was found in project configuration, User Secrets or relevant process environment variables, so real backend startup still stops with the missing DefaultConnection error. Runtime CORS and database-backed API verification remain pending the approved connection/access from Fatima. No database was changed.

That checkpoint was subsequently resolved: the shared runtime, real catalog and credentialed CORS were verified. See the Phase 1–3 verification reports for later isolated testing. Hosted learner mutations remain disabled; this historical paragraph is not the current startup status and does not authorize any database write.
