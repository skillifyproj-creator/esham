# Esham backend

The implemented backend uses ASP.NET Core9, EF Core9, ASP.NET Identity and SQL Server. DAL entities/configurations/migrations are in esham.DAL; services/DTOs are in esham.BLL; endpoints, storage and runtime configuration are in esham.PL. Tests are in esham.Tests (build that project explicitly; the solution does not include it).

## Existing development startup

Use the existing DefaultConnection in .NET User Secrets or process environment. Do not print it, copy it into tracked configuration or replace shared secrets for isolated verification. No database creation or migration is required for the configured hosted database. Fatima coordinates schema changes.

    dotnet build backend/esham.sln --no-restore
    dotnet run --project backend/esham.PL --no-launch-profile --urls http://localhost:5206

Run from the repository root with ASPNETCORE_ENVIRONMENT=Development in the process to use development Swagger at /swagger. Shared frontend is5174; configure allowed credentialed CORS origins explicitly. Existing configuration and installed SDK/runtime are reused; no runtime upgrade is part of Phase6A.

Both SeedData:Enabled and SeedData:DemoCourses default false. Keep both false. Explicit startup seeding is additionally restricted to Development and verified Esham_AccountTests_Phase1_20261114 on (localdb)\MSSQLLocalDB. Startup does not provision or migrate databases. Do not invoke separate development role/reconciliation commands against shared data.

## Isolated verification

Only the existing approved LocalDB catalog Esham_AccountTests_Phase1_20261114 may be used for mutations. Use separate process-local configuration, API5216 and frontend5175. Verify actual DB_NAME(), IsLocalDB=1 and machine-local SQL instance identity before enabling isolated gates. Keep all shared mutation gates disabled; keep background recovery disabled unless separately approved. Never reset fixtures or substitute the hosted db75401.

    dotnet build backend/esham.Tests/esham.Tests.csproj --no-restore
    # SQL opt-in absent/0: safe tests only (Identity tests require local Data Protection access)
    dotnet test backend/esham.Tests/esham.Tests.csproj --no-build

Relational tests require explicit SQL opt-in, the exact approved catalog and existing actual-identity/DML guards. Select the intended suites; never enable provisioning/backfill/setup actions indiscriminately. Do not run migrations, seeders or mutation tests against shared data.

## Security and handoff

Cookie requests use credentials and the actual Identity memberships. Mutation calls require trusted Origin/X-Requested-With; private account-scoped writes also bind the account header where specified by their contract. Login/register/logout are rate limited; password/reset limits remain separate. Authenticated/auth responses are no-store; fixed cookie expiry and stamp validation are preserved.

See PHASE1–PHASE5 implementation/verification reports and PHASE6A-GRADUATION-READINESS.md / PHASE6A-VERIFICATION.md. Fatima must review all eight implemented authorization changes before any merge into main: CurriculumService.InDraft; CourseReviewService.SubmitAsync, ReviseAsync and DecideAsync; CourseService.UpdateDraftAsync and CreateAsync; CategoryService mutations; and UserCategoryService.ReplaceCurrentAsync. This review is required before merging, not before committing or pushing Phase 6A. Historical SQL timeout and unexplained slow-run findings remain unresolved. Graduation readiness remains conditional and production readiness is not established. Production hosting, real recovery email, background recovery rollout and hosted mutation enablement remain unapproved.
