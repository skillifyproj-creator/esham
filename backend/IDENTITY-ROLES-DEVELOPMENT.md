# Development Identity roles

Run from the repository root. Normal Development startup idempotently seeds only
Learner, Instructor, GeneralAdmin, CategoryAdmin through RoleManager.
Production startup does not seed or accept these commands. No schema change,
user creation, automatic membership assignment, or content seeding is performed.

Seed roles and audit without starting a web server (safe to repeat):

    dotnet run --project backend/esham.PL --launch-profile http -- --identity-roles seed

Read-only audit (does not seed or alter users):

    dotnet run --project backend/esham.PL --launch-profile http -- --identity-roles audit

Explicitly grant a role to an existing, legitimate development account:

    dotnet run --project backend/esham.PL --launch-profile http -- --identity-roles assign --email "your-test-user@example.com" --role Instructor
    dotnet run --project backend/esham.PL --launch-profile http -- --identity-roles assign --email "your-admin-test-user@example.com" --role GeneralAdmin

Replace the example emails with accounts you control. Commands exit without
starting a web server. They use the same configured database as the app:
verify that the Development connection targets the intended testing database.
Only the four exact role names above are accepted. Repeat grants do not duplicate
memberships. Other users and existing memberships are preserved. For combined
behavior, explicitly grant BOTH Learner and Instructor; no Combined or Guest role.

The assignment command projects Learner/Instructor memberships to the existing
legacy Role field (learner/instructor/both). Admin roles are orthogonal: they do
not turn the frontend persona into an admin string, which would break existing
account compatibility. GeneralAdmin and CategoryAdmin members can log in even
with an empty legacy persona after successful Identity password validation.
The legacy field remains frontend metadata; it never grants API authorization.
Profile edits can still change that metadata without changing Identity membership.
The audit reports every mismatch using user IDs, including legacy personas with
no corresponding memberships. It does not repair or infer privileges from them.

Sign out and log in again after assignment (security stamp is rotated). In
Swagger at /swagger/index.html, use POST /auth/login with your real account
credentials. Authentication uses the existing same-origin HttpOnly cookie;
there is no bearer token to paste. GET /auth/session verifies the session.

Authorization checks without creating content:
- Signed out: GET /api/courses/mine -> 401.
- Signed in with no Instructor membership: same GET -> 403, even if Role says instructor.
- Explicit Instructor: same GET -> 200 (an empty array is valid).
- GeneralAdmin: GET /api/courses/00000000-0000-0000-0000-000000000000
  -> 404 for nonexistent course, proving authorization passed; no membership -> 403.
- To check the category write gate without inserting data, PATCH
  /api/categories/00000000-0000-0000-0000-000000000000/status with
  {"isActive":true}: GeneralAdmin -> 404; unprivileged -> 403; signed out -> 401.

Do not expose a Development instance publicly. The grant command is a local
operator tool, not an HTTP endpoint. Anyone able to run it with database credentials
can grant admin access. Use only explicitly selected accounts; never infer admin
privileges from the legacy Role field. CategoryAdmin assignment does not itself
create category-scoped assignment records.
