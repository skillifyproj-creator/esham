# Phase 6A - graduation readiness hardening

Handoff: November 24, 2026. Branch feature/learner-phases-1-3; baseline HEAD efcced57d940f364e61bce33585ad56dcab9bfed unchanged. Commit/push remain on hold.

**The initially audited findings and subsequently approved creation/category authorization findings are corrected and verified.** The safe-suite failures were test harness issues and are resolved. Graduation readiness remains conditional on independent final audit; production readiness is not established.

## Fatima review required before merging into main

Fatima must review all eight changed paths before any merge into main: CurriculumService.InDraft; CourseReviewService.SubmitAsync, ReviseAsync, DecideAsync; CourseService.UpdateDraftAsync, CreateAsync; CategoryService mutations; and UserCategoryService.ReplaceCurrentAsync.

| Path | Exact security change | Preserved behavior |
| --- | --- | --- |
| CurriculumService.InDraft | Existing course U/HOLD lock, then actor user U/HOLD lock and actual Instructor/lockout validation before draft/children | Original Serializable/retry handling, ownership, editable-draft rules and curriculum/media delegates |
| CourseReviewService.SubmitAsync | Change helper validates the supplied mutation actor under course -> actor-user locks; current Instructor membership/lockout before loading draft | Expected version, content-change checks, eligibility, pending transition and transactional audit |
| CourseService.UpdateDraftAsync | Replace root+draft shared read with course UPDLOCK/HOLDLOCK; owner check; actor user UPDLOCK/HOLDLOCK; current Instructor/lockout; then draft read | Existing patch semantics, editable-state/reference validation, Serializable/retry/save/commit |
| CourseReviewService.ReviseAsync | Pass actor into the same guarded Change helper, requiring actual Instructor membership and unlocked owner | Decided-source/version rules, retained logical identities, complete snapshot cloning, pointer advance and audit |
| CourseReviewService.DecideAsync | Pass actor and required CATEGORYADMIN role into Change; lock/revalidate reviewer before draft/children; existing assignment/self-review checks remain inside transaction | CategoryAdmin-only decision authority; GeneralAdmin oversight; feedback/state/readiness/safety, publication receipts and notifications |
| CourseService.CreateAsync | Transaction-owned creation serialization and generated-ID range probe, then actor U/HOLD lock and persisted Instructor/lockout check before reference validation/inserts | Existing creation validation, stable retry IDs, draft-only publication state |
| CategoryService Create/Update/ChangeStatus | Actor propagated by endpoint/interface; category-tree serialization, actor U/HOLD and current GeneralAdmin/lockout check before mutations | Existing category permissions, hierarchy and response rules |
| UserCategoryService.ReplaceCurrentAsync | Owner U/HOLD lock then lockout and kind-specific persisted membership check before selection replacement | Existing Learner/Instructor policy and atomic replacement |

 Existing-course authoring retains course -> actor locking. Creation has no existing course row; its transaction gate and generated-ID probe precede actor locking. Category writes serialize the tree before actor locking. User category writes lock only the owner row. Role and assignment decisions remain transactional. Existing rollback/retry boundaries and business policies remain; no timeout/isolation weakening or suppression was added.

Positive/negative SQL cases now prove revoked or locked actors cannot change metadata, clone revisions, approve, reject, request changes or publish. Foreign owners/self-review, removed assignment, absent actual role, stale versions and invalid states are rejected with unchanged persisted course/version/audit/notification snapshots. Valid operations and concurrent same-course writes retain existing contracts. A separate shared-actor test combines metadata, curriculum, revision, publication and learner progress without SQL errors or financial/receipt changes.

## AI gateway cancellation

ai/src/gateway.mjs now creates a per-request cancellation controller before asynchronous preflight. Both response close and request abort cancel it and destroy an existing upstream. Authentication receives a composed cancellation/timeout signal. The handler checks cancellation after authentication and after catalog loading/body projection, immediately before upstream creation. Listeners are removed in finally.

The shared catalog loader deliberately receives no individual caller cancellation signal. A cancelled caller cannot cancel another caller's refresh. Existing upstream/provider signal propagation remains. Forwarded work cannot promise reversal of processing or charges already performed by an external provider.

Seven deterministic synthetic-provider tests count both Node upstream creations and provider calls: authentication wait, catalog wait, immediate forwarding boundary, document/image requests, post-forward cancellation and shared refresh. Early cancellation asserts zero forwarding. No paid provider requests were made.

## Recommendation freshness

frontend/src/services/recommendationSelections.js supplies a canonical revision of the complete trusted public projection, including version, ownership, categories, level, text, status, rating and nested fields. Canonical key/ID ordering and useMemo avoid loops for equivalent responses.

CourseRecommendations includes that revision, current course and actual roles in its account/session signature. A current-signature ref rejects asynchronous continuations before passive cleanup can run. State stores course IDs/reasons instead of old course objects; rendering resolves current catalog objects and filters current authorship/publication eligibility. Existing exclusions, GUID authority, fallback and account switching remain.

Seven browser contract cases amend only synthetic public API responses: same-GUID metadata/version update, changed category, changed ownership, held stale response, publication-feed removal, current-object rendering and identical-response no-loop behavior. These are client projection tests, not claims that backend records were mutated by the test. Existing19 real-backend/synthetic-provider Phase6A browser checks also pass.

## Authorization coverage matrix — systematic read-only review

U=UPDLOCK/HOLDLOCK; S=transactional shared reads retained by Serializable isolation. Rows distinguish verified guards from inspected guarantees and unresolved risks. No blanket proof of deadlock freedom is claimed.

| Service/path | Required authority / scope | Lock/read sequence | Current authorization before mutation | Evidence / disposition |
| --- | --- | --- | --- | --- |
| CourseService.CreateAsync | Instructor; server-owned new course | Serializable -> transaction-owned creation gate -> generated-ID UPDLOCK/HOLDLOCK probe -> actor user UPDLOCK/HOLDLOCK -> current membership/lockout -> references and inserts | YES, persisted Instructor and lockout revalidated after actor lock | Round3 SQL authorization matrix, blocked-wait revocation tests, mixed creation/tree/authoring and authorized/negative API browser checks |
| CourseService.UpdateDraftAsync | Instructor; owned editable draft | Course U -> actor U -> role -> draft/references | YES current role/lockout; root ownership stable; draft rules retained | Round2 SQL metadata matrix and mixed authoring |
| Curriculum: EnsureDefaultSection, SaveSection, DeleteSection, SaveLesson, DeleteLesson, Reorder | Instructor; own editable current draft | Shared InDraft: course U -> actor U -> role -> children | YES on write delegate entry | Original section/cover SQL matrix + all safe curriculum rules |
| CourseTaskService.Save/Delete/Reorder | Instructor; own draft/task/section | Same InDraft guard | YES via shared write guard | Guard inspection and existing task regressions |
| CourseCoverService.Upload | Instructor; own current draft/asset | Stream before SQL; then InDraft course U -> actor U | YES before DB association; rejected unused streamed file cleanup retained | Original SQL cover races; stream bytes are not a publication grant |
| LessonMediaService.UploadVideo/Delete | Instructor; own draft lesson/media lineage | Stream where applicable -> InDraft course U -> actor U -> lesson/asset | YES before persisted media mutation | Shared guard inspection and media regressions |
| CourseReviewService.SubmitAsync | Current Instructor owner; eligible expected draft | Course U -> actor U -> membership -> draft/eligibility | YES | Original6 submission cases + browser owned submission |
| CourseReviewService.ReviseAsync | Current Instructor owner; expected decided source | Course U -> actor U -> membership -> source/children | YES | Round2 revision matrix |
| CourseReviewService.DecideAsync, all decisions | Current CategoryAdmin, assigned category, nonowner, expected pending version | Course U -> reviewer U -> role -> version/assignment/eligibility | YES; assignment read held transactionally | Round2 decision matrix including removal and lockout, browser publication |
| CourseVersionUpdates.StagePublication/StageEnrollment | Internal caller owns business transaction and eligible locked course | Reentrant lock of already-held course -> version/access/enrollment children | Validates publication/version state; initiating actor authorized by caller | Existing publication/purchase SQL races; no independent public mutation endpoint |
| CourseSafetyService.FileReport/ResolveReport/Warn/Suspend/Appeal/DecideAppeal | Actual allowed membership, ownership or independent moderator/current assignment | Actual user/role S inside Serializable -> course U -> operation scope | Persisted authority read and protected inside transaction; no captured client role | Inspected; existing moderation SQL tests. User-before-course S ordering remains a separate contention-review concern, not a reproduced new deadlock |
| CategoryService.Create/Update/ChangeStatus, CategoryEndpoints | GeneralAdmin | Actor passed by endpoint -> Serializable -> category-tree transaction gate -> actor user UPDLOCK/HOLDLOCK -> persisted membership/lockout -> category/tree mutation | YES, current GeneralAdmin and lockout revalidated under actor lock | Round3 SQL matrix and blocked-wait revocation tests; concurrent tree/authoring test and API CRUD/role browser checks |
| AdminIntegrationService.SetAssignments | Current GeneralAdmin; existing CategoryAdmin recipients and version | Actual actor/role S in Serializable -> category U -> assignments/eligible memberships | YES held transactional reads; expected assignment version | Inspected and existing admin SQL tests; unchanged |
| CategoryAdminProvisioningService.Create | Current GeneralAdmin; active selected categories | Rechecks actual Access inside Serializable -> ordered category reads -> new account/membership/assignments | YES transactional role/lockout read; no existing-user promotion | Inspected and existing provisioning regressions; no provisioning command executed |
| AdminUserService.UpdateRoles/UpdateLockout | Current GeneralAdmin; expected target version; last-admin policy | GeneralAdmin role U -> distinct actor/target user U in ordinal order -> reauthorize | YES after waiting | Existing role/lockout SQL tests; unchanged |
| AnnouncementService.Save/SetStatus | Current GeneralAdmin | Existing announcement U -> actor U -> actual access recheck | YES after waits; publication generation rules preserved | Existing forced3-party SQL tests; unchanged |
| AnnouncementDeliveryService.Deliver/Recover | Internal isolated capability + explicit announcement/recipient rollout | Announcement U -> recipient users U in ordinal order -> notifications | Actual recipient membership/lockout at delivery | Existing generation/replay/audience SQL/browser tests; worker default disabled |
| InstructorInsightsService.Review | Current Instructor owner; valid submission/enrollment/version | Course U -> ordered actor/learner U -> enrollment/submission -> actual access | YES after locks | Existing assessment SQL/mixed/browser tests; unchanged |
| LearnerReviewService instructor reply / GeneralAdmin removal | Actual Instructor owner or GeneralAdmin, expected review version | Course U -> ordered users U -> enrollment/review/operation | YES transactional access and ownership | Phase5 SQL/browser regressions; unchanged |
| CertificateService.RevokeAsync | Current GeneralAdmin plus isolated completion gate | Course U -> actor U -> enrollment -> access recheck | YES after waits | Existing Phase4 safety/regressions; unchanged/gated |
| Account/profile/persona/categories, security changes | Authenticated owner and actual relevant membership; account-security gate where applicable | User U (no course root is involved) -> memberships/profile/related state | Existing current identity/stamp/role checks | Safe and Phase1–5 SQL/account-switch regressions; unchanged |
| Notifications read-state | Authenticated recipient ownership | Existing user/notification ownership checks | No privileged-role grant; account-bound ownership retained | Existing SQL/browser tests; unchanged |
| Private authoring/media/review reads | Owner/current request memberships and assignment rules | Request/read authorization; no mutation delegate | In-flight stream/read revocation policy not redesigned | Read-only paths, not claimed transactionally cancellable after revocation |
| DevelopmentIdentityRoles commands | Explicit trusted development operator/DB credentials | Existing command path, not web actor authorization | Not an HTTP authoring permission boundary | Not executed against shared data; role helper reused only by guarded synthetic fixtures |

## Finding disposition and unproven contention risk


Pre-fix course creation/category writes and user-category lockout gaps were confirmed in the approved isolated SQL regressions; each was corrected and the post-fix cases passed. No additional authorization defect was confirmed in the reviewed matrix. CourseSafetyService reads current authority within Serializable before its course lock. Its S-before-course sequence remains an unproven contention risk: no deadlock or stale-authorization exploit was established and no fix is inferred.

## Verification, boundaries and readiness

See PHASE6A-VERIFICATION.md for before/after evidence, exact final counts and overlap. Runtime verification used only existing Esham_AccountTests_Phase1_20261114 on (localdb)\MSSQLLocalDB, actual DB_NAME/IsLocalDB/local server checks and per-DML guards. No db75401 access, schema/provision/reset, new dependency/runtime, shared User Secrets edit, production enablement or paid AI request. All gate defaults, startup seeding defaults and recovery rollout remain disabled. Shared5206/5174 settings/processes were untouched.

Graduation readiness remains conditional on independent final audit. Production readiness remains unestablished: historical SQL command-lock/pre-login timeouts and the unexplained slow completion run are unresolved; live provider quality/delivery, external dataset installation, hosting, recovery email, background recovery and operational/runtime-support decisions remain separate. No commit, push, merge or Phase6B work.

## Exact changed/untracked manifest

Current git status contains **61 paths** (modified or untracked), including this report.

- ai/DEPLOYMENT.md
- ai/README.md
- ai/src/assistant-server.mjs
- ai/src/catalog.mjs
- ai/src/gateway.mjs
- ai/src/guest-help.mjs
- ai/src/knowledge.mjs
- ai/tests/catalog.test.mjs
- ai/tests/gateway-cancellation.test.mjs
- ai/tests/gateway.test.mjs
- backend/esham.BLL/Interfaces/ICategoryService.cs
- backend/esham.BLL/Services/CategoryService.cs
- backend/esham.BLL/Services/CourseReviewService.cs
- backend/esham.BLL/Services/CourseService.cs
- backend/esham.BLL/Services/CreationMutationAuthorization.cs
- backend/esham.BLL/Services/CurriculumService.cs
- backend/esham.BLL/Services/UserCategoryService.cs
- backend/esham.PL/Development/StartupSeedingPolicy.cs
- backend/esham.PL/Endpoints/AccountEndpoints.cs
- backend/esham.PL/Endpoints/CategoryEndpoints.cs
- backend/esham.PL/Program.cs
- backend/esham.Tests/AccountFinalizationSqlServerTests.cs
- backend/esham.Tests/AccountFinalizationTests.cs
- backend/esham.Tests/ContentApiServiceTests.cs
- backend/esham.Tests/CourseCoverServiceTests.cs
- backend/esham.Tests/CourseResubmissionTests.cs
- backend/esham.Tests/CourseReviewWorkflowTests.cs
- backend/esham.Tests/CourseTaskServiceTests.cs
- backend/esham.Tests/CurriculumIdentityFixture.cs
- backend/esham.Tests/CurriculumServiceTests.cs
- backend/esham.Tests/DraftContentReadinessTests.cs
- backend/esham.Tests/LessonMediaServiceTests.cs
- backend/esham.Tests/Phase5SessionTests.cs
- backend/esham.Tests/Phase6AAuthorizationRaceSqlTests.cs
- backend/esham.Tests/Phase6ACreationAuthorizationSqlTests.cs
- backend/esham.Tests/Phase6ADiagnosticsSqlTests.cs
- backend/esham.Tests/Phase6AExpandedAuthorizationSqlTests.cs
- backend/esham.Tests/Phase6AIsolatedEnvironmentTests.cs
- backend/esham.Tests/Phase6ASecurityTests.cs
- backend/esham.Tests/Phase6ASqlDiagnostics.cs
- backend/esham.Tests/SessionRenewalTests.cs
- backend/PHASE6A-GRADUATION-READINESS.md
- backend/PHASE6A-VERIFICATION.md
- backend/README.md
- frontend/package.json
- frontend/README.md
- frontend/scripts/verify-onboarding-roles.cjs
- frontend/scripts/verify-phase5.cjs
- frontend/scripts/verify-phase6a-creation.cjs
- frontend/scripts/verify-phase6a-freshness.cjs
- frontend/scripts/verify-phase6a.cjs
- frontend/scripts/verify-session-renewal.cjs
- frontend/src/components/chatbot/EshamChatbot.jsx
- frontend/src/components/learner/CourseRecommendations.jsx
- frontend/src/pages/learner/LearnerEnrollmentPage.jsx
- frontend/src/services/assistantScope.js
- frontend/src/services/learningAssistant.js
- frontend/src/services/recommendationSelections.js
- frontend/tests/phase6a.test.mjs
- frontend/vite.config.js
- README.md

## Round3 authorization implementation record (November 24, 2026)

Completed methods: CourseService.CreateAsync (Instructor) and CategoryService.CreateAsync/UpdateAsync/ChangeStatusAsync (GeneralAdmin only). Category routes remain POST /api/categories, PUT /api/categories/{id:guid}, PATCH /api/categories/{id:guid}/status; reads are unchanged. The authenticated actor now flows from CategoryEndpoints through ICategoryService to CategoryService. Course and category writes validate actual persisted role and lockout under transaction locks before data mutation.

Category save/status retain Serializable hierarchy semantics behind a transaction-owned tree serialization gate, then lock and revalidate the actor before category reads/writes. Course creation has no pre-existing course root: its transaction gate reserves the generated-ID probe before the actor lock, then validates role/lockout and existing category/media references before inserts.

Verification: the 20-case initial matrix reproduced 12 failures and 8 passes for course/category captured-actor revocation, lockout and role removal. The final matrix passed, and separate tests forced SQL lock waits before committing role revocation/lockout. A mixed workload covered course creation, category creation/update/status, existing draft metadata and curriculum writes, plus opposing reparent attempts; it reported no SQL errors and retained tree invariants. API browser checks passed authorized course/category writes and role-denial cases. Exact evidence and limitations are in PHASE6A-VERIFICATION.md. Fatima review of all eight listed paths remains required before merge to main.

## Safe-suite follow-up (November 24, 2026)

Both recorded safe-backend failures were confirmed to be test harness issues. The onboarding failure was a denied write to the user's default Data Protection key directory during cookie issuance; the test-only service provider now uses an ephemeral key provider, with production settings untouched. The category/course fixture failure was a detached seeded graph reattached after the service's retry-safe ChangeTracker.Clear; it now mutates the tracked row. The affected rerun passed7/7 and the full safe backend suite passed442, failed0, skipped135. See PHASE6A-VERIFICATION.md for stack summary and skip categories. Neither change alters business behavior.

## Safe-suite follow-up (November 24, 2026)

The Data Protection failure was a denied write to the runner's default Windows key directory; the test-only service provider now uses ephemeral keys and production host configuration is unchanged. The tracking failure originated in the test fixture reattaching a stale category graph after the service cleared/reloaded tracking; the fixture now changes the tracked row. The affected filter passed 7/7; the complete safe backend suite passed 442, failed 0, skipped 135. Skip names and evidence limits are enumerated in PHASE6A-VERIFICATION.md.
