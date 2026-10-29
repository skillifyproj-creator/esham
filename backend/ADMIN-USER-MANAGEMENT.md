# Mais-owned Admin User Management

This implementation reuses ApplicationUser/Identity, the existing four roles,
Identity lockout and security stamps, AppDbContext, ServiceResult, and the existing
AdminActivityLog entity. No entities, model configuration, migrations, package
versions, course/category business logic or points policy were changed.

## API contracts

All routes require the existing Identity cookie and actual database-backed
**GeneralAdmin** membership. CategoryAdmin is a scoped content role and does not
grant global user-directory access. Legacy personas and forged role claims are
not authorization. Service methods also authorize independently of the HTTP layer.

| Method | Route | Contract |
| --- | --- | --- |
| GET | `/api/admin/users` | `page=1&pageSize=20&search=&role=&status=` |
| GET | `/api/admin/users/{id}` | Existing nonempty GUID user identifier |
| PUT | `/api/admin/users/{id}/roles` | `{ "roles": ["Learner", "Instructor"], "version": "<opaque version>" }` |
| PUT | `/api/admin/users/{id}/lockout` | `{ "lockoutEnd": "<future ISO timestamp or null>", "version": "<opaque version>" }` |

Pagination is one-based, pageSize is 1–100, offset overflow is rejected, and trimmed
search is limited to 100 characters. Search matches name, normalized username or
normalized email using literal substring matching. Order is normalized username,
then unchanged user ID. Role filters are the four canonical roles or
`administrators` (GeneralAdmin or CategoryAdmin). Status filters are `locked` and
`unlocked`, using Identity's LockoutEnabled/LockoutEnd at request time. Omit a filter
for all values. Counts/pages are live reads, not a multi-request snapshot.

The list returns `{ items, page, pageSize, totalCount }`. List/detail/mutation user
DTOs contain only id, name, username, email, actual roles, emailConfirmed,
lockoutEnabled, lockoutEnd, isLockedOut and version. No password hash, security
stamp, raw concurrency stamp, tokens, phone, avatar, biography, wallet or enrollment
data is returned. Version is a one-way SHA-256 representation of ConcurrencyStamp,
used only as an optimistic edit token; it is not an authentication credential.

HTTP conventions: 400 invalid input; 401 absent/invalid/locked session; 403 missing
GeneralAdmin membership or rejected application origin/header; 404 missing target;
409 stale version, protection rule, unsupported transition or concurrency conflict;
existing 503 handling for database unavailability. PUT JSON rejects unknown body
fields and requires the documented fields. Missing lockoutEnd cannot accidentally
mean unlock; explicit null is required.

## Supported actions and blockers

- Learner and Instructor remain separate memberships; both maps to the existing
  `ApplicationUser.Role = "both"` persona. No Combined Identity role exists.
- GeneralAdmin can deliberately add/remove GeneralAdmin on other accounts, subject
  to self/last-administrator protection. No endpoint creates accounts or roles.
- CategoryAdmin membership must remain exactly as it was. Granting/removing it is
  blocked because category-scope assignment belongs to Fatima and requires an
  agreed atomic assignment contract. Existing CategoryAdmin and category assignments
  are preserved. Unknown legacy roles block membership editing rather than being
  silently deleted. The shared role catalog reuses the existing development helper
  contract; its role names and persona mapping are unchanged.
- Timed sign-in lockout uses existing LockoutEnd only when LockoutEnabled is already
  true. Explicit null clears lockout and resets failed attempts. The API does not
  silently enable lockout on an account where it is disabled.
- Existing self-service onboarding lets users select Learner/Instructor personas.
  Removing those memberships is therefore not a permanent ban: the user may
  legitimately onboard again. Administrative privileges cannot be self-granted.
  Persistent bans require the separate account-status policy/schema decision below.
- **Activation/deactivation/suspension is blocked:** ApplicationUser has no such
  business-status field. Lockout is explicitly presented as timed Identity sign-in
  protection, not as an invented suspension status. Permanent activation/suspension
  requires approved semantics and migration coordination with Fatima.
- Creation, deletion, created-at and last-active management are not invented; those
  actions/fields are absent from the new screens or clearly unavailable.
- Identity IDs are stored as strings by the existing schema but normally generated
  as GUIDs. Targets use existing GUIDs, never regenerated identifiers. If historical
  non-GUID user IDs exist, their reconciliation needs separate coordination; the
  API does not rename identities to manufacture GUIDs.

## Security, transactions and sessions

Administrative self-modification is rejected, including case variants of one's
own GUID. Read-only self-inspection is allowed. The last unlocked GeneralAdmin
cannot be demoted or administratively locked. "Unlocked" is the only availability
state supported by the current model; email verification is informational and
there is no invented active flag.

Writes use the SQL Server execution strategy and a Serializable transaction.
They lock the existing GENERALADMIN role row with UPDLOCK/HOLDLOCK as a global
administrative gate, then actor/target user rows in deterministic order. Actor
membership/lockout, target existence, opaque version and last-admin availability
are rechecked after waiting. Identity's intermediate saves, persona synchronization,
security-stamp rotation and one existing-model security audit entry commit together.
Failures roll back and clear tracking; retries reload state. A lost commit
acknowledgement can conservatively return 409 on replay because the version changed;
the UI reloads details rather than replaying a stale full role set as success.

Last-admin protection covers these administrative APIs. Direct database edits or
other future role writers must follow the same coordination rules. Natural failed-
password lockout can still temporarily lock an administrator; this implementation
does not weaken brute-force protection to maintain a misleading active count.
Existing explicitly provisioned administrator accounts/recovery procedures remain
a deployment prerequisite; no bootstrap administrator is created automatically.

Successful mutations rotate SecurityStamp. Program configures Identity stamp
validation on every authenticated request and preserves Identity's normal ticket
validation/claims refresh. The cookie validator additionally rejects locked users,
including lockout from failed passwords where the stamp did not change. Existing
sessions are invalidated on their next request, not by cancelling in-flight HTTP
responses. This introduces additional Identity database reads per request.
Account finalization and direct session retrieval also reject locked users.

Mutation endpoints require the existing X-Requested-With: XMLHttpRequest header.
Browser Origin must match the API origin or an explicitly configured
Cors:AllowedOrigins entry; unsupported/null origins are rejected. Fetch Metadata
marked cross-site/same-site without Origin is rejected. Nonbrowser tools without
Origin/Fetch Metadata still require the application header and authenticated cookie.
The existing JSON binding, exact CORS origins and cookie policy remain in place.
Configure the actual frontend origin; no wildcard credentialed origin is added.

Wallet balances, welcome grants, ledger entries, enrollment, learning categories
and teaching category selections are not changed by these actions. A security
audit row records actor/target IDs and action type, with no credentials or stamp
values. The existing content/activity interfaces are not replaced by an invented
audit-log UI.

## Frontend integration

- `/admin/users` now uses the server directory, pagination/search/filtering and a
  details modal for versioned membership and timed-lockout actions.
- `/admin/admins` reuses that directory with the actual administrator-role filter.
  Mock admin creation and local user activation toggles are removed from these
  routed screens. Existing category-assignment demo state used by Fatima-owned
  category/content screens is left separate and unchanged.
- User/administrator count cards use directory totals, with no mock count fallback.
  Unsupported registration/activity dates and imaginary active statuses are not
  displayed as server facts. Existing table, form, modal, card and responsive CSS
  classes remain in use.
- The screens require a restored server session with GeneralAdmin membership,
  while APIs enforce the same independently. Loading, empty, API error, permission
  denial, conflict and retry states do not fall back to local user lists.
- Roles and lockout updates wait for validated server responses. No localStorage
  user list or role update is an authoritative source. Self-action controls,
  CategoryAdmin changes, activation/suspension and deletion are disabled visibly.
- Successful authentication routes actual GeneralAdmin users to `/admin` and
  CategoryAdmin to the existing category workspace. Admin sidebar identity comes
  from the restored account. Shared admin logout now calls `/auth/logout`, clears
  the in-memory session/cache and navigates only after server acknowledgement.
- Course, category, moderation, publication and curriculum handlers remain unchanged.
  Their preexisting demo/integration limitations are outside this account task.

## Verification

Commands executed without application startup or shared database access:

```text
dotnet build backend/esham.sln --no-restore
dotnet test backend/esham.Tests/esham.Tests.csproj --no-restore
npm --prefix frontend test
npm --prefix frontend run build
git diff --check
```

Backend: 130 passed, 0 failed, 12 SQL tests skipped (4 new admin SQL tests and
8 existing SQL tests). Build has zero warnings/errors. Frontend: 68 passed,
0 failed, 0 skipped; production build passes with existing third-party bundler
warnings. No npm/NuGet package versions were added or changed.

New offline tests cover anonymous/non-admin/forged-claim rejection, authorized
reads, paging/filter/search, role transitions, case-insensitive self protection,
last administrator, stale edits, disabled lockout, future dates, safe DTOs,
unchanged wallet/enrollment/category sentinels, cookie invalidation after role
and lockout changes, automatic lockout, auth metadata and origin/header protection.
Frontend tests exercise real contracts, GUID IDs, versioned requests, cookie/header
handling, roles, timed lockout, rejected API actions, routing, permission/loading
states, bilingual real-data rendering and removal of routed fake-success handlers.

AdminUserSqlServerTests is skipped unless ESHAM_RUN_ISOLATED_SQL_TESTS=1 and a
separately provisioned ESHAM_ACCOUNT_TEST_SQLSERVER is supplied. Its database name
must begin with Esham_AccountTests_. Tests never read application settings/secrets,
create databases/schema or apply migrations. They cover cross-demotions,
conflicting same-version updates, rollback after Identity saves, and actual SQL
directory queries. They add isolated test records and require external disposal of
that isolated database. InMemory cannot prove SQL locking/rollback; SQL concurrency
and live deployment verification remain outstanding.

## Exact changed-file manifest for this task

Earlier account/category/enrollment-readiness work was already uncommitted and
has been retained. This task adds/modifies these files only:

| File | Change |
| --- | --- |
| backend/esham.BLL/Security/AccountRoles.cs | New shared existing-role/persona catalog |
| backend/esham.BLL/DTOs/AdminUsers/AdminUserDtos.cs | New directory, detail and mutation DTOs |
| backend/esham.BLL/Interfaces/IAdminUserService.cs | New service contract |
| backend/esham.BLL/Services/AdminUserService.cs | New authorized transactional administration |
| backend/esham.BLL/DTOs/ServiceResult.cs | Add unauthenticated service failure |
| backend/esham.BLL/Services/AccountService.cs | Reject locked session/finalization |
| backend/esham.PL/Endpoints/AdminUserEndpoints.cs | New routes and origin/header protection |
| backend/esham.PL/Endpoints/AccountCookieValidation.cs | Immediate stamp/lockout validation |
| backend/esham.PL/Endpoints/ServiceResults.cs | Map unauthenticated to 401 |
| backend/esham.PL/Development/DevelopmentIdentityRoles.cs | Delegate existing catalog/persona to shared helper |
| backend/esham.PL/Program.cs | DI, routes and cookie validation registration |
| backend/esham.Tests/AdminUserTests.cs | New offline security/service/cookie tests |
| backend/esham.Tests/AdminUserSqlServerTests.cs | New explicit isolated SQL tests |
| frontend/src/services/adminUsers.js | New real admin API client and routing/error helpers |
| frontend/src/pages/admin/AdminUsersPage.jsx | New server-backed directory/details/actions |
| frontend/src/pages/admin/SuperAdminModule.jsx | Replace routed mock users/admins and account count/identity displays |
| frontend/src/components/admin/AdminWorkspace.jsx | Real sign-out and session invalidation |
| frontend/src/context/AccountSessionContext.jsx | Export context for provider-backed rendering tests |
| frontend/src/pages/auth/LoginPage.jsx | Route by actual administrative memberships |
| frontend/src/pages/auth/GoogleAuthComplete.jsx | Same membership-backed routing |
| frontend/tests/admin-users.test.mjs | New contract, authorization and rendering tests |
| frontend/package.json | Include new tests in existing test command |
| backend/ADMIN-USER-MANAGEMENT.md | This report, contracts, blockers and manifest |

No Enrollment, Notifications, Reviews, Progress, Submissions or Certificates
implementation was started. Await review before further feature work.
