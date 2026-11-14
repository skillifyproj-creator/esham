# Phase 3 verification — November 14, 2026

Phase 3 is implemented and ready for project-owner review for the approved isolated development scope. Phase 4 has not started. Hosted deployment and hosted learner mutation enablement are separate decisions.

Contracts, safe examples, lifecycle, storage/retry design and exact source manifest: [PHASE3-TASKS-SUBMISSIONS.md](PHASE3-TASKS-SUBMISSIONS.md).

## Authorization and environment

The project owner confirmed Fatima's authorization for all necessary assessment integration changes. No separate Fatima approval remains pending. The existing assessment service/endpoint remains authoritative; decision/status/ownership/historical eligibility rules and hosted review availability were not replaced or gated.

| Item | Verified result |
| --- | --- |
| Actual database | Esham_AccountTests_Phase1_20261114 |
| Configured instance | (localdb)\MSSQLLocalDB |
| Actual IsLocalDB | 1 |
| Recorded actual server | DESKTOP-I0292P0\LOCALDB#DC327498 |
| Isolated API/frontend | 5216 / 5175 |
| Isolated handshake | isolated, purchasesEnabled, progressWritesEnabled, submissionMutationsEnabled and mediaIsolated all true |
| Isolated media | Existing artifacts/phase2-isolated/media; new Phase 3 files have unique opaque keys |
| New reports/credentials | Git-ignored artifacts/phase3-isolated |
| Shared API/frontend | Existing 5206 / 5174 processes preserved |
| Shared handshake | isolated=false, purchasesEnabled=false |
| Shared progress/new submission writes | Existing process was not deployed/restarted; new source gates default false and refuse hosted SQL targets |
| Application seeding | Both actual SeedData flags explicitly false for isolated runtime; shared settings unchanged |
| Migrations/schema/dependencies | None created, applied, redesigned or added |

Every Phase 3 SQL setup verifies actual DB_NAME(), IsLocalDB and local-machine instance identity before synthetic mutations. Instructor SQL setup gained the same actual-target guard. Test connections are process-local integrated-auth LocalDB values; no test provider reads hosted User Secrets. No db75401 mutations, account logins, seeders, schema commands or repairs were performed.

Original Phase 1/2 records and verification evidence remain intact. Regression fixtures and reports are fresh and stored under Phase 3. Phase 2 fixture/report helpers gained an explicit regression artifact directory while retaining the original approved private media root. The reused video is an already generated synthetic clip, not a shared/private account file. No production-like accounts or private files were copied.

## Final results

| Check | Passed | Failed | Skipped |
| --- | ---: | ---: | ---: |
| Safe baseline backend, before Phase 3 | 369 | 0 | 60 |
| Safe baseline frontend | 148 | 0 | 0 |
| Final complete backend regression, SQL opt-out | 378 | 0 | 79 |
| Phase 3 relational cases | 18 | 0 | 0 |
| Phase 1 financial SQL regression | 16 | 0 | 0 |
| Phase 2 learning/progress SQL regression | 12 | 0 | 0 |
| Existing instructor assessment SQL regression | 1 | 0 | 0 |
| Combined selected relational run | 47 | 0 | 0 |
| Final frontend automated suite | 155 | 0 | 0 |
| Phase 3 browser workflow | 15 | 0 | 0 |
| Phase 1 browser regression | 14 | 0 | 0 |
| Phase 2 browser regression | 13 | 0 | 0 |
| Phase 3 persisted browser invariants | 1 | 0 | 0 |
| Phase 1 persisted regression invariants | 1 | 0 | 0 |
| Phase 2 persisted regression invariants | 1 | 0 | 0 |
| Final fresh fixture setup, each phase | 1 each | 0 | 0 |
| Standalone guarded reconciliation CLI | 1 | 0 | 0 |

The final backend solution/test builds passed with zero warnings/errors. Frontend production build passed with existing dependency module-directive warnings. Script syntax and git diff --check passed. Separate output directories avoid touching assemblies loaded by the shared runtime.

The 79 non-SQL skips are the previous 60 skips, 17 new SQL definitions (expanded to 18 relational cases), and two explicit Phase 3 fixture actions. Relevant SQL cases ran separately; unrelated SQL suites were never enabled through an unfiltered opt-in run.

## Exact verification commands

Commands ran from C:\Users\HP\Documents\esham. ESHAM_ACCOUNT_TEST_SQLSERVER was already process-configured with the approved integrated-auth LocalDB connection; its value is deliberately not reproduced. ESHAM_APPROVED_ISOLATED_DATABASE was exactly Esham_AccountTests_Phase1_20261114.

```powershell
dotnet build backend/esham.Tests/esham.Tests.csproj --no-restore -p:OutputPath=C:\Users\HP\Documents\esham\artifacts\phase3-regression-bin\ --verbosity quiet
dotnet build backend/esham.sln --no-restore -p:OutputPath=C:\Users\HP\Documents\esham\artifacts\phase3-final-build\ --verbosity quiet

$env:ESHAM_RUN_ISOLATED_SQL_TESTS='0'
$env:ESHAM_PHASE1_SETUP=''
$env:ESHAM_PHASE2_SETUP=''
$env:ESHAM_PHASE3_SETUP=''
dotnet test backend/esham.Tests/esham.Tests.csproj --no-build -p:OutputPath=C:\Users\HP\Documents\esham\artifacts\phase3-regression-bin\ --logger 'trx;LogFileName=phase3-nonsql-final.trx' --results-directory artifacts/phase3-isolated/test-results --verbosity quiet

# Only with the approved process-local connection and actual identity guards:
$env:ESHAM_RUN_ISOLATED_SQL_TESTS='1'
$env:ESHAM_APPROVED_ISOLATED_DATABASE='Esham_AccountTests_Phase1_20261114'
$env:ESHAM_PHASE3_MEDIA_ROOT=Join-Path (Get-Location) 'artifacts/phase2-isolated/media'
dotnet test backend/esham.Tests/esham.Tests.csproj --no-build -p:OutputPath=C:\Users\HP\Documents\esham\artifacts\phase3-regression-bin\ --filter 'FullyQualifiedName~SubmissionSqlServerTests|FullyQualifiedName~EnrollmentSqlServerTests|FullyQualifiedName~LessonProgressSqlServerTests|FullyQualifiedName~InstructorInsightsTests.Sql_server_queries' --logger 'trx;LogFileName=phase3-all-sql-final.trx' --results-directory artifacts/phase3-isolated/test-results --verbosity quiet

$env:ESHAM_PHASE3_ARTIFACTS=Join-Path (Get-Location) 'artifacts/phase3-isolated'
$env:ESHAM_PHASE3_SETUP='fixtures'
dotnet test backend/esham.Tests/esham.Tests.csproj --no-build -p:OutputPath=C:\Users\HP\Documents\esham\artifacts\phase3-verification-bin\ --filter 'FullyQualifiedName~Fresh_synthetic_submission_browser_fixture' --verbosity quiet
$env:ESHAM_PHASE3_SETUP=''
node frontend/scripts/verify-learner-submissions.cjs
$env:ESHAM_PHASE3_SETUP='invariants'
dotnet test backend/esham.Tests/esham.Tests.csproj --no-build -p:OutputPath=C:\Users\HP\Documents\esham\artifacts\phase3-regression-bin\ --filter 'FullyQualifiedName~Verify_submission_browser_invariants' --verbosity quiet
$env:ESHAM_PHASE3_SETUP=''

# Fresh Phase 1 regression records, separate evidence:
$env:ESHAM_PHASE1_ARTIFACTS=Join-Path (Get-Location) 'artifacts/phase3-isolated/phase1-regression'
$env:ESHAM_PHASE1_FIXTURE_NAME='browser-fixtures-phase3.json'
$env:ESHAM_PHASE1_FIXTURE_FILE=Join-Path $env:ESHAM_PHASE1_ARTIFACTS $env:ESHAM_PHASE1_FIXTURE_NAME
$env:ESHAM_PHASE1_SETUP='fixtures'
dotnet test backend/esham.Tests/esham.Tests.csproj --no-build -p:OutputPath=C:\Users\HP\Documents\esham\artifacts\phase3-regression-bin\ --filter 'FullyQualifiedName~Create_synthetic_browser_fixtures' --verbosity quiet
$env:ESHAM_PHASE1_SETUP=''
node frontend/scripts/verify-enrollment-wallet.cjs
$env:ESHAM_PHASE1_SETUP='invariants'
dotnet test backend/esham.Tests/esham.Tests.csproj --no-build -p:OutputPath=C:\Users\HP\Documents\esham\artifacts\phase3-regression-bin\ --filter 'FullyQualifiedName~Verify_persisted_browser_purchase_and_failed_attempt_invariants' --verbosity quiet
$env:ESHAM_PHASE1_SETUP=''

# Fresh Phase 2 regression records; original Phase 2 reports are not overwritten:
$env:ESHAM_PHASE2_ARTIFACTS=Join-Path (Get-Location) 'artifacts/phase3-isolated/phase2-regression'
$env:ESHAM_PHASE2_MEDIA_ROOT=Join-Path (Get-Location) 'artifacts/phase2-isolated/media'
# This fresh directory receives a copy of the generated synthetic WebM fixture.
$env:ESHAM_PHASE2_SETUP='fixtures'
dotnet test backend/esham.Tests/esham.Tests.csproj --no-build -p:OutputPath=C:\Users\HP\Documents\esham\artifacts\phase3-regression-bin\ --filter 'FullyQualifiedName~Prepare_fresh_synthetic_learning_browser_fixtures' --verbosity quiet
$env:ESHAM_PHASE2_SETUP=''
node frontend/scripts/verify-learning-progress.cjs
$env:ESHAM_PHASE2_SETUP='invariants'
dotnet test backend/esham.Tests/esham.Tests.csproj --no-build -p:OutputPath=C:\Users\HP\Documents\esham\artifacts\phase3-regression-bin\ --filter 'FullyQualifiedName~Verify_browser_progress_financial_and_achievement_invariants' --verbosity quiet
$env:ESHAM_PHASE2_SETUP=''
$env:ESHAM_RUN_ISOLATED_SQL_TESTS='0'

npm.cmd --prefix frontend test
npm.cmd --prefix frontend run build
node --check frontend/scripts/verify-learner-submissions.cjs
git diff --check

# Same approved isolated runtime environment; no hosted configuration:
$contentRoot = Join-Path (Get-Location) 'backend/esham.PL'
dotnet artifacts/phase3-regression-bin/esham.PL.dll --contentRoot $contentRoot --reconcile-submission-uploads true
```

Browser commands used ESHAM_TEST_API=http://localhost:5216, ESHAM_TEST_FRONTEND=http://localhost:5175 and PLAYWRIGHT_MODULE pointing to the existing temporary Playwright installation. Edge ran in fresh isolated contexts. Credentials are only in ignored synthetic fixture files and must not be printed or committed. Localhost cookies are not port-partitioned, so ordinary/shared browser profiles were not used.

The isolated API was launched through Start-Process with hidden window, explicit content root backend/esham.PL, process-only LocalDB/port overrides, approved gate options, existing isolated Media:StorageRoot, CORS origin 5175 and both real SeedData flags false. Shared .env.local, User Secrets, ports and processes were not overwritten.

After the final nested-task approval correction, the build and identical complete non-SQL/47-case SQL commands above were rerun with `-p:OutputPath=C:\Users\HP\Documents\esham\artifacts\phase3-final-tests\`. The final isolated API runs that build. Fresh Phase 3 fixture/browser/invariant commands also use that output directory. This is the final result set, not a claim that earlier diagnostic binaries included the correction.

## Coverage

The 18 Phase 3 relational scenarios cover:

1. Concurrent same-ID draft creation and cross-task conflict.
2. Independent draft requests, one open attempt and stale competing edits.
3. Concurrent finalization, frozen payload and one notification.
4. Finalization versus answer editing.
5. Upload replay, mismatched bytes, removal and non-resurrection tombstone.
6. Concurrent uploads and five-file limit.
7. Assessment versus new attempt, terminal review and assessment notifications.
8. Superseded drafts refusing mutation and hiding inaccessible historical task-resource links.
9. Historical pending assessment and logical approval inheritance without financial effects.
10. SQL failure after attachment persistence, complete rollback and compensating file cleanup.
11. Lost finalization commit acknowledgement, reconciled state and single event.
12. Lost upload commit acknowledgement, committed bytes retained and one link.
13. Interrupted-upload recovery against actual SQL, active lease protection and unreferenced cleanup.
14. Concurrent identical uploads and cross-submission upload-ID conflict.
15. Finalization versus attachment upload.
16. Cross-course draft request-ID reuse.
17–18. Publication racing with draft creation and finalization.

Non-SQL service/API/filesystem tests additionally cover actual roles including Both, empty/unsafe work, fingerprint ABA, read privacy, origin/account preconditions, forged DTO fields, multipart requests, private GET/HEAD downloads, unsupported/mismatched/oversized bytes, DOCX traversal/macros/external links/entity/compression/count abuse, stream failure, referenced-file retention and journal recovery.

Fifteen Phase 3 browser checks use actual API/SQL/storage responses:

- Membership/ownership and published task instructions.
- Draft creation and synchronous double-click protection.
- Saved answer/URL after reload.
- Real TXT upload, exact replay, private download, removal and detached replay denial.
- Valid PDF/PNG/JPEG/WebP/DOCX uploads and five-file cap.
- Frozen finalization, replay and one instructor notification.
- Instructor UI rejection with immutable feedback and attempt 2.
- Instructor UI approval, authoritative progress and learner notification targets.
- Optional attempt 3 rejected without revoking previous approval.
- Account switching with a delayed real attempt response, private-state clearing and foreign 404.
- Expired session clearing protected forms.
- Arabic/English, RTL/LTR, 390/1440px history layouts without horizontal overflow.

No browser response fabricated an approval, answer, file or balance. Delayed-response tests remove an already-processed Set-Cookie header before fulfilling that captured real response, avoiding duplicate cookie application by the harness.

## Persisted invariant evidence

The final browser fixture has attempts 1/2/3 with statuses rejected/approved/rejected, immutable review feedback and optional-at-creation true on attempt 3. It has exactly three task.submitted and three task.assessed notifications.

Before/after snapshots matched for wallet balances/timestamps, ledger records, original enrollment identity/version/status/completion date, access receipts and certificates. No lesson progress was created by the task workflow. Task/submission evidence changed intentionally; prior approval remained authoritative after optional rejection. Phase 1 and Phase 2 persisted invariant reruns separately passed.

## Defects found and fixed

- SQL exposed EF treating an assigned-key new attachment added through navigation as an update. New MediaAsset and SubmissionAttachment are now explicitly Added; SQL rollback/replay/concurrency tests pass.
- A test compared differently escaped JSON strings. Both financial snapshots now receive the same canonical transformation; underlying data was unchanged.
- Reloaded textarea values altered inferred exact label text. Explicit bilingual accessible labels stabilize the form and browser checks.
- The existing version test expected the submission capability to remain unavailable. Its expectation now matches the implemented API; achievement assertions remain unchanged.
- New-attempt intent is cleared only after a confirmed creation, allowing later distinct attempts while retaining uncertain request identity.
- A synchronous mutation guard prevents multiple browser click handlers from issuing duplicate requests before React renders busy state.
- Current-version checks also apply to mixed frontend responses; superseded task resources are not advertised as historical playback capability.
- Phase 2 regression tooling can write separate reports rather than destroying accepted evidence.
- Nested task summaries in submission detail now resolve logical approval from persisted evidence too, preserving consistency for rejected optional attempts and historical submissions.
- The standalone CLI initially used a relative content root, which the separate-output host resolved against its build directory. The documented command now uses an absolute content root; the guarded CLI passed with zero eligible pending journals.

## Operational limitations and remaining decisions

- Draft fingerprints have the explicitly approved editable-content ABA limitation. Terminal attempts/reviews remain immutable. No CreatedAt repurposing or hidden revision table was introduced.
- Structural file validation is conservative and is not antivirus or a full PDF/image/Office rendering engine. Complex/encrypted/unsupported variants may be rejected. DOC and DOCX external relationships/macros/embedded programs are excluded. Broader parser/scanner support would need a separately reviewed dependency/deployment decision.
- Detached media metadata/files are deliberately retained as replay tombstones. They are not eligible for crash-orphan deletion. Longer-term quota/retention operations need a coordinated policy; the implementation never sweeps unrelated media.
- The reconciliation service was verified through unit and actual SQL/filesystem tests, including interrupted uploads, active leases, committed-reference retention and rollback/commit ambiguity. The standalone CLI also passed with zero eligible journals. An earlier automatic approval usage-limit failure temporarily prevented that invocation; after the user continued, approval review completed normally. No approval bypass was used.
- Shared catalog and Swagger returned HTTP 200; credentialed CORS allowed localhost:5174. The shared handshake still refused purchases. No shared account mutation/private-media deployment test was attempted. New shared deployment and hosted learner mutation enablement remain outside this scope.

## Acceptance checklist

- [x] Existing entities/schema and actual memberships/ownership/version entitlement reused.
- [x] Real task instructions, requirements and protected current resources implemented.
- [x] Draft creation/editing/finalization, attempt numbering and history persist.
- [x] Pending editing/withdrawal/new statuses not introduced.
- [x] Rejection/new attempts, terminal approval and optional credit preservation verified.
- [x] Old drafts are read-only; historical pending work remains assessable without retargeting.
- [x] Secure bounded attachment lifecycle, private downloads and replay tombstones implemented.
- [x] SQL/filesystem compensation and conservative journal reconciliation verified, including actual SQL.
- [x] Course-first locking, stale conflicts, duplicate requests and publication/assessment races verified.
- [x] Coordinated existing assessment context and atomic notifications integrated.
- [x] Connected UI uses server authority and passes account/session/bilingual/responsive checks.
- [x] Phase 1/2 SQL/browser regressions and all three persisted invariant checks pass.
- [x] Shared records/secrets/evidence and 20/20/20 policy preserved; no migrations/dependencies added.
- [x] Standalone isolated reconciliation CLI smoke passed.
- [ ] Hosted deployment/private-media verification and hosted mutation enablement: separate approval.
- [ ] Project-owner Phase 3 review/acceptance: pending.

No Fatima coordination blocker remains. The implementation is ready for review for the isolated scope; this report does not claim production deployment or project-owner acceptance. Do not start Phase 4 without review and approval.
