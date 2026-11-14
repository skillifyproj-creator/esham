# Phase 1 relational and browser verification — November 14, 2026

All Phase 1 verification criteria now pass on the explicitly authorized disposable LocalDB target. Phase 1 is ready for final acceptance review. This is not approval to enable hosted purchases or start Phase 2.

## Verified environment and boundaries

| Setting | Verified value |
| --- | --- |
| Engine | SQL Server 2022 LocalDB 16.0.1000.6 |
| Instance | (localdb)\MSSQLLocalDB, Windows integrated authentication |
| Actual SERVERPROPERTY('IsLocalDB') | 1 |
| Actual SERVERPROPERTY('ServerName') | DESKTOP-I0292P0\LOCALDB#AE4D4644 |
| Actual DB_NAME() | Esham_AccountTests_Phase1_20261114 |
| Schema | Existing InitialIdentity, AddEshamDomainModel, AddCourseVersionUpdates migrations only |
| Isolated API / frontend | localhost:5216 / localhost:5175 |
| Isolated safety handshake | isolated:true, purchasesEnabled:true |
| Shared API / frontend | localhost:5206 / localhost:5174 |
| Shared safety handshake | isolated:false, purchasesEnabled:false |

The user explicitly authorized creation and migration of a new local test catalog. Phase1IsolatedEnvironmentTests verifies the local engine/master identity before CREATE DATABASE, refuses an existing catalog instead of resetting it, re-verifies the target before applying existing migrations, and asserts exactly the repository's three migrations. No new migrations were generated. No hosted connection is read by the provisioning/test fixture path.

All relational fixture methods re-verify the actual target before mutation. A negative relational test changes its local connection's current catalog to master and confirms the purchase gate refuses it, then restores the approved catalog and confirms the gate accepts it. This tests the connected identity rather than trusting connection-string text alone. Shared db75401 is refused by configuration and the gate.

Isolated configuration is process-scoped. Shared User Secrets were not overwritten. Both API processes have automatic application seeders disabled; the isolated fixtures explicitly initialize only synthetic identities/roles, welcome wallets and courses after verification. Accounts use generated example.test emails and test-only credentials, never copied shared accounts. Their private fixture artifacts remain under Git-ignored artifacts/phase1-isolated/ and must not be committed or pasted into reports.

The isolated frontend uses frontend/vite.phase1.config.js, a separate optimizer cache and a process-only VITE_API_BASE_URL. Shared .env.local and its API origin remain unchanged. Browser contexts are fresh and isolated from normal browser cookies; localhost cookies are not partitioned by port, so do not reuse a shared-account browser profile for these tests.

## Final commands and results

Commands ran from the repository root unless stated otherwise. ESHAM_ACCOUNT_TEST_SQLSERVER was supplied only as a process-local integrated-auth LocalDB connection; it is deliberately not reproduced here. ESHAM_APPROVED_ISOLATED_DATABASE was the exact catalog above. No unrelated SQL test class was enabled through an unfiltered run.

| Check | Passed | Failed | Skipped |
| --- | ---: | ---: | ---: |
| New isolated catalog + existing migrations | 1 | 0 | 0 |
| Final synthetic browser fixture setup | 1 | 0 | 0 |
| Focused Phase 1 relational suite | 16 | 0 | 0 |
| Controlled browser publication fixture action | 1 | 0 | 0 |
| Persisted browser invariants | 1 | 0 | 0 |
| Browser checks | 14 | 0 | 0 |
| Full backend regression with SQL opt-out | 357 | 0 | 47 |
| Frontend automated tests | 142 | 0 | 0 |

Backend build passed with zero warnings/errors. Frontend build passed with existing dependency directive warnings. Diff/whitespace and verification-script syntax checks passed. The 47 opt-out skips are 33 unrelated SQL definitions, ten Phase 1 SQL definitions (executed separately as 16 expanded cases), and four explicit manual setup actions. They are not unresolved Phase 1 failures.

Provisioning and synthetic setup are individually selected and guarded by ESHAM_PHASE1_SETUP. The provision action is one-time and intentionally refuses a repeat against an existing catalog:

```powershell
# Approved LocalDB test connection and artifact directory are already process-configured.
$env:ESHAM_RUN_ISOLATED_SQL_TESTS='1'
$env:ESHAM_APPROVED_ISOLATED_DATABASE='Esham_AccountTests_Phase1_20261114'

$env:ESHAM_PHASE1_SETUP='provision'
dotnet test backend/esham.Tests/esham.Tests.csproj --no-restore --filter 'FullyQualifiedName~Provision_new_disposable_catalog' --logger 'console;verbosity=normal'

# Use a new private artifact name and fresh synthetic accounts for each browser run;
# do not reset existing accounts, wallets or database records.
$env:ESHAM_PHASE1_SETUP='fixtures'
$env:ESHAM_PHASE1_FIXTURE_NAME='browser-fixtures-run3.json'
dotnet test backend/esham.Tests/esham.Tests.csproj --no-build --filter 'FullyQualifiedName~Create_synthetic_browser_fixtures' --logger 'console;verbosity=normal'

$env:ESHAM_PHASE1_SETUP=''
dotnet test backend/esham.Tests/esham.Tests.csproj --no-restore --filter 'FullyQualifiedName~esham.Tests.EnrollmentSqlServerTests' --logger 'console;verbosity=normal'

# Browser: ESHAM_TEST_API/FRONTEND identify 5216/5175; PLAYWRIGHT_MODULE identifies
# the temporary tool; ESHAM_PHASE1_FIXTURE_FILE identifies the private fresh fixture.
node frontend/scripts/verify-enrollment-wallet.cjs

$env:ESHAM_PHASE1_SETUP='invariants'
dotnet test backend/esham.Tests/esham.Tests.csproj --no-build --filter 'FullyQualifiedName~Verify_persisted_browser_purchase' --logger 'console;verbosity=normal'

# Full regression must opt OUT again; do not enable unrelated schema/backfill tests.
$env:ESHAM_RUN_ISOLATED_SQL_TESTS='0'
$env:ESHAM_PHASE1_SETUP=''
dotnet build backend/esham.sln --no-restore --verbosity quiet
dotnet test backend/esham.Tests/esham.Tests.csproj --no-build --logger 'console;verbosity=normal'
npm.cmd --prefix frontend test
npm.cmd --prefix frontend run build
git diff --check
```

The browser harness invokes only Advance_only_the_synthetic_browser_publication with ESHAM_PHASE1_SETUP=publish for the controlled stale-publication case. That action repeats the connected identity check and uses only the selected synthetic fixture course. It does not expose a debug mutation endpoint or alter production publication code.

Playwright 1.65.1 was installed as a temporary tool outside the repository and used installed Edge. No project dependency/lockfile changed and no browser engine was downloaded.

## Relational coverage

All sixteen cases passed:

1. Concurrent identical request replay: one purchase and one replay.
2. Independent duplicate requests: one success, one conflict, one transfer.
3. Cross-course request-ID reuse: account-wide key conflict without a second charge.
4. Different courses competing for the learner's 20-point balance.
5. Concurrent credits from distinct learners to the same instructor.
6. Successful learner purchase, persisted aggregates and owned/foreign reads.
7. Successful Both-role purchase with the same membership/ownership guarantees.
8. Access-staging failure after intermediate persistence: complete rollback.
9. Failure after SaveChanges before commit: complete rollback.
10. Lost client response recovered through persisted replay in a new scope.
11. Lost commit acknowledgement recovered by the execution strategy without duplicate credit.
12. Transient save failure retried with fresh tracked wallet/enrollment state.
13. Actual concurrent publication-versus-purchase race.
14. Publication wins the lock order: stale confirmation fails without a fee.
15. Purchase wins the lock order: original version retained, later receipt added without a new fee.
16. Gate rejects a changed actual connected database despite original connection configuration.

The relational ownership tests also reject forged role claims, isolate other learners' enrollment/history reads, and verify correct instructor totals. Existing non-SQL API tests retain origin/header/session precondition, JSON validation and DTO privacy coverage.

## Browser coverage

Fourteen checks passed using only the real isolated API/database:

- Purchase confirmation and double-click prevention: one POST, 201 and correct GUID/version attribution.
- Wallet 0, instructor wallet 40, persisted debit/history and no operation-key exposure.
- Exact request replay: 200/replayed:true with unchanged balances and same enrollment.
- My Courses: actual saved enrollment and its GUID detail link.
- Instructor My Courses: actual persisted 20-point teaching metric.
- Insufficient balance: second course rejected with 409 and no transfer.
- Account switching with a deliberately delayed real previous-account response: no old wallet/history overwrite.
- Foreign enrollment 404, stale account precondition 409 and self-enrollment UI denial.
- Stale publication: 409/publication_changed, no charge after the controlled publication advance.
- Expired session: wallet UI cleared, sign-in required, anonymous wallet API 401.
- My Courses Arabic 390px, Arabic 1440px, English 390px and English 1440px: correct RTL/LTR, no horizontal overflow and persisted enrollment visible.

The account-switch harness delays a real response body. It removes its already-processed Set-Cookie header when fulfilling that captured response, avoiding Playwright applying the old cookie twice. No fabricated balance/enrollment response substitutes for database results. The fixture's initial language default respects later explicit language selections.

## Persisted invariant evidence

The final fresh browser fixture was inspected directly through SQL after all browser actions:

| Invariant | Result |
| --- | --- |
| Learner A enrollments | Exactly one, for the purchased course |
| Purchase ledger entries | Exactly two: learner enrollment -20, instructor teaching +20 |
| Transfer sum | 0 |
| Learner A / Learner B / instructor balance | 0 / 20 / 40 |
| Initial version receipt | Exactly one, reason enrolled, original purchased version |
| Welcome entries | Exactly one per fixture account |
| Failed insufficient/stale/ownership attempts | No extra enrollment or financial transfer |

Non-sensitive machine-readable artifacts: database-identity.json, persisted-invariants.json and browser-results.json under artifacts/phase1-isolated/. Arabic/English layout screenshots are also there. Synthetic login fixtures and diagnostic artifacts are private and Git ignored.

## Defects and harness corrections

- The first relational run failed 10/10 during fixture setup because CourseVersion.VersionNumber defaulted to zero. InMemory had not enforced the existing SQL check constraint. Setting synthetic version numbers to 1 fixed the fixture; the unchanged runtime transaction then passed all scenarios. No schema constraint was relaxed.
- Browser run 1 passed six checks then failed the delayed-response harness because route.fetch's cookie renewal was replayed a second time. The corrected body-delay harness passed the account-switch case.
- Browser run 2 passed ten checks then failed Arabic layout because its English init script overwrote the explicitly selected Arabic preference on every navigation. The corrected default no longer overwrites an existing selection.
- Final browser run used a fresh synthetic graph and passed all fourteen checks. Earlier synthetic fixtures were retained in the disposable catalog, not reset or repaired. Their failure logs are historical, not current acceptance failures.
- No runtime service, financial policy, DAL schema, migration, Admin/Instructor moderation, chatbot or AI change was required by this verification.

Files added/updated in this verification: backend/esham.Tests/Phase1IsolatedEnvironmentTests.cs (new); backend/esham.Tests/EnrollmentTests.cs (fixture version); backend/esham.Tests/EnrollmentSqlServerTests.cs (expanded relational coverage); frontend/vite.phase1.config.js (new); frontend/scripts/verify-enrollment-wallet.cjs (expanded harness); this report; backend/PHASE1-ENROLLMENT-WALLET.md (status update). All pre-existing local work was preserved; no commit/push/reset was performed.

## Final acceptance checklist

- [x] Existing schema/entities and all three existing migrations reused.
- [x] Only the newly authorized isolated database was created/migrated.
- [x] Actual LocalDB instance and database identity checked before mutation.
- [x] Isolated runtime 5216/5175 separated from shared 5206/5174.
- [x] Shared db75401 purchases and automatic seeders remain disabled.
- [x] Successful atomic purchase and exactly-once ledger/access invariants persisted.
- [x] Duplicate/replay/cross-course key/insufficient-funds behavior verified.
- [x] SQL concurrency, rollback, staging failure and commit ambiguity verified.
- [x] Publication races and both resulting version-access orders verified.
- [x] Browser purchase, wallet/history, My Courses and instructor points verified.
- [x] Ownership, account switch, expired session and responsive bilingual behavior verified.
- [x] Non-SQL regression, frontend tests and builds pass.
- [x] No shared database/account mutation, new migration or secret disclosure.
- [x] Phase 2 not started.

Assessment: Phase 1 verification is complete and ready for final acceptance review. Hosted purchase enablement remains intentionally blocked and requires separate approval. Known missing cover/local HTTPS warning remain outside this phase.
