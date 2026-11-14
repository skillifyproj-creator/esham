# Phase 1: enrollment, wallet and atomic points handoff

Implementation and isolated verification are complete as of November 14, 2026. See [Phase 1 verification results](PHASE1-VERIFICATION.md): 16 relational cases and 14 browser checks passed. Phase 1 is ready for final acceptance review; hosted purchases remain disabled and Phase 2 has not started. The verification snapshot below records the earlier implementation run and is superseded by that report.

## Safety and configuration

- Reuses Enrollment, Wallet, PointTransaction and EnrollmentVersionAccess without entity, EF configuration, snapshot or migration changes.
- Account finalization and welcome credit are unchanged. No missing wallet or ledger is repaired automatically.
- appsettings.json defaults EnrollmentPurchases:Enabled to false. The service checks the gate; frontend disabling is not the security boundary.
- During this phase the gate also requires EnrollmentPurchases:ApprovedIsolatedDatabase to start with Esham_AccountTests_, match the connection catalog, and use a LocalDB data source. It runs SELECT DB_NAME() and compares the actual connected identity before allowing purchases. db75401 and other hosted targets are refused even if Enabled is true.
- The existing development test-isolation endpoint now verifies the connected identity and returns only isolated/purchasesEnabled booleans. It requires the explicit approved database setting, including for other guarded browser tests.
- All shared development restarts force SeedData__Enabled=false, SeedData__DemoCourses=false and EnrollmentPurchases__Enabled=false. No purchase POSTs, authentication/account writes, seeders, migrations or mutation tests were executed against db75401.
- General hosted/production purchase enablement requires a separate review of the isolated-only gate restriction. Supported relational mutation infrastructure in this phase is LocalDB; other approved SQL infrastructure would require an explicit extension.

An already provisioned isolated database with the current schema is required. Coordinate provisioning with Fatima. Do not run schema commands as part of these instructions. In a dedicated isolated API terminal, obtain the connection through a private file/environment without printing it, then configure:

```powershell
# The private file must contain only the approved isolated connection, not db75401.
$env:ConnectionStrings__DefaultConnection = [IO.File]::ReadAllText('C:\private\approved-isolated-connection.txt').Trim()
$env:EnrollmentPurchases__ApprovedIsolatedDatabase = 'Esham_AccountTests_APPROVED_NAME'
$env:EnrollmentPurchases__Enabled = 'true'
$env:SeedData__Enabled = 'false'
$env:SeedData__DemoCourses = 'false'
$env:Cors__AllowedOrigins__0 = 'http://localhost:5175'
dotnet run --project backend/esham.PL --no-launch-profile -- --environment Development --urls http://localhost:5216
```

Set the separate test frontend API origin to http://localhost:5216 and run it on localhost:5175. Do not repoint the shared frontend as a mutation-test shortcut. Both the browser guard and backend gate must confirm the actual isolated target.

## API contracts

All routes use the existing Identity cookie. Ownership comes from the authenticated account. Enrollment endpoints require actual Learner membership; Both qualifies. Wallet reads require actual Learner or Instructor membership; teaching-summary requires Instructor. Lockout is respected. No public role claims, recipient IDs, prices or balances authorize writes. Financial responses set Cache-Control: private, no-store and X-Content-Type-Options: nosniff.

| Route | Contract |
| --- | --- |
| POST /me/enrollments | {courseId, expectedPublishedVersionId, requestId}; all nonempty GUIDs; unknown fields rejected |
| GET /me/enrollments?page=1&pageSize=20 | {accountId, items, page, pageSize, totalCount} |
| GET /me/enrollments/{id} | {accountId, enrollment}; foreign/missing enrollment returns 404 |
| GET /me/enrollments/purchase-availability | {accountId, enabled, cost:20} |
| GET /me/enrollments/{id}/version-state | Existing endpoint unchanged |
| GET /me/wallet | {accountId, balance, earned, spent}; earned/spent are complete ledger aggregates |
| GET /me/wallet/transactions?page=1&pageSize=20&type=teaching | Owned paginated entries; type optional: welcome, enrollment, teaching |
| GET /me/wallet/teaching-summary?page=1&pageSize=20 | {accountId, items:[{courseId,points}], page, pageSize, totalCount, totalEarned} |

Page sizes are 1..100; positive pages must have a valid nonoverflowing offset. Newest-first histories/enrollments have GUID tie-breaking. Teaching groups use deterministic course-ID order. No operation keys, password hashes, storage keys or counterparty balances are returned.

Enrollment DTO: id, courseId, courseVersionId (original purchase), availableCourseVersionId (nullable), status, enrolledAt, completedAt, lastOpenedAt, titleAr, titleEn, instructorName, instructorNameEn, isAvailable. Titles retain original purchased-version attribution. Availability requires eligible status, current active/approved visible publication and its access receipt. EnrollmentPaused blocks a new purchase, not existing access. Unavailable courses remain in their owner's enrollment list.

Wallet entry DTO: id, amount, transactionType, enrollmentId, courseId, courseTitleAr, courseTitleEn, createdAt. Titles are resolved from the attributed enrollment version. Teaching metrics group persisted recipient-owned teaching entries for currently owned courses, matching existing instructor analytics.

POST requires X-Requested-With: XMLHttpRequest, a trusted Origin/fetch-metadata check, and X-Esham-Account-Id equal to the authenticated NameIdentifier. The account header is only a stale-session precondition, never a recipient selector.

Example first-purchase response (201; Location is the enrollment detail URL):

```json
{
  "accountId": "example-account",
  "requestId": "40000000-0000-4000-8000-000000000001",
  "replayed": false,
  "charge": 20,
  "enrollment": {
    "id": "30000000-0000-4000-8000-000000000001",
    "courseId": "10000000-0000-4000-8000-000000000001",
    "courseVersionId": "20000000-0000-4000-8000-000000000001",
    "availableCourseVersionId": "20000000-0000-4000-8000-000000000001",
    "status": "active",
    "enrolledAt": "2026-11-13T10:00:00+00:00",
    "completedAt": null,
    "lastOpenedAt": null,
    "titleAr": null,
    "titleEn": "Example course",
    "instructorName": "Example instructor",
    "instructorNameEn": null,
    "isAvailable": true
  }
}
```

Exact replay returns 200 and replayed:true. A different request for an existing enrollment returns 409. Request-ID reuse for another course or expected version returns 409/request_conflict without another transfer. First creation versus replay is not a guarantee of byte-identical responses: current availability may change after later publication.

Errors use existing ProblemDetails conventions: 400 invalid input, 401 invalid/locked session, 403 membership/gate/origin denial, 404 missing/foreign resources, 409 business conflicts. New safe codes include purchase_disabled, account_changed, request_conflict, already_enrolled, self_enrollment, course_unavailable, publication_changed, onboarding_required, wallet_unavailable, insufficient_balance. Unexpected SQL/timeout errors retain the existing generic 503/409 handling.

## Transaction and idempotency

1. Verify actual membership, request shape and isolated purchase gate.
2. Allocate enrollment/ledger GUIDs once outside the execution-strategy retry delegate.
3. Clear tracking; start Serializable transaction.
4. Lock the course with UPDLOCK/HOLDLOCK, matching publication's course-first convention.
5. Lock learner/owner user rows in ordinal ID order; recheck current membership/lockout.
6. Look up account-wide request keys before current eligibility/balance checks. Keys bind a hash of the authenticated Identity ID and request GUID with distinct debit/credit namespaces, within the existing size constraint. They are internal only.
7. A complete, matching prior debit/credit/enrollment/original receipt returns the committed outcome. Partial or mismatched evidence conflicts; no auto-repair.
8. Validate no prior enrollment, no self-purchase, active course, unpaused enrollment, actual approved current publication, approval time and EducationalCategories.Visible. Compare the expected publication. Check current onboarding completion through the existing account service.
9. Lock wallets in ordinal user-ID order. Both wallet and valid original welcome entry must exist. Check learner balance >=20 and recipient overflow bounds.
10. Stage active Enrollment, learner -20, owner +20, enrollment/teaching ledger entries, and StageEnrollmentAsync on the same context/transaction. Save and commit together. Clear tracking on exit/retry.

Unique learner/course enrollment, unique operation keys, wallet rowversions/nonnegative constraints and receipt uniqueness remain independent guards. No new reward, welcome grant, enrollment notice or course-update charge is invented.

Two cross-course requests sharing one actor/request ID serialize on the actor's user lock. Once one commits, the other sees the prior request and conflicts. Different request IDs competing for one wallet serialize before affordability validation. Unsuccessful validation rolls back; exceptions dispose the transaction. The SQL strategy retries supported transient failures from fresh tracking. After an acknowledged or unacknowledged commit, persisted keys identify the purchase. Unresolved network outcomes keep the frontend request identity for retry.

Publication races either buy the old publication first and later receive its update receipt, or publication wins and the stale purchase conflicts without a fee. Existing CourseReviewService/CourseVersionUpdates implementation and original enrollment versions are untouched.

## Frontend behavior and boundaries

- FinancialContext uses account-bound server responses and clears state on account changes/expiry. Late reads/mutations cannot update another account. Actual server roles determine which reads are requested.
- Course Details requires the server availability gate, confirmation and a stable account/course intent GUID. Only the unsaved intent is stored in sessionStorage; it is not payment success or balance authority. Timeouts retain it. The server still enforces every condition.
- Purchases refresh canonical wallet/history/enrollment/teaching data without optimistic points changes.
- My Courses lists owned server records with pagination and existing card/layout classes. Status filters explicitly apply to the current page. Unavailable historical purchases remain visible.
- Enrollment detail shows the persisted purchase and existing version-state projection. No static lesson-player entitlement is fabricated. Playback/progress/submissions remain later phases; content-state refresh failure does not erase the enrollment receipt.
- Wallet history uses real attribution/totals and loading/error/retry/empty states. Missing data is shown as unavailable, not a synthetic zero or welcome balance.
- Instructor My Courses now uses persisted teaching summaries across all summary pages instead of one browser-ledger/history page. Existing instructor dashboard/performance services remain unchanged.
- LearnerContext no longer imports browser enrollment/financial state. Dashboard adapters link to real enrollment details and do not fabricate unknown progress. Legacy preview helpers remain for unrelated old fixtures; their financial/enrollment state is not imported into connected flows or SQL. No unrelated profile/preferences storage is deleted.
- Existing Arabic/English text and RTL/LTR styling classes are reused. Progress bars requiring unimplemented progress are omitted rather than showing invented earned evidence.

## Verification

Baseline: backend build 0 warnings/errors; backend 337 passed, 0 failed, 33 SQL skips; frontend 125 passed. Initial sandbox-only backend failures were Windows Data Protection key access failures; rerunning with the required filesystem permission passed without code changes or SQL opt-in.

Commands (SQL opt-out is explicit):

```powershell
$env:ESHAM_RUN_ISOLATED_SQL_TESTS = '0'
dotnet build backend/esham.sln --no-restore --verbosity quiet
dotnet test backend/esham.Tests/esham.Tests.csproj --no-restore --logger 'console;verbosity=normal'
npm.cmd --prefix frontend test
npm.cmd --prefix frontend run build
node --check frontend/scripts/verify-enrollment-wallet.cjs
git diff --check
```

Final results: backend build zero warnings/errors; backend 357 passed, zero failed, 39 SQL skips (33 existing and six new skipped definitions covering ten intended SQL scenarios); frontend 142 passed, zero failed/skipped; frontend build passed with existing dependency directive warnings. Diff/whitespace and browser-script syntax checks passed. InMemory service tests establish rules, not SQL rollback/locking. A local HTTP test host using InMemory verifies auth, origin/session headers, gate, unknown-field rejection, 201/200/409, DTO privacy and no-store caching. An offline SQL Server projection test translates the actual production enrollment projection without opening a connection. Frontend tests cover account isolation, contract validation, stable intent/replay, canonical refresh, no optimistic charge, server totals, role restrictions and bilingual rendering.

EnrollmentSqlServerTests requires all of ESHAM_RUN_ISOLATED_SQL_TESTS=1, ESHAM_ACCOUNT_TEST_SQLSERVER (private connection), and ESHAM_APPROVED_ISOLATED_DATABASE (exact approved LocalDB catalog). VerifiedProvider checks the actual DB identity before any account/category/course fixture write. Tests do not create schema. Pending cases: five concurrency scenarios (same request, different requests/duplicate, cross-course same key, cross-course affordability and shared instructor), post-save rollback, lost response, lost commit acknowledgement, transient-save retry and publication race. Skipped theory definitions are reported once by the runner rather than once per inline case.

The guarded browser script additionally needs Playwright/Edge and dedicated isolated fixture learner/instructor credentials/course through ESHAM_TEST_* environment variables. It requires a fresh learner wallet of 20 points, logs in only after the actual isolated target and enabled purchase gate are verified, tests purchase/replay and both wallet outcomes, and checks My Courses at 390/1440px in Arabic/English. It was not run: approved isolated infrastructure is unavailable. Do not run it against port 5206 or shared accounts. Do not globally enable existing schema/backfill tests without Fatima's coordination.

Shared runtime smoke checks are GET/OPTIONS only: Swagger, categories, public catalog, safety handshake and credentialed CORS. No shared financial POST was sent. Known missing cover/HTTP HTTPS-port warning are outside this phase.

Final shared smoke results: safety handshake isolated:false/purchasesEnabled:false; Swagger 200; six categories and 13 public courses; anonymous wallet/enrollment reads 401; frontend 200. A fresh anonymous headless Edge profile rendered the real public course detail and sign-in enrollment action without a fatal fallback. No login, purchase or browser mutation was attempted on the shared target. Backend and frontend remain running for review with purchases disabled.

## Acceptance and remaining blockers

- Implemented: APIs, actual membership/ownership, trusted mutation and account binding, gate, 20/20/20 rules, one retry-aware transaction, persisted request identity, version staging, real frontend financial/enrollment authority and instructor teaching metrics.
- Verified without relational mutations: builds, service/security/HTTP tests, frontend tests/build and offline enrollment SQL translation.
- Verified November 14: actual SQL locking, rollback, staging failure, commit-ambiguity recovery, publication/concurrent-wallet races and browser purchase behavior on the approved isolated LocalDB target. Current commands, counts, safety checks and acceptance checklist are in PHASE1-VERIFICATION.md.
- No schema gap identified. Missing real wallets fail closed for coordinated investigation; no data recovery is performed here.
- Intentional boundary: read-only enrollment detail replaces static learning links; no Phase 2 learning writes are added. Purchases remain disabled on hosted SQL, including db75401. Production enablement is a later approval.

## File manifest (this phase only)

Added backend files:

- backend/PHASE1-ENROLLMENT-WALLET.md
- backend/esham.BLL/DTOs/Enrollments/EnrollmentDtos.cs
- backend/esham.BLL/DTOs/Wallets/WalletDtos.cs
- backend/esham.BLL/Interfaces/IEnrollmentService.cs
- backend/esham.BLL/Interfaces/IWalletService.cs
- backend/esham.BLL/Services/EnrollmentPurchaseGate.cs
- backend/esham.BLL/Services/EnrollmentService.cs
- backend/esham.BLL/Services/FinancialAccess.cs
- backend/esham.BLL/Services/WalletService.cs
- backend/esham.PL/Endpoints/EnrollmentEndpoints.cs
- backend/esham.PL/Endpoints/WalletEndpoints.cs
- backend/esham.Tests/EnrollmentTests.cs
- backend/esham.Tests/EnrollmentApiTests.cs
- backend/esham.Tests/EnrollmentSqlServerTests.cs

Modified backend files: backend/esham.PL/Program.cs; backend/esham.PL/appsettings.json; backend/esham.PL/Endpoints/ServiceResults.cs.

Added frontend files:

- frontend/src/components/learner/EnrollmentAction.jsx
- frontend/src/context/FinancialContext.jsx
- frontend/src/pages/learner/LearnerEnrollmentPage.jsx
- frontend/src/services/enrollments.js
- frontend/src/services/wallet.js
- frontend/src/services/financialApi.js
- frontend/src/services/financialStore.js
- frontend/tests/enrollment-wallet.test.mjs
- frontend/scripts/verify-enrollment-wallet.cjs

Modified frontend files: frontend/package.json; frontend/src/App.jsx; frontend/src/context/LearnerContext.jsx; frontend/src/data/learnerHelpers.js; frontend/src/hooks/useLearnerWallet.js; frontend/src/pages/CourseDetailsPage.jsx; frontend/src/pages/instructor/InstructorCoursesPage.jsx; frontend/src/pages/learner/LearnerCoursesPage.jsx; frontend/src/pages/learner/LearnerDashboard.jsx; frontend/src/pages/learner/LearnerPointsPage.jsx.

Pre-existing local README.md changes, backend/LOCAL-DEVELOPMENT.md and backend/scripts/Set-DevelopmentConnection.ps1 were preserved, not introduced by Phase 1. No Git commit/push/reset or dependency changes were performed.
