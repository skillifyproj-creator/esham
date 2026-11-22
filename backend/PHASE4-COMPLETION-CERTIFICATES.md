# Phase 4: Course completion and certificates

Implemented November 21, 2026 for the approved isolated development scope. Hosted enablement is not authorized. No migrations, new tables, rendering dependencies or wallet changes.

See [verification](PHASE4-VERIFICATION.md) for executed checks, diagnostic failures and environment identity. Phase 5 is not started.

## Authority and curriculum policy

`EnrollmentCompletionService` uses `CourseVersionUpdates.GetStateAsync` as the shared persisted achievement evaluator. It checks every current logical lesson/task explicitly; rounded percentages never decide eligibility. All current requirements must be earned and the set must be nonempty.

The existing model has no instructor-configurable optional flag. Preview visibility and task readiness are not optionality. Earned logical items permit optional revisits; approved evidence survives later optional rejection. Previously completed courses remain completed and later content is optional. Completed responses report no remaining required curriculum; current optional coverage remains available through the existing learning/version-state APIs.

New completion requires an active enrollment, actual Learner membership (including Both), complete account setup, active course/category, current approved same-course publication and its existing availability receipt. EnrollmentPaused continues to block purchases only. Inaccessible or ambiguous version evidence cannot create completion. Existing approved legacy task evidence retains its existing semantics; unknown evidence dates are never invented.

`CompletedAt` is the first committed reconciliation time, not an invented historical date when an old requirement might have been earned. Completed status or an existing completion timestamp prevents automatic re-finalization. Missing timestamps/certificates/version attribution are reported as `historical_completion_ambiguous`; they are not backfilled. Existing certificates and historical evidence are retained when content becomes unavailable.

## Transaction and locking

Transactions use the existing SQL execution strategy and Serializable isolation:

1. Discover the target outside the transaction and verify the isolated gate.
2. Inside the transaction, check the actual connection identity.
3. Lock Course with UPDLOCK/HOLDLOCK first.
4. Lock participant user rows in ordinal ID order, then Enrollment.
5. Revalidate actor/ownership/access and query persisted evidence.
6. Set completed status/date, insert the certificate and stage its notification.
7. Save and commit together.

Lesson completion saves its evidence within the still-open transaction before reconciliation. Instructor approval similarly saves the immutable review/status and assessment notice before reconciliation in that same transaction. A later failure rolls all these writes back. Repeated lesson completion can recover a missed finalization without changing the lesson's first timestamp. Repeated instructor decisions retain the existing conflict behavior.

Assessment discovery/authentication reads were moved outside the serializable transaction; actual actor/ownership checks are repeated after course/user/enrollment locks. This avoids taking those read locks ahead of the course lock. No assessment decision/eligibility policy was replaced.

Retries clear tracking and reload committed state. Enrollment is the natural reconciliation key. Existing unique Certificate.EnrollmentId and VerificationCode indexes prevent duplicate issuance. A lost commit acknowledgement is reconciled to the already committed certificate/date; no replacement identity is generated for an existing completion. PDF rendering is outside SQL transactions.

The purchased Enrollment.CourseVersionId, learner attribution, version receipts, wallet balances and ledger rows are never updated by Phase 4.

## Recovery and publication

`CompletionRecoveryService` runs repeatable database-backed keyset scans when both CourseCompletion.Enabled and RecoveryEnabled are explicitly enabled. Every reconciliation is independently transactional and rechecks the gate. Failed rows are logged by enrollment ID and reconsidered on later passes; another row need not wait for a malformed snapshot to be repaired.

The scan derives its work from durable enrollment/evidence rows, not an in-memory publication event. It therefore also finds eligible evidence committed while Phase 4 was disabled and requirements satisfied after publication changes. Restarts begin another durable scan. Production publication behavior and receipt staging are unchanged; committed publication changes are picked up by the next scan (45-second delay between passes, plus scan duration).

Course-first locking linearizes publication versus completion. Completion first pins that version permanently; publication first makes reconciliation evaluate the new current version. Existing logical achievements transfer under existing rules. Removed requirements can make an active enrollment eligible; an empty version cannot. A completed enrollment is never reopened.

For verification, the catalog-wide background scan is kept disabled to preserve older fixture graphs. Recovery tests call the same scan with a fresh synthetic course scope. No persistent queue/checkpoint table is introduced.

## Gate and runtime configuration

`CourseCompletionOptions` defaults to disabled. Process-local isolated configuration:

```text
CourseCompletion__Enabled=true
CourseCompletion__ApprovedIsolatedDatabase=Esham_AccountTests_Phase1_20261114
CourseCompletion__RecoveryEnabled=false
```

Full background scanning requires an additional explicit RecoveryEnabled=true decision for the isolated runtime. The gate requires exact catalog, `(localdb)\MSSQLLocalDB`, integrated authentication, actual DB_NAME(), IsLocalDB=1 and the local-machine LOCALDB# server identity. It associates identity-check commands with an existing EF transaction when necessary.

The gate covers explicit reconciliation, automatic lesson/assessment hooks, recovery and admin revocation. Disabled hooks return without Phase 4 writes; the existing instructor assessment itself remains available. GET requests never finalize an account/course or issue certificates.

Do not copy these enabled flags into hosted settings. The shared db75401 and User Secrets were not changed.

## API contracts

| Method | Route | Contract |
| --- | --- | --- |
| GET | /me/enrollments/{enrollmentId}/completion | CompletionState |
| POST | /me/enrollments/{enrollmentId}/completion/reconcile | `{expectedCourseVersionId:"<guid>"}` -> CompletionState |
| GET | /me/certificates?page=1&pageSize=20 | `{accountId,items,page,pageSize,total}` |
| GET | /me/certificates/{id} | CertificateDetail |
| GET | /certificates/verify/{code} | Minimal CertificateVerification |
| POST | /admin/certificates/{id}/revoke | `{reason:"..."}` -> `{id,status}` |

CompletionState contains accountId, enrollmentId, evaluatedCourseVersionId, status, completedAt, eligible, reasonCode, requiredLessonCount, earnedRequiredLessonCount, requiredTaskCount, approvedRequiredTaskCount, certificate and reconciliationEnabled. Eligible means exact current requirements have been earned; it does not bypass the gate or historical-record safeguards.

CertificateDetail contains accountId, id, enrollmentId, nullable courseVersionId, verificationCode, learnerNameSnapshot, courseTitleSnapshotAr/En, instructorNameSnapshot, issuedAt and status. It contains no email, private media, answer text, financial operation key or unrelated profile data.

Learner routes require actual Learner membership, complete setup, current session and ownership. Mutations also use AdminMutationFilter (trusted origin/request marker) and EnrollmentAccountFilter. Private responses use FinancialResponseFilter. ServiceResult retains 400 validation, 401 session, 403 forbidden/disabled, 404 absent/non-owned and 409 conflicts. Disabled writes use completion_disabled; stale active-enrollment requests use publication_changed. Owned read responses can describe unavailable or ambiguous history without mutating it.

## Certificate lifecycle and privacy

New certificates use 24 cryptographically random bytes encoded as 48 uppercase hex characters (192 bits). Unique database indexes remain the final duplicate guard. The completion version is recorded independently of the immutable purchase version.

Identity, names, titles, attribution and IssuedAt are immutable through EF after insertion. AppDbContext prevents clearing/replacing a first completion date, reopening historical completion, deleting certificates or reversing revocation. These are application protections, not new database triggers or constraints.

Canonical persisted names are frozen once. Both language layouts use that same snapshot; titles use existing language snapshots. Profile edits do not rewrite certificates. Missing/overlong snapshot data aborts the enabled transaction and requires review. No editable certificate-name field or localStorage value determines issuance or PDF identity.

GeneralAdmin alone may revoke, with a required reason. Status changes from issued to revoked, with one AdminActivityLog in the same guarded transaction. Replays return the existing status. No deletion, automatic revocation, unrevocation or replacement certificate. Public verification never discloses the internal reason.

Public verification accepts exact new-format codes only and returns status, one masked learner grapheme, course titles, issue date and issuer. It returns no account/enrollment IDs, full names, evidence or files. Invalid/unknown codes return 404. The endpoint uses a 20-request/minute per-IP fixed-window limiter, no-store, noindex and no-referrer headers. Limits are process-local; multi-instance/proxy deployment needs a separate operational review.

Historical certificates remain owner-readable without rewriting their codes or nullable attribution. Non-new-format legacy codes are not silently enabled for anonymous lookup. Any legacy verification expansion requires a separate entropy/privacy review.

## Frontend and PDF

The existing canvas/JPEG-backed PDF renderer is reused; no server renderer/dependency was added. The browser obtains authenticated immutable CertificateDetail, checks issued status, renders, then rechecks current record/status and account generation before downloading. Dates use UTC. Arabic shaping is supplied by the browser. Verification remains authoritative; locally generated PDFs are not digitally signed or remotely recallable.

Certificate list/detail requests are account scoped and abort on navigation/account changes. Async PDF work checks account identity and lifecycle generation. Revoked records are visible but the official download action is disabled. Public verification uses credential-free fetches.

My Courses links completed enrollments to certificates. Enrollment detail and the player display server completion/eligibility. Lesson completion refreshes learning and financial/enrollment state. Existing course-only certificate URLs lead to the authenticated certificate list; record links use certificate GUIDs. No demo selection or profile cache is issuance authority. Existing preview helper remains unused by production certificate pages for compatibility with prior tests.

## Source manifest

New backend:

- esham.BLL/DTOs/Completion/CompletionDtos.cs
- esham.BLL/Interfaces/ICompletionMutationGate.cs
- esham.BLL/Services/CompletionMutationGate.cs
- esham.BLL/Services/EnrollmentCompletionService.cs
- esham.BLL/Services/CertificateService.cs
- esham.PL/Endpoints/CompletionEndpoints.cs
- esham.PL/Services/CompletionRecoveryService.cs
- esham.Tests/CompletionTests.cs
- esham.Tests/CompletionApiTests.cs
- esham.Tests/CompletionSqlServerTests.cs
- esham.Tests/Phase4IsolatedEnvironmentTests.cs

Modified backend:

- esham.BLL/Services/LessonProgressService.cs
- esham.BLL/Services/InstructorInsightsService.cs
- esham.BLL/Services/NotificationService.cs
- esham.DAL/Data/AppDbContext.cs
- esham.DAL/Data/Configurations/CourseVersionUpdateConfiguration.cs
- esham.PL/Program.cs
- esham.Tests/Phase2IsolatedEnvironmentTests.cs
- esham.Tests/Phase3IsolatedEnvironmentTests.cs

New frontend:

- src/services/certificatesApi.js
- src/components/CompletionPanel.jsx
- src/pages/CertificateVerificationPage.jsx
- tests/completion-certificates.test.mjs
- scripts/verify-completion-certificates.cjs

Modified frontend:

- package.json
- src/App.jsx
- src/pages/learner/LearnerCertificatesPage.jsx
- src/pages/learner/LearnerCoursesPage.jsx
- src/pages/learner/LearnerEnrollmentPage.jsx
- src/pages/learner/LearnerLessonPage.jsx
- src/styles/certificates.css
- src/services/notifications.js
- scripts/verify-enrollment-wallet.cjs
- scripts/verify-learner-submissions.cjs
- scripts/verify-learning-progress.cjs

README and these two Phase 4 documents complete the handoff. Existing phase fixture helpers now accept a dedicated Phase 4 regression artifact directory; they still verify LocalDB identity and never reset prior fixtures. The Phase 1 browser publication helper can explicitly select the separate test output directory.

The notification client allowlist recognizes only the server-resolved certificate record route; arbitrary external targets remain rejected. The source manifest after hardening contains 49 files (25 modified, 24 new), including documentation and tests. No project/dependency, migration, appsettings or lock files changed.

## Boundaries and deviations from the initial plan

- No server PDF route/renderer, per the explicit approval decision.
- Reuse the existing version evaluator instead of duplicating logical achievement rules.
- Use durable periodic scanning instead of adding publication business-transaction hooks or a new queue table.
- Use concrete services, consistent with existing instructor/admin services; no extra service-interface layer or certificate provider is necessary.
- Frozen bilingual personal-name columns, immutable stored PDF bytes, digital signatures, reissuance, broader revocation workflows and legacy repairs are not implemented.
- No Phase 5, commits, pushes, new dependencies, migrations or hosted mutation enablement.

## Focused hardening handoff - November 22, 2026

This section supersedes earlier verification limitations concerning delayed passive cookie renewal and recovery restart coverage. Exact final results and commands are in PHASE4-VERIFICATION.md.

### Consistent completion reads

EnrollmentCompletionService.GetAsync first discovers an owned enrollment, then uses the execution strategy and a transaction to acquire the course UPDLOCK/HOLDLOCK before rereading ownership, enrollment, certificate and version state. SQL Server uses ReadCommitted: the held course lock excludes the existing course-scoped publication, evidence, completion and revocation writers while constructing the response. This is an equivalent consistent projection without enabling database snapshot isolation. The read commits without saving data. Non-SQL test providers retain the existing Serializable transaction convention.

The controlled GET-versus-completion SQL test proves that a blocked completion cannot interleave its certificate with the older enrollment projection. The subsequent GET returns the completed enrollment and its certificate together. Coarse course serialization can briefly delay writers; this is a deliberate correctness trade-off, not an unmeasured throughput claim.

### Confirmed mixed-workload deadlock correction

LearnerSubmissionService retains course-first locking and now locks both learner and course owner in ordinal order before the enrollment. Submission creation also reserves its request-ID primary-key range with UPDLOCK/HOLDLOCK before testing absence. Existing system_health deadlock graphs identified concurrent serializable absent-key reads converting RangeS-S locks during inserts into TaskSubmissions. The range reservation avoids that conversion cycle without changing schema, request IDs or retry semantics.

Three final mixed-workload waves combine purchases/replays, lesson writes, draft/submission writes, instructor approvals, completion GETs and reconciliation across shared learner/instructor identities and different courses. All succeed with zero captured SQL errors and zero new deadlock events. Baseline graphs and final diagnostics remain private ignored artifacts. No index, migration or publication-policy changes were made.

### Passive session renewal protection

AccountCookieValidation.Configure disables sliding expiration; after the existing zero-interval Identity security-stamp validation, ValidateAsync also suppresses automatic ticket renewal. Claims are refreshed for the current request, security stamps and lockouts are still enforced, and the original ticket expiration is preserved. Explicit sign-in/profile refresh actions continue issuing cookies. This changes passive sliding sessions to fixed-lifetime sessions; users must authenticate again when their ticket expires.

Real HTTP cookie-container tests and Edge tests hold responses with their original headers across logout and account switching. Previously those passive responses could restore account A; they now issue no renewal cookie and cannot overwrite logout/account B. Browser regression scripts no longer remove Set-Cookie headers to hide this behavior. These protections do not introduce a server-side session store or promise ordering of overlapping explicit sign-in/profile-refresh operations. A delayed cookie-deletion response can still fail closed by signing out a newer session; broader interactive session sequencing remains future security work.

### Durable recovery and guarded regression infrastructure

Synthetic course-scoped scans verify 62 enrollments over the 50-row page boundary, poison-row rollback and continuation, retry after poison removal, interruption after committed work, resumption in a separate dotnet test process over 57 enrollments, and two concurrent workers over 53 enrollments. Existing certificate identities and first completion timestamps survive restart. Disabled-worker tests verify that disabling either gate prevents even database-scope resolution. Catalog-wide timer/background recovery remains disabled; full-catalog scheduling/load is not claimed verified.

IsolatedSqlMutationGuard is attached to the existing account/admin relational factories. Before EF DML, it checks the explicit SQL opt-in, exact configured catalog and integrated-auth LocalDB source, then actual DB_NAME(), IsLocalDB and local instance identity on the command's connection/transaction. Schema commands are refused. The previously omitted 31 relational regressions now all pass; three outdated moderation assertions were corrected to distinguish publication notices already created by their fixture from warning/appeal notices. No moderation business behavior changed.

### Certificate presentation and source additions

Known issued/revoked labels remain bilingual; unknown statuses are explicit on owned and public pages. Screen and PDF issue dates share the same UTC formatter. Public verification mounts an explicit noindex,nofollow robots meta policy; its API privacy/rate-limit headers remain unchanged. Deployment-level frontend HTTP indexing headers are still an operational consideration.

Additional new files beyond the original manifest:

- esham.Tests/CompletionRecoveryDisabledTests.cs
- esham.Tests/IsolatedSqlMutationGuard.cs
- esham.Tests/Phase4HardeningSqlTests.cs
- esham.Tests/Phase4RecoveryResumeTests.cs
- esham.Tests/SessionRenewalTests.cs
- frontend/scripts/verify-session-renewal.cjs

Additional modified files beyond the original manifest:

- esham.BLL/Services/LearnerSubmissionService.cs
- esham.PL/Endpoints/AccountCookieValidation.cs
- esham.Tests/AccountFinalizationTests.cs
- esham.Tests/AdminUserTests.cs
- esham.Tests/PlatformModerationSqlTests.cs

All fixture graphs are synthetic additions to the approved existing LocalDB. No fixture reset, database provisioning, migrations, new dependencies, shared-database connections/mutations, hosted configuration changes or User Secrets changes were performed. Purchases and Phase 4 remain prohibited on db75401. Work remains uncommitted for owner review; Phase 5 has not started.
