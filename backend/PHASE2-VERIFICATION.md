# Phase 2 verification — November 14, 2026

Phase 2 implementation and verification are ready for review for the approved development/isolated scope. Phase 3 has not started. Hosted write enablement is not included.

Implementation, exact source manifest, contracts and examples: [PHASE2-PROTECTED-LEARNING.md](PHASE2-PROTECTED-LEARNING.md).

## Environment and database safety

| Check | Verified result |
| --- | --- |
| Approved database | Esham_AccountTests_Phase1_20261114 |
| Configured instance | (localdb)\MSSQLLocalDB |
| Actual DB_NAME() | Esham_AccountTests_Phase1_20261114 |
| Actual IsLocalDB | 1 |
| Actual server at final fixture creation | DESKTOP-I0292P0\LOCALDB#4BC79CBB |
| Isolated API/frontend | 5216 / 5175 |
| Isolated handshake | isolated=true, purchasesEnabled=true, progressWritesEnabled=true, mediaIsolated=true |
| Isolated media | Dedicated artifacts/phase2-isolated/media, separate from backend/storage/media |
| Shared API/frontend | 5206 / 5174; existing processes preserved |
| Shared handshake | isolated=false, purchasesEnabled=false |
| Shared progress | Existing shared process was not deployed/restarted; source defaults disabled and the new gate rejects hosted targets even if enabled |
| SeedData:Enabled / SeedData:DemoCourses | Explicitly false in final isolated process; shared disabled settings unchanged |
| Shared User Secrets | Not overwritten |
| Schema | Existing schema reused; no migrations created or applied |

LocalDB registry and Windows Data Protection access require running the verification commands outside the restricted filesystem sandbox. The SQL provider verifies the exact approved catalog, actual DB_NAME, IsLocalDB and local-machine SQL identity BEFORE creating synthetic accounts or curriculum. Fixture media checks require the dedicated Phase 2 directory before writing bytes. No hosted configuration is used by the SQL test provider.

The existing isolated database was not reset. Fresh synthetic accounts/courses were created for each attempt; no shared identities/credentials were copied. Failed diagnostic fixtures remain isolated rather than being deleted. Original Phase 1 evidence under artifacts/phase1-isolated remains intact. Phase 1 rerun artifacts use artifacts/phase2-isolated/phase1-regression-accepted.

Private fixture credentials, binaries, logs and screenshots are Git-ignored operational artifacts. No connection strings or credentials were added to source. Shared db75401 was not migrated, seeded, repaired or mutated by this work.

## Final test results

Counts below describe final successful runs, not an assertion that diagnostic attempts never failed.

| Check | Passed | Failed | Skipped |
| --- | ---: | ---: | ---: |
| Complete backend regression, SQL opt-out | 369 | 0 | 60 |
| Phase 2 focused SQL scenarios | 12 | 0 | 0 |
| Phase 1 enrollment SQL regression | 16 | 0 | 0 |
| Frontend automated tests | 148 | 0 | 0 |
| Phase 2 isolated browser suite | 13 | 0 | 0 |
| Phase 1 isolated browser regression | 14 | 0 | 0 |
| Final Phase 2 synthetic fixture setup | 1 | 0 | 0 |
| Final Phase 1 regression fixture setup | 1 | 0 | 0 |
| Phase 2 persisted invariant verification | 1 | 0 | 0 |
| Phase 1 persisted invariant verification | 1 | 0 | 0 |

Backend solution and test builds passed with zero warnings/errors using separate output directories. Frontend production build passed with existing dependency module-directive warnings. Verification-script syntax and git diff --check passed.

The 60 backend opt-out skips are the previous 47 skips, 11 Phase 2 relational definitions (expanded to 12 executed cases), and two explicit Phase 2 fixture actions. Unrelated SQL suites were never enabled through an unfiltered opt-in run. Relevant existing non-SQL version/publication/media/security tests ran in the complete regression.

## Commands

Commands ran from the repository root. The isolated LocalDB connection was supplied only through the existing process-local ESHAM_ACCOUNT_TEST_SQLSERVER variable using Windows integrated authentication; its value is intentionally omitted. ESHAM_APPROVED_ISOLATED_DATABASE was exactly the catalog above.

Separate build outputs avoid overwriting assemblies used by the shared runtime:

```powershell
dotnet build backend/esham.Tests/esham.Tests.csproj --no-restore -p:OutputPath=C:\Users\HP\Documents\esham\artifacts\phase2-test-bin\ --verbosity quiet
dotnet build backend/esham.sln --no-restore -p:OutputPath=C:\Users\HP\Documents\esham\artifacts\phase2-final-build\ --verbosity quiet

$env:ESHAM_RUN_ISOLATED_SQL_TESTS='0'
dotnet test backend/esham.Tests/esham.Tests.csproj --no-build -p:OutputPath=C:\Users\HP\Documents\esham\artifacts\phase2-test-bin\ --logger 'trx;LogFileName=phase2-nonsql-final.trx' --results-directory artifacts/phase2-isolated/test-results --verbosity quiet

# Only after approved process configuration and actual LocalDB verification:
$env:ESHAM_RUN_ISOLATED_SQL_TESTS='1'
$env:ESHAM_APPROVED_ISOLATED_DATABASE='Esham_AccountTests_Phase1_20261114'
dotnet test backend/esham.Tests/esham.Tests.csproj --no-build -p:OutputPath=C:\Users\HP\Documents\esham\artifacts\phase2-test-bin\ --filter 'FullyQualifiedName~LessonProgressSqlServerTests|FullyQualifiedName~esham.Tests.EnrollmentSqlServerTests' --logger 'trx;LogFileName=phase2-and-phase1-sql-final.trx' --results-directory artifacts/phase2-isolated/test-results --verbosity quiet

# Generates a local synthetic two-second video, without any database call:
node frontend/scripts/create-phase2-video.cjs

# Explicit fixtures, never an automatic startup seeder:
$env:ESHAM_PHASE2_SETUP='fixtures'
dotnet test backend/esham.Tests/esham.Tests.csproj --no-build -p:OutputPath=C:\Users\HP\Documents\esham\artifacts\phase2-test-bin\ --filter 'FullyQualifiedName~Prepare_fresh_synthetic_learning_browser_fixtures' --verbosity quiet
$env:ESHAM_PHASE2_SETUP=''
node frontend/scripts/verify-learning-progress.cjs

$env:ESHAM_PHASE2_SETUP='invariants'
dotnet test backend/esham.Tests/esham.Tests.csproj --no-build -p:OutputPath=C:\Users\HP\Documents\esham\artifacts\phase2-test-bin\ --filter 'FullyQualifiedName~Verify_browser_progress_financial_and_achievement_invariants' --verbosity quiet
$env:ESHAM_PHASE2_SETUP=''

# Phase 1 setup/browser/invariant reruns used a separate artifact directory:
$env:ESHAM_PHASE1_SETUP='fixtures'
dotnet test backend/esham.Tests/esham.Tests.csproj --no-build -p:OutputPath=C:\Users\HP\Documents\esham\artifacts\phase2-test-bin\ --filter 'FullyQualifiedName~Create_synthetic_browser_fixtures' --verbosity quiet
$env:ESHAM_PHASE1_SETUP=''
node frontend/scripts/verify-enrollment-wallet.cjs
$env:ESHAM_PHASE1_SETUP='invariants'
dotnet test backend/esham.Tests/esham.Tests.csproj --no-build -p:OutputPath=C:\Users\HP\Documents\esham\artifacts\phase2-test-bin\ --filter 'FullyQualifiedName~Verify_persisted_browser_purchase_and_failed_attempt_invariants' --verbosity quiet
$env:ESHAM_PHASE1_SETUP=''
$env:ESHAM_RUN_ISOLATED_SQL_TESTS='0'

npm.cmd --prefix frontend test
npm.cmd --prefix frontend run build
node --check frontend/scripts/verify-learning-progress.cjs
node --check frontend/scripts/create-phase2-video.cjs
git diff --check
```

Fixture commands also require ESHAM_PHASE2_ARTIFACTS pointing to artifacts/phase2-isolated and ESHAM_PHASE2_MEDIA_ROOT pointing to its media subdirectory. Browser commands used ESHAM_TEST_API=http://localhost:5216, ESHAM_TEST_FRONTEND=http://localhost:5175 and PLAYWRIGHT_MODULE pointing to the existing temporary Playwright installation. Phase 1 rerun additionally used ESHAM_PHASE1_ARTIFACTS pointing to artifacts/phase2-isolated/phase1-regression-accepted, ESHAM_PHASE1_FIXTURE_NAME=browser-fixtures-phase2.json and ESHAM_PHASE1_FIXTURE_FILE pointing to that private file. These private fixtures must not be printed or committed.

The isolated API runs the final build with content root backend/esham.PL, process-only connection/port overrides, LearningProgress enabled only for the approved catalog, separate Media:StorageRoot, both actual SeedData flags false and CORS origin 5175. Shared User Secrets and .env.local were not edited. Browser contexts are separate because localhost cookies are not partitioned by port.

## Relational coverage and invariants

Twelve Phase 2 cases passed:

1. Six concurrent first completion requests produce one row and preserve the same first timestamp.
2. Concurrent first position writes produce one success and one canonical conflict; exact stale replay cannot overwrite; backward seek works.
3. Completion versus position/open never clears completion or its first date.
4. Repeated equal positions and forced one-tick timestamp advances survive SQL precision round trips with distinct tokens.
5. Failure after intermediate SaveChanges rolls back progress and LastOpenedAt.
6. Transient save failure retries with fresh tracking.
7. Lost commit acknowledgement reconciles completion; position replay returns persisted canonical conflict.
8. Concurrent publication/progress preserves the original concrete evidence or rejects stale writes without retargeting.
9. Same-video version update safely inherits position and logical credit without rewriting old evidence.
10. Changed/missing-video update retains credit/history without applying old playback position.
11. Invalid duration refuses position writes; changing actual connected DB to master makes the gate refuse access, then the approved target is restored.
12. All lessons complete with an unapproved required task does not complete the course; financial/attribution invariants remain unchanged.

The final browser fixture persisted two completed lesson rows. Before/after snapshots matched for wallet balances/timestamps, ledger entries, original enrollment attribution/status/completion date, version receipts, certificates and task attempts. No certificate or approved task was fabricated. The separate Phase 1 invariant check confirmed one purchase, two balanced transfer entries, unchanged 20/20/20 policy and no charge for rejected/replayed attempts.

## Browser and HTTP coverage

The 13 real browser checks cover anonymous and Instructor-only denial, Both-role entitlement, draft denial, safe article text, completion/reload/separate login session, real video playback, range/HEAD/downloads, position/backward seek/conflict, task-dependent completion distinction, all learner entry points, persisted resume, delayed previous-account response, expiry, and Arabic/English at 390/1440px with correct direction and no horizontal overflow.

Focused HTTP tests separately verify trusted origin, account precondition, private cache headers, DTO privacy, unrelated attachments, range bytes, HEAD body/length and completion. Service tests cover unavailable course/category/enrollment, missing receipts, missing media, disabled writes, invalid positions and ownership. Existing version tests cover completed-course/certificate preservation and historical logical achievements.

Browser fixtures use generated example.test accounts and a locally generated canvas WebM. No mock server response substitutes for database results; account-switch tests delay a real response and remove its already-processed Set-Cookie header to prevent applying a cookie twice through Playwright fulfillment.

## Defects and verification adjustments

- Initial restricted backend baseline: 318 passed, 39 failed, 47 skipped. Failures were Windows Data Protection filesystem access, not SQL or feature regressions. Runs with the required access pass.
- Running API assemblies prevented a normal output-directory build. Separate output directories preserve the shared process and allow clean builds.
- Initial relational fixtures reused a media key; the SQL unique constraint correctly rejected it. All fixtures now generate unique keys.
- A fixture attempted to update immutable MediaAsset content identity. It now creates a new immutable asset and links only its fresh synthetic lesson/attachment.
- The frontend rendering regression required a heading on the anonymous player state; it is restored.
- Phase 1 browser regression exposed passive learning-summary 401 handling redirecting during logout/login. Only the session provider now owns passive session refresh; summaries hide their own failed data. The full 14-case rerun passes, including delayed-wallet account switching.
- The browser expiry check originally assumed completion within 600ms. It now waits for removal of private content after the authoritative session response. The final suite passes.
- Opening or completing newly accessible content preserves safe inherited video position; stale writes are never silently retargeted after publication.

## Shared read-only checks and remaining boundaries

Shared public catalog: HTTP 200. Shared Swagger: HTTP 200. Credentialed CORS permits http://localhost:5174 with Access-Control-Allow-Credentials:true. Its handshake still refuses purchases. No shared account login, write, migration, repair or mutating test was performed.

The shared API process remains the previously running build; deployment of new learner read routes there was intentionally not performed. Hosted progress/purchase enablement remains pending separate approval. Private shared media availability was not verified through account access; database rows alone do not prove files were deployed.

Fatima coordination remains only for the documented catalog/category predicate difference, any legacy receipt/lineage repair, expanded attachment authoring formats or a future deployment/schema policy decision. Current learning policy is preserved, so these are not blockers for this isolated implementation. No arbitrary historical browsing, task submissions/reviews, completion reconciliation or certificates were implemented.

## Acceptance checklist

- [x] Actual Learner/Both membership, session/onboarding and owned eligible enrollment enforced.
- [x] Current published version and receipt bound to ordered persisted curriculum.
- [x] Draft, foreign, unrelated and arbitrary historical content fail closed.
- [x] Protected video, range, HEAD and attachment downloads use private storage.
- [x] Persisted reads, explicit opens, positions and monotonic completion implemented.
- [x] Concurrent first writes, stale values/tokens, precision, rollback/retries and commit ambiguity verified on SQL Server.
- [x] Publication races preserve concrete history and logical achievements.
- [x] Resume follows valid persisted activity and immutable video identity.
- [x] Lesson coverage, combined progress and persisted completion remain distinct.
- [x] Learner pages use backend authority; account switch/expiry/bilingual responsive checks pass.
- [x] Financial, enrollment, receipt, task and certificate invariants preserved.
- [x] Phase 1 SQL/browser and non-SQL regressions pass.
- [x] No shared writes, migrations, duplicate entities or new dependencies.
- [ ] Hosted deployment/private media verification and hosted write enablement: outside approved isolated scope; pending separate approval.
- [ ] Project-owner Phase 2 review/acceptance: pending.

No implementation blocker remains for the approved isolated scope. Do not start Phase 3 before review and approval.
