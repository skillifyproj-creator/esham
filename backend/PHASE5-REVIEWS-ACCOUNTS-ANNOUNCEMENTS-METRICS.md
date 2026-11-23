# Phase 5: reviews, account security, announcements and instructor metrics

Implemented and hardened for the approved isolated development scope, November 23, 2026. Verification and remaining limitations: [PHASE5-VERIFICATION.md](PHASE5-VERIFICATION.md). Phases 1-4 remain at committed baseline 010a3bc; Phase 5 is intentionally uncommitted. Both confirmed independent-audit defects are fixed. No Phase 6 work.

## Scope and schema decisions

- Reuse CourseReview, Enrollment, CourseVersion, EnrollmentVersionAccess, Identity/ApplicationUser, Announcement, Notification and AdminActivityLog. No schema changes, migrations, new entities/tables or packages.
- New reviews require actual Learner membership (including Both), complete onboarding, and an owned active/completed enrollment. Completion is not required. The original approved purchased version and matching access receipt are checked; new reviews pin that original version permanently.
- One current review per enrollment is backed by the existing unique index; SQL retains its 1-5 rating check. Comments are plain text, 25-2000 UTF-16 code units after trimming for the minimum; replies/reasons 1-2000. Unsupported control characters are rejected. Client minimum validation also applies.
- Withdrawal deletes only the current review. Audit records retain prior values and attribution. GeneralAdmin removal requires a reason; instructors cannot remove learner reviews. Removal is not a permanent review ban or a new hidden/approved state. A new explicit request may create another current review; replaying a deleted review's original request cannot resurrect it.
- Existing historical null review attribution is retained. Existing enrollment receipts, completion/certificate history and financial rows are not repaired or retargeted.
- Password change/reset and all-session revocation are implemented. Hard deletion, account deactivation, per-device sessions and email changes remain deferred.
- Recovery delivery is explicitly isolated capture, not email. There is no production provider or HTTP capture/token retrieval endpoint.

## Gates and isolation

Phase5Options is configured from the Phase5 section with default-false ReviewsEnabled, AccountSecurityEnabled, AnnouncementDeliveryEnabled, RecoveryEnabled and PrivateRecoveryCaptureEnabled. ApprovedIsolatedDatabase must equal Esham_AccountTests_Phase1_20261114. AnnouncementIds defaults empty; empty never means full catalog.

Phase5MutationGate reuses the Phase 4 identity verifier: exact integrated-auth (localdb)\MSSQLLocalDB source, exact catalog, actual DB_NAME(), IsLocalDB=1 and the local-machine LOCALDB# instance identity. Options alone do not authorize a write. Every transactional new mutation checks its independent capability inside the transaction as well as before entering it.

No hosted configuration or shared User Secrets were changed. No Phase 5 mutation is enabled on db75401. Existing administrative authoring, announcement publication and notification read operations retain their earlier availability; new delivery and new security/review writes have independent gates.

Isolated tests use 5216/5175, separate process environment and fresh synthetic graphs. Shared 5206/5174 processes are not restarted/configured. Both startup seeding flags and catalog-wide completion recovery stay false. Phase 5 periodic delivery recovery also remains false in the verification runtime; guarded explicit scans test its durable delivery core.

## API contracts

All private responses are no-store. Authenticated writes require the trusted-origin/application-header filter and X-Esham-Account-Id matching the current authenticated account. This header is a session precondition, never an ownership query parameter. Actual Identity memberships are queried again by services.

| Route | Contract |
| --- | --- |
| GET /me/phase5 | accountId and independently enabled review/security/delivery flags |
| GET /me/reviews?page=1&pageSize=20 | accountId, items, page, pageSize, totalCount |
| GET /me/enrollments/{id}/review | accountId, enrollmentId, eligible, reasonCode, mutationsEnabled, review, purchasedCourseVersionId |
| PUT /me/enrollments/{id}/review | requestId, expectedVersion (null for create), expectedCourseVersionId, rating, comment |
| DELETE /me/enrollments/{id}/review | requestId, expectedVersion; withdraw current owned review |
| GET /api/courses/public/{courseId}/reviews?page=1&pageSize=20 | Public items and aggregate rating; no account/enrollment IDs, email or learner names |
| GET /api/instructor/reviews | Existing courseId/page plus rating/replyStatus filters; accountId, items, total, page and server summary |
| PUT /api/instructor/reviews/{reviewId}/reply | requestId, expectedVersion, reply |
| DELETE /api/instructor/reviews/{reviewId}/reply | requestId, expectedVersion; remove reply |
| GET /api/admin/learner-reviews?page=1 | GeneralAdmin-only paginated review directory |
| DELETE /api/admin/enrollments/{enrollmentId}/review | GeneralAdmin-only requestId, expectedVersion and required reason |
| POST /auth/forgot-password | email; generic 202 with deliveryMode=isolated_capture when capture is explicitly enabled; same result for absent/locked account |
| POST /auth/reset-password | token, password; 204, no automatic sign-in |
| POST /me/password | currentPassword, password; 204, stamp invalidation and sign-out |
| POST /me/sessions/revoke-all | currentPassword; 204, stamp invalidation and sign-out |
| GET /me/announcements?page=1&pageSize=20 | accountId, current audience-filtered items and pagination |
| GET /me/announcements/{id} | Same envelope with one authorized item; 404 for unavailable/non-audience item |
| GET /api/instructor/course-metrics?page=1&pageSize=20 | accountId, owned-course items, enrollment/completion/queue counts and ledger-derived earnings |
| GET /api/instructor/performance | Preserve existing contract, add sectionPage and bounded section metadata |

Review mutation success contains accountId, review (nullable after withdrawal or replay of a subsequently removed review) and replayed. Review DTO: id, enrollmentId, courseId, immutable courseVersionId, rating, comment, instructorReply, createdAt, updatedAt, repliedAt, opaque version and optional original course titles.

Errors follow existing ServiceResult/Problem Details: 400 validation, 401 invalid session/confirmation, 403 role/origin/disabled capability, 404 absent/non-owned resource, 409 account/version/request conflict, 429 account-security throttling and 503 unavailable recovery delivery. Role-constrained GUID routes retain normal routing 404 behavior for malformed route identifiers. Account security is limited to ten requests per fifteen minutes per remote IP in the real runtime; deployment proxy/distributed policy remains operational work.

## Review transactions, audit and replay

1. Authenticate/discover the owned target and check the capability.
2. EF execution strategy starts a Serializable SQL transaction.
3. Lock course first, then all participant user rows in ordinal ID order, then enrollment.
4. Reserve the operation audit PK and review enrollment-key ranges with UPDLOCK/HOLDLOCK before testing absence.
5. Recheck membership, session stamp when present, onboarding, ownership, eligibility and expected version.
6. Apply review/reply/withdrawal, immutable audit and notification in the same transaction; save and commit together.

The response concurrency version hashes persisted review fields and timestamps. Update timestamps advance monotonically. A deterministic audit GUID binds request identity to the actor; its stored SHA-256 payload fingerprint also binds action, enrollment and request body. Cross-course/action/payload reuse conflicts. Lost commit acknowledgements are reconciled through the committed audit marker. Replays return canonical current state without reapplying old fields or resetting notice read state.

Audit schema was inspected before reuse: PreviousState/NewState allow 4000 characters each; Details allows 10000; TargetId supports string/GUID identities; CourseId/CourseVersionId are nullable with compatible retained FKs; all columns have Throw after-save behavior. Main events contain bounded attribution/timestamps/rating metadata and a 64-character fingerprint. Separate comment/reply/reason events retain raw values of at most 2000 characters each. No oversized combined JSON body, password, reset token or ledger operation key enters audit. CategoryId is omitted, retaining GeneralAdmin-only access through the existing activity reader. No existing publication/moderation audit rows are rewritten.

Review-created and reply notifications are staged by NotificationWriter inside the caller transaction. Existing Phase 3 assessment and Phase 4 completion/certificate transactions are unchanged. Public review eligibility reuses EducationalCategories.Visible and existing approved active publication conditions. Catalog and detail rating aggregates now both use persisted current review rows.

## Account-security behavior

AccountSecurityService uses UserManager/SignInManager and the existing scoped EF store. New passwords require 8-256 characters with a letter and digit, preserving the registration rule even though Identity's case requirements are optional in Program. Existing current-password confirmation is not newly length-restricted. Password changes and all-session revocation lock the account row inside an execution-strategy Serializable transaction and validate the original ticket stamp under that lock. Failed confirmation counters deliberately commit, preserving lockout behavior. Identity password/stamp writes roll back together on an exception. Malformed protected-token formats return validation errors rather than server exceptions.

Password resets use a purpose-bound, protected, thirty-minute envelope around the account ID and Identity reset token. The Identity stamp makes successful reset tokens single-use. Locked accounts are not unlocked by recovery. Reset does not create a login cookie. Sensitive requests/values are never logged. Anonymous recovery outcomes do not distinguish absent or locked users from known users; a configured capture adapter is required. No constant-time or distributed abuse-resistance claim is made.

Capture defaults to private process memory. The isolated runtime can additionally export into the exact non-served artifacts/phase5-isolated/recovery directory; Program rejects another path or non-Development file capture. The test setup restricts the directory ACL to the current Windows user and SYSTEM. File export occurs only after the isolated account-security gate succeeds. Captures expire logically after thirty minutes; ignored files are private test artifacts and are not automatically purged. No real email is sent or claimed by the frontend. External email delivery requires separately approved provider integration/configuration.

Existing profile finalization rejects a stale incoming ticket stamp after acquiring its user lock. After commit it refuses to refresh using a newer credential-revocation stamp. Profile/category saves now use the existing one-request transactional PATCH /me contract with GUID sets; the frontend no longer chains separate category replacements before profile save. Profile/persona writes now also use the established origin/account preconditions.

The account client serializes explicit cookie-changing requests within its module. Profile/persona writes require a caller-supplied verified account precondition; localStorage cannot supply it. Onboarding checks the draft belongs to that session and discards switched-account success responses. AccountSessionContext also exposes a live identity epoch: invalidation or a different verified account advances it, while same-account refresh does not. Superseded refreshes reject instead of returning obsolete profiles. AccountPage captures account ID, epoch and view generation, checks them after every await, and verifies returned profile IDs before applying state. Error-recovery refreshes, persona changes, password/revoke continuations and finally blocks use the same checks. The editable profile is never merged from another cached profile. Password/photo state clears per identity epoch; profile photo work is disposed on identity changes. Fixed expiry, zero-interval stamp validation, lockout checks and suppressed passive renewal remain intact. Recovery tokens are held in memory and removed from the browser URL; the reset page sets no-referrer metadata.

HTTP cookie delivery is not atomic with SQL. A lost credential-change response may require reauthentication/recovery; the server never restores an old password/stamp to manufacture a successful retry. Overlapping explicit actions across uncontrolled tabs/clients and delayed cookie deletion remain limitations; this is not a per-device session registry.

## Announcements and notification delivery

AnnouncementService authoring/publication policies remain unchanged. One compatible integration safeguard makes PublishedAt strictly monotonic on republish, so repeated/backward host-clock values cannot reuse a notification generation. Authenticated feed/detail reads use actual current role memberships, including Both. Existing anonymous /api/announcements behavior remains intact.

Hardening aligns authoring with delivery: discovery/initial authorization occurs outside the Serializable transaction; an existing announcement is locked first, then its author user, then actual authorization is rechecked before applying a change. New announcements lock their author before inserting their fresh identity. Delivery uses announcement then sorted recipient users; account-security operations use only their user lock. The controlled three-party SQL test observes the intended wait chain and asserts no diagnostic SQL errors. This does not identify the cause of a prior unrelated course-lock timeout.

AnnouncementDeliveryService only considers the explicit AnnouncementIds allowlist (maximum 100). Optional AnnouncementRecipientIds further bounds isolated fixtures; otherwise recipients are scanned in persisted keyset pages of 50. A recipient still must satisfy actual current membership and unlocked-account checks. Each batch locks announcement first, then recipient users in ordinal order, then stable notification key ranges, within one retry-aware transaction. A batch failure rolls back all its notice inserts; later batches can continue and later scans reconsider failures.

Event identity incorporates announcement ID, UTC publication ticks and recipient ID. Both-role recipients get one notice for each matching publication generation. Replays preserve CreatedAt/IsRead/ReadAt. Notifications freeze the generation's title and a bounded bilingual summary; full 10000-character announcement bodies remain in the authenticated feed. Unpublishing stops pending delivery, and republish uses a different timestamp/generation. Notification navigation goes to the current authorized feed, not an invented historical body snapshot.

Recovery derives work from persisted publication and recipient rows, not process memory or an in-memory publication signal. There is no implicit historical backfill. Empty selected IDs produce no delivery and disabled/empty-worker tests prove no DB scope resolution. Full publication-time recipient snapshots are not supported by this schema; approved semantics are current membership at delivery. The core is tested across pagination, poison rollback, retries, concurrent workers and separate-process restart.

## Instructor metrics and frontend integration

InstructorMetricsProjection replaces unbounded loading of enrollment/progress graphs with grouped SQL counts/sums and bounded section pages. The existing dashboard/performance shape is preserved with accountId, capturedAt, periodSemantics and section pagination metadata. Enrollment figures are cohorts; reviews and ledger use their event time. Six monthly chart buckets are calculated with grouped SQL. Historical completion markers remain counted, with an additional ambiguous-history count; no historical repairs are performed.

Teaching earnings use long persisted teaching-transaction sums, never enrollment count times twenty. Course metrics are owner-filtered and paginated. Assessment count filters align with submitted approved same-course work. Section coverage deduplicates logical lesson achievements and preserves completed-enrollment history semantics; it is reporting, never a completion/eligibility writer. Watch hours and unsupported growth remain unavailable. Multiple metric queries/widgets are independent captured projections, not a promised global SQL snapshot.

Instructor course cards now show real enrollment counts; unsupported draft-authoring progress is displayed as unavailable instead of a fabricated zero. Existing paginated ledger-based teaching totals are retained. Feedback filters/summaries/distribution are server-wide for the selected filter; CSV export is explicitly the current page and preserves spreadsheet-formula escaping. Static translated review/reply substitution is removed. New reply and GeneralAdmin removal forms retain account/session guards.

Learner reviews no longer import demo courses or use localStorage as authority. Existing unverified local records are not uploaded or positionally mapped to GUIDs. Review list/forms, public reviews, notifications, authenticated announcements, account settings and instructor pages use real server responses with loading/error states and bilingual RTL/LTR layouts. No destructive account API is offered; the deletion dialog explicitly states retention/unavailability.

Saved Reviews editing obtains its write precondition from the owned review-read response's PurchasedCourseVersionId. It never interprets a legacy review's nullable CourseVersionId as the purchased receipt. The service continues to preserve that historical null attribution in both review and audit rows. This additive DTO field requires no schema change; API and real browser edit/withdraw tests cover it.

## Verification boundary

See the verification report for exact final counts and commands. Real relational tests use only the existing approved LocalDB and per-DML identity guards. No provisioning, migrations, schema/backfill actions, startup seeders, shared record/account operations, commits/pushes or Phase 6 work. Future hosted enablement, real email, device-session management, account lifecycle, richer review moderation/history and schema/index changes require separate decisions.

## Exact source manifest

Modified (33):

- `README.md`
- `backend/esham.BLL/Services/AccountService.cs`
- `backend/esham.BLL/Services/AnnouncementService.cs`
- `backend/esham.BLL/Services/CourseService.cs`
- `backend/esham.BLL/Services/InstructorInsightsService.cs`
- `backend/esham.BLL/Services/NotificationService.cs`
- `backend/esham.PL/Endpoints/AccountEndpoints.cs`
- `backend/esham.PL/Endpoints/InstructorInsightsEndpoints.cs`
- `backend/esham.PL/Program.cs`
- `backend/esham.Tests/Phase2IsolatedEnvironmentTests.cs`
- `backend/esham.Tests/Phase3IsolatedEnvironmentTests.cs`
- `backend/esham.Tests/Phase4HardeningSqlTests.cs`
- `backend/esham.Tests/Phase4IsolatedEnvironmentTests.cs`
- `backend/esham.Tests/SessionRenewalTests.cs`
- `frontend/package.json`
- `frontend/src/App.jsx`
- `frontend/src/components/admin/AnnouncementsPanel.jsx`
- `frontend/src/context/AccountSessionContext.jsx`
- `frontend/src/hooks/useInstructorInsights.js`
- `frontend/src/hooks/useLearnerReviews.js`
- `frontend/src/pages/CourseDetailsPage.jsx`
- `frontend/src/pages/auth/ForgotPasswordPage.jsx`
- `frontend/src/pages/auth/OnboardingPage.jsx`
- `frontend/src/pages/auth/ResetPasswordPage.jsx`
- `frontend/src/pages/instructor/InstructorCoursesPage.jsx`
- `frontend/src/pages/instructor/InstructorDashboard.jsx`
- `frontend/src/pages/instructor/InstructorFeedbackPage.jsx`
- `frontend/src/pages/instructor/InstructorPerformancePage.jsx`
- `frontend/src/pages/instructor/InstructorSubmissionsPage.jsx`
- `frontend/src/pages/learner/LearnerReviewsPage.jsx`
- `frontend/src/pages/shared/AccountPage.jsx`
- `frontend/src/services/accountApi.js`
- `frontend/src/services/notifications.js`

New (31):

- `backend/PHASE5-REVIEWS-ACCOUNTS-ANNOUNCEMENTS-METRICS.md`
- `backend/PHASE5-VERIFICATION.md`
- `backend/esham.BLL/DTOs/Reviews/ReviewDtos.cs`
- `backend/esham.BLL/Services/AccountSecurityService.cs`
- `backend/esham.BLL/Services/AnnouncementDeliveryService.cs`
- `backend/esham.BLL/Services/InstructorMetricsProjection.cs`
- `backend/esham.BLL/Services/LearnerReviewService.cs`
- `backend/esham.BLL/Services/Phase5MutationGate.cs`
- `backend/esham.PL/Endpoints/AccountSecurityEndpoints.cs`
- `backend/esham.PL/Endpoints/AnnouncementFeedEndpoints.cs`
- `backend/esham.PL/Endpoints/LearnerReviewEndpoints.cs`
- `backend/esham.PL/Services/AnnouncementDeliveryRecoveryService.cs`
- `backend/esham.Tests/Phase5ApiTests.cs`
- `backend/esham.Tests/Phase5HardeningSqlTests.cs`
- `backend/esham.Tests/Phase5IsolatedEnvironmentTests.cs`
- `backend/esham.Tests/Phase5RecoveryChildTests.cs`
- `backend/esham.Tests/Phase5RecoveryDisabledTests.cs`
- `backend/esham.Tests/Phase5SessionTests.cs`
- `backend/esham.Tests/Phase5SqlTests.cs`
- `backend/esham.Tests/Phase5Tests.cs`
- `frontend/scripts/verify-phase5-hardening.cjs`
- `frontend/scripts/verify-phase5-private-files.cjs`
- `frontend/scripts/verify-phase5.cjs`
- `frontend/src/components/PublicCourseReviews.jsx`
- `frontend/src/components/instructor/ReviewReplyForm.jsx`
- `frontend/src/hooks/useInstructorCourseMetrics.js`
- `frontend/src/pages/admin/LearnerReviewModerationPage.jsx`
- `frontend/src/pages/shared/AnnouncementsFeedPage.jsx`
- `frontend/src/services/accountOperations.js`
- `frontend/src/services/learnerReviewsApi.js`
- `frontend/tests/phase5.test.mjs`
