# Phase 4 verification — updated November 22, 2026

Implementation: [PHASE4-COMPLETION-CERTIFICATES.md](PHASE4-COMPLETION-CERTIFICATES.md).

## Environment and database safety

| Item | Observed/configured state |
| --- | --- |
| Actual DB_NAME() | Esham_AccountTests_Phase1_20261114 |
| Configured instance | (localdb)\MSSQLLocalDB |
| Actual IsLocalDB | 1 |
| Recorded actual server | DESKTOP-I0292P0\LOCALDB#86D9651D |
| Isolated API/frontend | 5216 / 5175 |
| Isolated handshake | isolated, purchasesEnabled, progressWritesEnabled, submissionMutationsEnabled, completionMutationsEnabled, mediaIsolated = true |
| Catalog-wide background recovery | Disabled during verification; the actual scan is tested against fresh course scopes |
| Application startup seeding | Both flags explicitly false |
| Credentials/configuration | Process-local integrated-auth LocalDB; shared User Secrets unchanged |
| Private media | Existing artifacts/phase2-isolated/media; fresh synthetic keys only |
| Reports/fixtures/PDF/screenshots | Git-ignored artifacts/phase4-isolated and artifacts/phase4-results |
| Shared database | No connections, mutations, seeders, schema commands or account logins initiated by these tests |
| Shared runtime | Not started, restarted or configured by this phase; hosted enablement remains prohibited |
| Schema/dependencies | No migrations, database provisioning/reset, new packages or rendering dependencies |

Every SQL provider/fixture first verifies the actual approved database and LocalDB identity. The Phase 4 gate checks again within business transactions. Tests demonstrate that master and configured hosted/unapproved targets are refused. Negative hosted-target tests never open their configured connection.

## Initial implementation results (historical; superseded by hardening below)

| Check | Passed | Failed | Skipped |
| --- | ---: | ---: | ---: |
| Complete safe backend regression | 395 | 0 | 94 |
| Phase 4 relational scenarios | 15 | 0 | 0 |
| Phase 1 financial SQL regression | 16 | 0 | 0 |
| Phase 2 learning SQL regression | 12 | 0 | 0 |
| Phase 3 submissions SQL regression | 18 | 0 | 0 |
| Existing instructor SQL regression | 1 | 0 | 0 |
| Selected relational aggregate (sequential suites) | 62 | 0 | 0 |
| Frontend automated suite | 162 | 0 | 0 |
| Phase 4 browser | 15 | 0 | 0 |
| Phase 1 browser regression | 14 | 0 | 0 |
| Phase 2 browser regression | 13 | 0 | 0 |
| Phase 3 browser regression | 15 | 0 | 0 |
| Browser aggregate, Phases 1–4 | 57 | 0 | 0 |
| Phase 4 persisted browser invariants | 1 | 0 | 0 |
| Phase 1–3 persisted regression invariants | 3 | 0 | 0 |
| Final fresh fixture preparation, Phases 1–4 | 4 | 0 | 0 |

Final backend solution build passes with zero warnings/errors; frontend production build passes. Swagger returns HTTP 200 on the isolated API. Separate output directories avoid assemblies used by runtime processes. Frontend retains existing dependency build warnings; no new dependency was introduced. The 94 safe-run skips are SQL/explicit fixture actions, not successful relational tests; only the named SQL suites were opted in separately.

## Executed commands

Commands run from the repository root unless stated otherwise. Integrated-auth connection values are deliberately omitted. SQL opt-in configuration is process-local and never loaded from hosted User Secrets.

```powershell
dotnet build backend/esham.PL/esham.PL.csproj --no-restore -p:OutputPath=C:\Users\HP\Documents\esham\artifacts\phase4-runtime-final-checked\ --verbosity quiet
dotnet build backend/esham.sln --no-restore -p:OutputPath=C:\Users\HP\Documents\esham\artifacts\phase4-solution-build\ --verbosity quiet

$env:ESHAM_RUN_ISOLATED_SQL_TESTS='0'
dotnet test backend/esham.Tests/esham.Tests.csproj --no-restore -p:OutputPath=C:\Users\HP\Documents\esham\artifacts\phase4-tests\ --logger 'trx;LogFileName=final-safe.trx' --results-directory artifacts/phase4-results

# Only after actual isolated target verification and process-local test configuration:
$env:ESHAM_RUN_ISOLATED_SQL_TESTS='1'
$env:ESHAM_APPROVED_ISOLATED_DATABASE='Esham_AccountTests_Phase1_20261114'
# Run separately for each suite below, not an unfiltered SQL opt-in:
dotnet test backend/esham.Tests/esham.Tests.csproj --no-build -p:OutputPath=C:\Users\HP\Documents\esham\artifacts\phase4-tests\ --filter 'FullyQualifiedName~CompletionSqlServerTests' --logger 'trx;LogFileName=final-CompletionSqlServerTests.trx' --results-directory artifacts/phase4-results
# Repeat with EnrollmentSqlServerTests, LessonProgressSqlServerTests,
# SubmissionSqlServerTests, InstructorInsightsTests.Sql_server_queries.

# From frontend/:
npm.cmd test
npm.cmd run build

# With approved isolated runtime, fresh fixtures and existing temporary Playwright:
node frontend/scripts/verify-enrollment-wallet.cjs
node frontend/scripts/verify-learning-progress.cjs
node frontend/scripts/verify-learner-submissions.cjs
node frontend/scripts/verify-completion-certificates.cjs
git diff --check
```

Explicit Phase1/2/3/4 setup actions create fresh fixture graphs only after target guards. Phase 1 filenames must match the existing safe filename expression and must not already exist. Each phase writes into its own Phase 4 artifact subdirectory, preserving prior phase reports and records. Invariant actions use the same private fixture pointers after browser runs. Do not indiscriminately opt in unrelated SQL tests.

## Relational evidence

The 15 Phase 4 cases cover:

1. Six concurrent reconciliation requests: one certificate, timestamp and notice; unchanged financial policy/receipt.
2. Concurrent last-lesson completion hooks and replay.
3–5. Failure after progress, certificate or notification persistence: full rollback.
6. Approval hook plus repeated assessment conflict.
7. Failed approval finalization: review/status/assessment notice/certificate all roll back.
8. Transient retry and post-commit acknowledgement loss reconcile committed identity.
9. Repeatable scoped durable recovery.
10. Publication race with correct completion-version attribution and original receipt preservation.
11. Admin-only gated revocation, one audit and minimal public result.
12. Actual identity check inside a transaction and rejection of master.
13. Disabled automatic lesson/assessment hooks preserve earlier behavior; later recovery finalizes.
14. Last lesson versus instructor approval race.
15. Durable recovery after publication removes an unmet requirement, using historical logical evidence and the new version without changing purchase attribution.

Safe tests additionally cover empty curriculum, rounded 100% with an outstanding lesson, task-only remaining requirements, unavailable course, missing receipt, historical ambiguity, immutable completion/snapshots, name changes, actual membership/Both, ownership, origin/account preconditions, public privacy/throttling, optional rejected attempts and paused enrollment policy.

## Browser and persisted invariants

Real Edge contexts use only localhost 5216/5175 and fresh synthetic accounts. Tests cover lesson acknowledgement, pending required approval, instructor approval, atomic issuance, repeated reconciliation, My Courses, enrollment links, certificate list/detail, forged local profile data, browser PDF, public verification, ownership/account switching, responsive bilingual layouts, revocation, expiry and throttling. The extended final run also covers a deliberately delayed previous-account response and Arabic PDF output.

Persisted comparison excludes legitimate completion changes and compares the original enrollment attribution/date, wallet balances/timestamps, both transfer entries and complete version receipts. It separately requires one completed enrollment, one certificate, one certificate notification, one immutable review and one revocation audit. No internal ledger operation keys are copied into browser responses or public reports.

## Diagnostic failures and fixes

- Restricted initial backend baseline: 339 passed, 39 failed, 79 skipped. The failures were denied Windows Data Protection key access. Authorized tests with that filesystem access pass; no application security weakening was introduced.
- PowerShell blocked npm.ps1; commands use npm.cmd without changing execution policy globally.
- Initial combined SQL run: 56 passed, 3 failed, 0 skipped. Phase 2 tests exhausted deadlock retries amid parallel fixture/suite activity in one catalog. Final named suites run separately while retaining actual request concurrency within each scenario. User locking now consistently sorts learner/instructor rows; assessment discovery no longer takes serializable user/evidence reads before the course lock.
- A resource-contended frontend diagnostic ended with 102 passed/6 failed; module runners timed out. A later serial diagnostic exposed one real SSR heading regression (160 passed/1 failed). Restored the signed-out heading and Arabic labels; the final normal npm suite passes all 161.
- Initial Phase 4 browser runs passed 11 checks before an expiry assertion incorrectly required a particular redirect/link. Final checks require removal of private certificate content and authoritative 401 instead. The signed-out page has explicit feedback.
- An expiry regression run reached 8 successful Phase 2 checks before its cookie-deletion simulation raced outstanding authenticated responses. The harness now waits for network idle before deleting cookies; Identity cookie renewal/security-stamp behavior is unchanged. A subsequent attempted replay of an already completed fixture correctly could not find its initial incomplete-lesson button. Remaining final checks use fresh fixture graphs, without resetting earlier records.
- Fixture guards refused reusing a previous Phase 1 filename and an invalid new filename. The final run uses a new allowed filename; no fixture was overwritten or reset.
- Final integration review caught the existing notification client allowlist rejecting the new certificate route. Added the narrow local GUID route, a regression test and a real notification-page browser assertion. The final frontend suite is 162/0/0.
- The added stale-issued PDF test initially reached 12 passing checks before its injected first response was consumed by duplicate development-mode requests. The harness now holds the stale-view mode until the download action; the real backend revocation is then fetched. The final 15 checks include refusal to generate a PDF and immediate disabled-button feedback.

These diagnostic failures are not omitted from final readiness, and are not counted as final passing tests.

## Limitations and readiness

- Hosted enablement is not performed or approved.
- Catalog-wide recovery was not enabled over old fixture graphs; the same durable scan is verified with fresh course scopes.
- Browser PDFs are snapshot-derived documents, not digitally signed artifacts. A downloaded copy cannot be recalled after revocation.
- Legacy weak/non-new-format codes are not exposed through anonymous verification; no historical dates/version/name attribution is invented.
- Single canonical personal-name snapshot is shared by both layouts; no bilingual-name schema expansion.
- Rate limiting is process-local; distributed/proxy deployment needs operational review.
- Application immutability protections do not replace database-administrator controls over direct SQL.
- The initial implementation did not change Identity cookie renewal and suppressed renewal headers in delayed-body tests. The hardening pass below replaces that limitation with real-header tests and passive-renewal protection. Broader sequencing of explicit interactive sign-ins remains outside this phase.
- No commits/pushes or Phase 5 work.

## Acceptance checklist

- [x] Exact persisted requirements, including the rounded-100 counterexample and empty-set refusal.
- [x] First completion and certificate issuance happen once; immutable dates/snapshots are protected.
- [x] Lesson/approval evidence, completion, certificate and notifications share the business transaction.
- [x] Course-first locks, deterministic user locks, races, rollback, retries and lost acknowledgement verified.
- [x] Durable repeatable recovery and publication/inherited-evidence behavior verified on fresh scoped graphs.
- [x] Actual membership, ownership, session/origin/account preconditions and minimal public verification verified.
- [x] Authenticated snapshot-only Arabic/English browser PDFs, revocation and stale-account handling verified.
- [x] Phase 1–3 SQL/browser and financial/version invariants preserved in the selected regression scope.
- [x] Default-off gate rejects hosted/unapproved targets; all mutations restricted to verified LocalDB.
- [x] No new migrations/dependencies, shared changes, commits/pushes or Phase 5 implementation.
- [ ] Project-owner review and final acceptance.
- [ ] Hosted enablement/deployment: outside approved scope and remains prohibited.

Phase 4 is ready for owner review for the approved isolated scope. This is not hosted production acceptance.

## Final focused hardening verification - November 22, 2026

This section is the current result set. Earlier counts, runtime instance suffixes and diagnostic descriptions above document the initial implementation, not additional final test executions.

### Verified target and gates

- Actual DB_NAME(): Esham_AccountTests_Phase1_20261114.
- Configured instance: (localdb)\MSSQLLocalDB; actual IsLocalDB = 1.
- Latest recorded actual server: DESKTOP-I0292P0\LOCALDB#B1A8B773.
- Isolated API/frontend: 5216/5175. Existing shared 5206/5174 configuration and User Secrets were untouched.
- Isolated handshake: isolated, purchasesEnabled, progressWritesEnabled, submissionMutationsEnabled, completionMutationsEnabled and mediaIsolated all true, exclusively on verified LocalDB.
- CourseCompletion.RecoveryEnabled=false; both startup seeding flags false. Global recovery was never enabled.
- Runtime, diagnostics, synthetic media, fixture credentials and reports are under Git-ignored artifacts; no passwords, cookies or full connection strings are included here.
- No provisioning, migrations, reset, shared connections, shared record/account writes, hosted mutations, commits/pushes, dependency changes or Phase 5 work.

### Exact final results

| Check | Passed | Failed | Skipped |
| --- | ---: | ---: | ---: |
| Safe backend regression (SQL opt-in off) | 402 | 0 | 100 |
| New hardening SQL cases | 7 | 0 | 0 |
| Existing Phase 4 SQL cases | 15 | 0 | 0 |
| Phase 1 SQL cases | 16 | 0 | 0 |
| Phase 2 SQL cases | 12 | 0 | 0 |
| Phase 3 SQL cases | 18 | 0 | 0 |
| Instructor SQL case | 1 | 0 | 0 |
| Previously omitted relational regressions | 31 | 0 | 0 |
| Main relational aggregate (preceding seven rows) | 100 | 0 | 0 |
| Separate recovery-resume child-process action | 1 | 0 | 0 |
| Frontend automated tests | 164 | 0 | 0 |
| Phase 1 browser regression | 14 | 0 | 0 |
| Phase 2 browser regression | 13 | 0 | 0 |
| Phase 3 browser regression | 15 | 0 | 0 |
| Phase 4 browser | 16 | 0 | 0 |
| Real-header delayed-session browser | 2 | 0 | 0 |
| Browser aggregate | 60 | 0 | 0 |
| Persisted browser invariants, Phases 1-4 | 4 | 0 | 0 |
| Fresh synthetic browser fixture actions | 4 | 0 | 0 |

Four real HTTP session tests are included in the 402 safe tests; they are not additional to that total. Three disabled-worker cases are also included. The child-process action is listed separately from the seven parent SQL cases. Main relational theory rows account for more executed cases than skipped definitions. Builds: backend solution and final isolated runtime both pass with zero warnings/errors; frontend production build passes with existing bundler warnings. No dependency or execution-policy changes were used.

The 31 additional cases comprise AccountFinalizationSqlServerTests (5), UserCategorySqlServerTests (3), NotificationSqlServerTests (4), CourseVersionUpdateSqlTests (5), CourseResubmissionTests.Sql_comparison (1), PlatformModerationSqlTests (4), CategoryAdminProvisioningTests SQL (3), AdminUserSqlServerTests (4), AdminIntegrationTests SQL (1), and PublicEducationalContentTests SQL (1).

### What the 100 safe-run skips mean

| Category | Skipped definitions | Separate execution |
| --- | ---: | --- |
| Relational opt-in definitions | 88 | All executed as 100 parameter-expanded main SQL cases |
| Explicit fixture/publication/invariant/recovery actions | 11 | Ten action definitions exercised separately; catalog provisioning intentionally not run |
| Migration/backfill definition | 1 | Intentionally not run: no migrations/backfills authorized |

The original 94 skips comprised 83 relational definitions, 10 explicit setup actions and one migration/backfill definition. Five new SQL definitions and one child-process action explain the increase to 100. Skips are not counted as passing. The former 31-case relational coverage gap is closed; catalog provisioning and migration/backfill remain intentionally excluded.

### Concurrency, recovery and security evidence

- Controlled GET/completion overlap returns either consistent active/no-certificate state or completed/certificate state, never mixed historical ambiguity. SQL ReadCommitted plus a held course update lock avoids requiring database snapshot settings.
- Baseline mixed workloads reproduced TaskSubmissions PK range-lock conversion deadlocks (SQL 1205) despite transaction retries. Existing system_health ring-buffer XML identified the resource. Reserving absent request-ID ranges with UPDLOCK/HOLDLOCK and sorting both participant locks corrected the confirmed issue.
- Three final mixed waves each include shared identities, independent courses, purchases/replays, progress, submissions, instructor approvals, completion GETs and reconciliation. Parameterized SQL diagnostics contain zero errors; time-filtered system_health XML contains zero new deadlock events for each wave. Existing diagnostics were read only; no server event session was configured. This is bounded workload evidence, not a universal deadlock-free guarantee.
- Recovery: 62 enrollments cross pagination, one poison row rolls back while the other 61 continue, and retry completes all 62 without duplicate notices/certificates. Interruption over 57 enrollments preserves committed dates/IDs and a separate dotnet process resumes remaining work. Two concurrent scoped workers process 53 enrollments without duplicates. Catalog-wide scheduling/load remains disabled and unverified.
- Two HTTP regressions reproduced old-account restoration before the cookie fix. Four final HTTP tests verify delayed response delivery across logout/switching, fresh claims, security-stamp/lockout rejection, and no sliding renewal beyond half-ticket lifetime. Original HTTP headers are retained. Two Edge checks repeat delayed logout/switching with browser cookie handling.
- Unknown certificate statuses are explicit; UTC screen/PDF dates agree even under a western browser timezone. Public verification has a robots noindex,nofollow meta policy. Browser PDFs still use immutable authenticated DTOs, with revocation/account-generation checks.
- All four persisted browser-invariant actions pass after the fresh browser runs: purchase/failed-transfer invariants, lesson/version evidence, immutable submissions/reviews, completion/certificate/notice/revocation and financial receipt preservation remain intact.

### Reproducible commands and artifact index

Run from repository root. Supply integrated-auth LocalDB configuration only in the test process after the exact approved identity guard. No hosted User Secrets are loaded as test targets.

```powershell
dotnet build backend/esham.sln --no-restore -p:OutputPath=C:\Users\HP\Documents\esham\artifacts\phase4-hardening-solution\ --verbosity quiet
dotnet build backend/esham.PL/esham.PL.csproj --no-restore -p:OutputPath=C:\Users\HP\Documents\esham\artifacts\phase4-hardening-runtime-final\ --verbosity quiet
$env:ESHAM_RUN_ISOLATED_SQL_TESTS='0'
dotnet test backend/esham.Tests/esham.Tests.csproj --no-restore -p:OutputPath=C:\Users\HP\Documents\esham\artifacts\phase4-hardening-bin\ --logger 'trx;LogFileName=safe-final.trx' --results-directory artifacts/phase4-hardening

# Process-local exact LocalDB configuration and actual identity verification required:
$env:ESHAM_RUN_ISOLATED_SQL_TESTS='1'
$env:ESHAM_APPROVED_ISOLATED_DATABASE='Esham_AccountTests_Phase1_20261114'
dotnet test backend/esham.Tests/esham.Tests.csproj --no-build -p:OutputPath=C:\Users\HP\Documents\esham\artifacts\phase4-hardening-bin\ --filter 'FullyQualifiedName~Phase4HardeningSqlTests' --logger 'trx;LogFileName=hardening-sql-final.trx' --results-directory artifacts/phase4-hardening
# Execute the named existing SQL suites separately with the same guarded settings.
# Never use an unfiltered SQL opt-in run. Never opt into provisioning/backfill.

# From frontend/:
npm.cmd test
npm.cmd run build

# Isolated runtime and phase-specific fresh fixture pointers required:
node frontend/scripts/verify-enrollment-wallet.cjs
node frontend/scripts/verify-learning-progress.cjs
node frontend/scripts/verify-learner-submissions.cjs
node frontend/scripts/verify-completion-certificates.cjs
node frontend/scripts/verify-session-renewal.cjs

# Each phase separately, with its existing SETUP=invariants and private artifact root:
dotnet test backend/esham.Tests/esham.Tests.csproj --no-build -p:OutputPath=C:\Users\HP\Documents\esham\artifacts\phase4-hardening-bin\ --filter 'FullyQualifiedName~Phase4IsolatedEnvironmentTests.Verify' --logger 'trx;LogFileName=invariant4-final.trx' --results-directory artifacts/phase4-hardening
git diff --check
```

Final backend evidence: artifacts/phase4-hardening/safe-final.trx, hardening-sql-final.trx, regression-*.trx, additional-1-final.trx, additional-2 through additional-5.trx, additional-6-final.trx, additional-7 through additional-10.trx, invariant1-final through invariant4-final.trx, and the separate restart-child-*.trx. Only the child associated with the final parent run is counted; diagnostic reruns are not additional tests. Mixed diagnostics: mixed-1/2/3-diagnostics.json and mixed-1/2/3-deadlocks.xml. Baseline deadlock graphs are retained separately.

Browser evidence: artifacts/phase4-hardening/phase1-regression/browser-results.json (14), phase2-regression/browser-results.json (13), phase3-regression/browser-results.json (15), browser/browser-results.json (16), browser/session-browser-results.json (2), and browser/database-identity.json. Private fixture pointer files identify each fresh graph. All remain Git-ignored.

Final runtime smoke check after rebuilding/restarting only the isolated process: Swagger HTTP 200 and all six isolated handshake flags true. Both startup seeding flags and catalog-wide recovery remain false in the separate process configuration. The shared runtime was not restarted. Final frontend rerun after the public unknown-status fallback: 164 passed, zero failed/skipped; production build passed.

Git safety: branch feature/learner-phases-1-3, unchanged HEAD e9e69a5. The working tree contains 49 source/documentation files (25 modified, 24 new) and remains intentionally uncommitted. Diff whitespace check passes; Git only reports existing LF/CRLF conversion notices. Changed/untracked filename review includes no databases, private media, runtime logs, credentials/configuration files or build artifacts. A targeted credential-pattern scan found no full password-bearing SQL strings, private keys or GitHub token patterns in those files; this is a scoped scan, not a universal secret-detection guarantee. Identity fixtures, process configuration and TRX/PDF/browser artifacts are confirmed ignored. No staging, fetch, commit, push or history changes were performed.

### Findings corrected during hardening

- Confirmed inconsistent completion read: fresh course-locked projection replaces unrelated reads.
- Confirmed submission insert deadlock: deterministic participant locks and absent-key reservation; final three waves have no captured deadlocks/errors.
- Confirmed delayed passive cookie restoration: fixed-lifetime sessions and suppression of automatic renewal, retaining stamp/lockout checks. No artificial Set-Cookie stripping remains in held-response scripts.
- Three recovery fixture diagnostics violated the existing version-access Reason constraint; fixtures now use the existing enrolled value. No constraint changed.
- Initial additional SQL sweep: 27 passed, four failed. One account-finalization concurrency timeout did not recur in the isolated named suite (5/5); three moderation assertions omitted the publication notice already produced by setup. Corrected scoped assertions; final 31/31 pass without business-logic changes.
- An intermediate safe run failed the strict InMemory Serializable-transaction convention after the SQL read change. Retained that convention for non-SQL providers; final 402/402 pass.
- A Phase 1 browser harness account-switch run reached six checks before remaining on the correct signed-out login route after direct API logout/login. The harness now performs the client-side post-login navigation while retaining the mounted account store and original delayed headers; the final 14 checks pass. Production authentication/routing was not weakened.

### Remaining boundaries and final readiness

- Catalog-wide timer recovery/load is not verified or enabled; scoped durable scans, real process restart, poison continuation and concurrent workers are verified.
- Passive-response cookie restoration is fixed. Overlapping explicit login/profile responses are not globally sequenced by a server session store. Delayed rejection/deletion may fail closed by logging out a newer session. No all-device logout policy or schema was added.
- Coarse course locks can affect throughput; no production-scale performance claim is made.
- Public rate limiting remains per process; distributed/proxy configuration and frontend HTTP indexing headers require deployment review.
- PDFs are unsigned snapshot documents; downloaded copies cannot be recalled. Ambiguous historical completions are never auto-repaired.
- Hosted mutations remain prohibited. This is isolated-development acceptance evidence, not authorization to deploy/enable on db75401.

Hardening acceptance: all seven requested items are implemented/tested within the stated scope; safe/backend/frontend builds and named regressions pass. Owner review, commit/push authorization and hosted decisions remain separate. No Phase 5 work has begun.
