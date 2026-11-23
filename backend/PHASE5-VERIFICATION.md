# Phase 5 verification - November 23, 2026 hardening

Implementation and contracts: [PHASE5-REVIEWS-ACCOUNTS-ANNOUNCEMENTS-METRICS.md](PHASE5-REVIEWS-ACCOUNTS-ANNOUNCEMENTS-METRICS.md).

Final results below supersede the November 22 pre-audit counts. The two confirmed audit defects are fixed and covered by frontend/API/browser regressions. Earlier diagnostic attempts are retained separately and are not counted as additional passing tests. Phase 5 is ready for a reviewed commit to the existing feature branch within the approved isolated scope. Hosted enablement remains unapproved; the historical course-lock timeout is not claimed resolved.

## Environment and safety

| Check | Verified state |
| --- | --- |
| Actual DB_NAME() | Esham_AccountTests_Phase1_20261114 |
| Configured instance | (localdb)\MSSQLLocalDB |
| Actual IsLocalDB | 1 |
| Latest fixture-recorded server | DESKTOP-I0292P0\LOCALDB#6AE161FD |
| API/frontend | localhost:5216 / localhost:5175 |
| Shared runtime | 5206/5174 not restarted or reconfigured |
| Phase 1-4 isolated gates | purchases, progress, submissions and completion enabled only on verified LocalDB |
| Phase 5 isolated gates | reviews, account-security and selected announcement delivery enabled only on verified LocalDB |
| Background recovery | Course completion and Phase 5 periodic delivery disabled; explicit scoped scans tested |
| Announcements | Explicit fresh synthetic IDs; browser fixtures also restrict recipients to their synthetic account IDs |
| Capture | Exact private, non-served ignored directory; current Windows user and SYSTEM ACL |
| Startup seeders | Both flags false |
| Credentials | Existing shared User Secrets untouched; process-local integrated-auth SQL config |
| Schema/dependencies | No migrations, provisioning, reset, backfill, new entities/tables or packages |
| Hosted database | No db75401 connections or mutations initiated by verification |
| Git | Branch feature/learner-phases-1-3, original HEAD 010a3bc; Phase 5 uncommitted/unpushed |

Every SQL provider and mutation interceptor verifies the actual approved target. Runtime capabilities also verify DB_NAME/IsLocalDB inside transactions. Negative hosted-catalog configuration tests return false before opening that target. Existing fixture graphs are preserved; failed browser attempts use new additive graphs, not resets. Capture tokens/passwords, media, screenshots, PDFs, logs and TRX are ignored artifacts and are never included in this report.

## Final result counters

| Final run | Passed | Failed | Skipped |
| --- | ---: | ---: | ---: |
| Backend safe run | 440 | 0 | 125 |
| Explicitly selected SQL suites | 125 | 0 | 0 |
| Separate recovery child-process actions | 2 | 0 | 0 |
| Frontend automated tests | 181 | 0 | 0 |
| Browser scenarios, Phases 1-5, account races and legacy editing | 84 | 0 | 0 |
| Persisted invariant actions, Phases 1-5 | 5 | 0 | 0 |
| Final selected announcement delivery replay action | 1 | 0 | 0 |
| Private fixture/capture HTTP HEAD probes | 2 | 0 | 0 |

Backend solution, explicit test-project and isolated runtime builds passed with zero warnings/errors. Frontend production build passed; existing third-party bundler directive warnings remain. Swagger returned 200; credentialed CORS explicitly allowed http://localhost:5175 with Access-Control-Allow-Credentials=true.

The 125 selected SQL cases comprise Phase5SqlTests 18, Phase5HardeningSqlTests 7, Phase4HardeningSqlTests 7, CompletionSqlServerTests 15, EnrollmentSqlServerTests 16, LessonProgressSqlServerTests 12, SubmissionSqlServerTests 18, InstructorInsights SQL 1, and the following 31 regressions: account finalization 5, user categories 3, notifications 4, version updates 5, resubmission 1, platform moderation 4, CategoryAdmin provisioning SQL 3 (existing-catalog tests, not database provisioning), AdminUser SQL 4, AdminIntegration SQL 1 and public educational content SQL 1. The two recovery children also have passing parent assertions; they are separate process actions, not extra distinct business scenarios.

Browser breakdown: Phase 5 17, Phase 1 14, Phase 2 13, Phase 3 15, Phase 4 16, session renewal/account switching 2, deterministic AccountPage races 6 and persisted legacy review editing 1. All use the isolated runtime; the six UI race tests deliberately intercept profile/persona write responses and delay session responses, while real synthetic logins drive account switching. They prove UI continuation behavior rather than claiming those intercepted profile writes persisted. The legacy edit uses actual GET/PUT/DELETE and verifies null attribution is retained. Private HEAD probes independently confirmed 403 for actual private recovery and fixture files through Vite, without reading their response bodies.

Safe-run skips are intentional: 108 relational test definitions executed separately as the 125 parameter-expanded SQL cases above; 16 explicit fixture/publication/invariant/recovery action definitions (15 exercised separately, provisioning deliberately excluded); and one migration/backfill definition deliberately excluded. Skipped definitions are not claimed as passes. The safe run total is 565 discovered cases, with 440 passing and 125 skipped. No blanket SQL opt-in run was performed.

Sources: artifacts/phase5-results/hardening-safe-final.trx; the eighteen named hardening-{suite}.trx files; recovery child TRX beneath phase5-results/phase4-hardening and phase5-results; hardening-invariant1-final.trx through hardening-invariant5-final.trx; hardening-delivery-replay.trx; artifacts/phase5-hardening-frontend-final.log and phase5-hardening-frontend-build-final.log. Browser evidence is phase-specific browser-results.json plus hardening-race-browser-results.json and hardening-legacy-browser-results.json beneath artifacts/phase5-isolated. Initial pre-login failure evidence is retained as diagnostic-prelogin-*.trx. Earlier original results remain historical evidence, not additional final cases. All artifacts stay ignored and uncommitted.

## Commands

Commands run from repository root. Supply the approved integrated-auth LocalDB value only through process environment; full connection values and credentials are deliberately omitted.

```powershell
# The solution excludes the test project: build/test that project explicitly.
dotnet build backend/esham.sln --no-restore -p:OutputPath=C:\Users\HP\Documents\esham\artifacts\phase5-hardening-runtime\ --verbosity quiet
dotnet build backend/esham.Tests/esham.Tests.csproj --no-restore -p:OutputPath=C:\Users\HP\Documents\esham\artifacts\phase5-hardening-final-tests\ --verbosity quiet
$env:ESHAM_RUN_ISOLATED_SQL_TESTS='0'
dotnet test backend/esham.Tests/esham.Tests.csproj --no-build -p:OutputPath=C:\Users\HP\Documents\esham\artifacts\phase5-hardening-final-tests\ --logger 'trx;LogFileName=hardening-safe-final.trx' --results-directory artifacts/phase5-results

# Set explicit LocalDB opt-in and exact approved identity only for named suites.
$env:ESHAM_RUN_ISOLATED_SQL_TESTS='1'
$env:ESHAM_APPROVED_ISOLATED_DATABASE='Esham_AccountTests_Phase1_20261114'
dotnet test backend/esham.Tests/esham.Tests.csproj --no-build -p:OutputPath=C:\Users\HP\Documents\esham\artifacts\phase5-hardening-final-tests\ --filter 'FullyQualifiedName~Phase5SqlTests' --logger 'trx;LogFileName=hardening-Phase5SqlTests.trx' --results-directory artifacts/phase5-results
dotnet test backend/esham.Tests/esham.Tests.csproj --no-build -p:OutputPath=C:\Users\HP\Documents\esham\artifacts\phase5-hardening-final-tests\ --filter 'FullyQualifiedName~Phase5HardeningSqlTests' --logger 'trx;LogFileName=hardening-Phase5HardeningSqlTests.trx' --results-directory artifacts/phase5-results
# Repeat individually for the named suites in the result breakdown.
# No unfiltered SQL opt-in; provisioning and migration/backfill remain excluded.

npm.cmd --prefix frontend test
npm.cmd --prefix frontend run build

# Each script requires the approved isolated API/frontend handshake and its private fixture pointer.
node frontend/scripts/verify-phase5.cjs
node frontend/scripts/verify-enrollment-wallet.cjs
node frontend/scripts/verify-learning-progress.cjs
node frontend/scripts/verify-learner-submissions.cjs
node frontend/scripts/verify-completion-certificates.cjs
node frontend/scripts/verify-session-renewal.cjs
node frontend/scripts/verify-phase5-private-files.cjs
# AccountPage delayed-response scenarios (synthetic sessions, intercepted profile writes).
node frontend/scripts/verify-phase5-hardening.cjs
# After the explicit guarded Phase5 SETUP=legacy-review action:
$env:ESHAM_PHASE5_HARDENING_BROWSER='legacy'
node frontend/scripts/verify-phase5-hardening.cjs

# Run each phase's explicit Verify action with SETUP=invariants and its private artifact root.
dotnet test backend/esham.Tests/esham.Tests.csproj --no-build -p:OutputPath=C:\Users\HP\Documents\esham\artifacts\phase5-hardening-final-tests\ --filter 'FullyQualifiedName~Phase5IsolatedEnvironmentTests.Verify' --logger 'trx;LogFileName=hardening-invariant5-final.trx' --results-directory artifacts/phase5-results
git diff --check
```

Fresh fixture setup and delivery are explicit guarded actions, never application startup seeders. Their source definitions are Phase1-5IsolatedEnvironmentTests. Phase 1 publication uses its existing explicitly selected helper. Regression roots live under artifacts/phase5-isolated/phase1-regression through phase4-regression; earlier phase reports are preserved. Test media stays in the existing isolated media root. Phase 4 hardening diagnostic/restart output is redirected to the validated artifacts/phase5-results/phase4-hardening directory.

## New test coverage

- Learner/Both reviews before completion; original version attribution; actual role/ownership/origin/account checks; duplicate, stale version and invalid rating/comment rejection.
- Concurrent identical replay, independent duplicates, edit/reply race, repeated withdrawal, cross-course request reuse and deleted-review replay protection.
- Review/audit/notification rollback after persistence and lost commit acknowledgement reconciliation.
- Review versus actual version publication, preserving purchased version and access receipts.
- GeneralAdmin-only removal with required immutable reason and no unsupported hidden state.
- Password change/reset/revoke; lockout counters; stale stamps; reset replay; generic recovery response; no HTTP capture route and throttling.
- Real HTTP cookie containers with delayed original headers across password/revoke and account switching; prior Phase 4 passive-cookie regressions retained.
- Queued profile request behind account revocation cannot refresh a new-stamp session.
- Current-membership announcement audiences, Both deduplication, selected IDs, generation replay and read timestamp retention.
- More than fifty recipients, poison-batch rollback/continuation, two workers, interruption and resumption in another dotnet test process.
- Actual announcement authoring/delivery/revocation race; existing publication policy is preserved, with monotonic generation timestamps on republish.
- Independent default-off capability flags and refusal of hosted catalog configuration.
- SQL owner-filtered metrics matching ledger and constant query count as cohort grows from one to 121 synthetic enrollments.
- Three shared-participant mixed Phase 1-5 waves: purchases/replay, lesson progress, drafts/submissions, instructor approval, reconciliation, reviews/replies, announcement delivery and all-session revocation. Existing system_health diagnostics are read only; no event session is created or changed.
- Disabled/unselected background delivery never resolves a database scope.

## Focused hardening verification

- Account operations capture the originating identity epoch and view generation. Six browser cases hold successful/failed profile responses, successful/error-recovery refreshes and persona refreshes across A -> B and A -> B -> A. The rendered account identity is awaited explicitly; equal synthetic display names do not satisfy a switch barrier. Follow-up requests are checked for the current account header and current draft, not stale A data.
- The review read DTO exposes PurchasedCourseVersionId independently of nullable review attribution. The real HTTP API regression reads a historical null review, edits using its owned enrollment receipt and asserts the review/audit attribution stays null. A guarded synthetic legacy fixture supports the actual Saved Reviews browser edit/withdraw test.
- Recovery tests use the real Data Protection purpose and time-limited protector: an already expired envelope is rejected, a future envelope succeeds, another purpose is rejected, invalid envelopes do not consume the underlying Identity token, and issued envelopes expire thirty minutes after issuance. These are real-clock before/after checks, not an injected exact-tick clock simulation.
- SQL reset/reset, reset/password-change and reset/revoke races rendezvous before the user lock. Exactly one original credential generation succeeds; financial rows and balances are unchanged, and diagnostic SQL error collections are empty.
- A forced three-party schedule holds the delivery announcement lock, queues authoring, holds the revocation user lock, then releases delivery to wait on that user. The observed chain is two LCK_M_U waits (session 63 -> 77 -> 78 in this run), recorded in hardening-three-party.json. Revocation releases without a cycle; delivery and authoring finish. SQL errors: zero. Session numbers are ephemeral.
- Announcement authoring now discovers authorization outside its transaction, then locks announcement -> author user -> rechecks memberships inside. Delivery follows announcement -> sorted recipient users. Security changes take only their user lock; course workflows retain course-first ordering. This compatible order does not rely on retrying a deadlock.
- Audience tests pause delivery before its recipient lock and change the synthetic account through real AccountService finalization. Removing Learner membership suppresses delivery; adding it allows delivery, based on memberships after the wait.
- SQL metric fixtures cover ambiguous historical completed enrollments, carried logical lesson evidence in the current published version, and recent assessment events for old enrollment cohorts. The 7d queue contains the recent submission while the 7d enrollment cohort is empty; all-time queue includes both.
- Successful mixed Phase 1-5 runs now explicitly assert an empty diagnostic SQL-error collection. Recovery pagination, poison continuation, restart and concurrent workers are rerun in the selected Phase 4/5 suites.

## Browser coverage

Phase 5 uses real Edge contexts, ports 5216/5175 and fresh synthetic accounts. Seventeen checks cover active-enrollment create/edit/withdraw/reply, request replay, public privacy, GeneralAdmin removal, audience feed/read state, ledger metrics, completion/certificate hooks, one-request profile/category save, immutable certificate snapshots, Arabic mobile RTL, password-change/revoke UI, private capture/reset/replay, URL token removal and truthful deletion unavailability.

Phases 1-4 use separate fresh graphs for purchase, learning/media/progress, submissions/assessment, certificates/revocation/PDF/privacy and real-header account-switch regressions. Persisted invariant actions verify their own financial/version/evidence/certificate snapshots after browser execution.

## Diagnostic failures and corrections

1. Initial restricted safe baseline: 363 passed, 39 failed, 100 skipped. Failures were Windows Data Protection key access. Authorized baseline: 402 passed, zero failed, 100 skipped; no security behavior was weakened.
2. First focused SQL run: five passed, one failed because a Both-role fixture correctly returned 404 for another owner's course, while the assertion expected 403. Corrected the assertion.
3. Recovery child refused a mixed-separator artifact path. Normalized it. A solution-only rebuild initially left the old test assembly in place because the solution excludes the test project. Final commands explicitly rebuild the test project.
4. One earlier mixed wave timed out on course-lock commands; subsequent waves and the later three-wave rerun passed with zero captured SQL errors. Read-only blocking diagnostics were added. The earlier timeout is retained as a non-reproduced diagnostic limitation, not represented as a confirmed repaired deadlock.
5. Phase 2 fixture guards correctly rejected the new regression media-root combination. Added the exact Phase 5 regression path to the existing allowlist without broadening to arbitrary paths.
6. Initial browser diagnostics exposed harness assumptions: enrollment detail is an envelope, repeated synthetic announcement text requires resource-specific selectors, API restart requires readiness polling, and language initialization must not overwrite an explicit Arabic preference. Corrected the harness and used fresh graphs, never resets. The final full Phase 5 run passes all seventeen checks.
7. A real frontend SSR regression rendered a null selected review when both account and selected-account IDs were undefined. Added an explicit selected-record guard; final frontend suite passes all 174 tests.
8. The queued-profile SQL test initially started its blocker transaction outside EF's retry strategy. Wrapped the test's blocker in its execution strategy and suppressed inherited strategy flow into the independent concurrent request. Application transaction logic was unchanged by that harness correction.
9. Identity's default configured password validators did not enforce the existing registration letter/digit rule for replacement passwords. Added the same rule to change/reset validation; weak-password unit cases and real HTTP browser rejection pass. Malformed protected token formats now return 400 rather than an exception.
10. Historical null review-version attribution must remain null in audit history. Removed fallback attribution for existing reviews and added a focused regression. New reviews still require the original purchased version.
11. Repeated/backward publication clock values could reuse a notification generation. Republish now advances PublishedAt monotonically; selected SQL coverage verifies it without changing publication permissions or statuses.
12. Final client review found profile preconditions inferred from another tab's localStorage cache. Removed that fallback. Onboarding now binds its verified session and matching draft account explicitly and ignores switched-account success responses. A focused frontend test verifies missing caller identity fails before sending; the final suite contains 174 passing cases.
13. The independent audit identified a separate AccountPage refresh continuation race and the historical Saved Reviews version-precondition mismatch. Both are fixed and covered by the targeted regressions above. Final frontend count after hardening is 181, superseding the original 174.
14. One initial hardening notification regression failed before opening its transaction: SqlClient pre-login initialization took approximately 394 seconds and timed out. This is distinct from the earlier course-lock command timeout. Its failing TRX is preserved; the selected notification rerun passed all four cases, and all eighteen final SQL suites pass. Neither observation proves the historical timeout's root cause.
15. Browser setup diagnostics included missing selected announcement delivery, a transient reviews-heading timeout, and an A-B-A harness barrier that initially compared identical synthetic names. Prepared explicit delivery, checked the page for JavaScript errors (none), and changed the switch barrier to rendered account identity. Final browser counts include only completed passing runs; no fixtures were reset.

## Remaining limitations and acceptance boundary

- Hosted enablement is unapproved and not performed.
- Recovery is private isolated capture only. No real email provider, delivery guarantee or production recovery claim.
- Recovery capture files remain ignored private artifacts; logical token expiry does not purge every old file automatically.
- All-session revocation is stamp-based; no per-device registry, account deletion/deactivation or email-change implementation.
- Within-module interactive serialization is not a global browser/device session sequencer. Delayed rejection/cookie deletion may fail closed by signing out a newer session. Cookie delivery and credential SQL commit are not atomic.
- Review removal retains admin audit history; no soft-delete state, restoration workflow or learner revision-history endpoint. GeneralAdmin removal does not permanently prevent a new valid review.
- Announcement audience is evaluated at delivery, not frozen at publication. Old notices are title/summary snapshots and link to the current authorized feed, not historical body snapshots.
- Periodic background recovery remains disabled; scoped durable core, interruption/restart and concurrency are verified. No whole-catalog backfill or load claim.
- Metrics are bounded owner projections with explicit cohort/event semantics; different widgets can observe different commits. No watch-time inference or production-scale performance claim.
- The single earlier mixed timeout was not reproduced; retain diagnostics for future soak testing.
- No commits/pushes, main merge or Phase 6 work.

## Acceptance checklist

- [x] Enrolled active/completed Learner/Both review CRUD, original version attribution, owner replies and reasoned GeneralAdmin removal.
- [x] Existing immutable bounded audit, concurrent replay/conflict handling and transactional notifications.
- [x] Password change/reset/all-session revocation, lockout/stamp/fixed-expiry protections and private isolated capture.
- [x] One-request transactional profile/category save and caller-bound session preconditions.
- [x] Current-role audience feed, selected synthetic generation delivery, replay/read-state retention and durable restart/pagination core.
- [x] Persisted bounded owner metrics and ledger-derived teaching points; bilingual account-scoped frontend integration.
- [x] Selected SQL concurrency/rollback/publication/security tests, browser checks and Phase 1-4 regressions.
- [x] Wallet/ledger totals, purchased receipts, historical evidence and certificate snapshot invariants preserved.
- [x] Both confirmed independent-audit defects fixed and deterministically regression-tested.
- [x] Controlled three-party locking, credential races, token expiry/purpose and audience/metric gaps covered.
- [x] Default-disabled independent gates, actual isolated identity checks, no shared access, schema/dependency changes or Git publication.
- [ ] Project-owner review and final Phase 5 acceptance.
- [ ] Any future hosted enablement or real email provider: separate approval and operational work, outside this implementation.

The exact source manifest is in the implementation report. Working changes are intentionally unstaged and uncommitted.

Final source review: 64 files (33 modified, 31 new); zero staged files. No changed/untracked environment configuration, local database, media, PDF, log, TRX or build-output files are included in that manifest. Broad credential-pattern candidates were code variable assignments or synthetic test passwords, not hosted credentials or secret connection values. Existing ignore rules cover the private runtime/test artifacts. git diff --check passed; Git reports existing LF/CRLF normalization warnings for several source files. No commit, push or Phase 6 work was performed.
