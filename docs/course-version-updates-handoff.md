> Public technical handoff. Operational identities, recovery evidence and database-specific scripts are intentionally kept outside version control. Verification counts below are historical snapshots; see README for current startup and regression commands.

# Course version updates — Fatima / Mais handoff

Date: November 5, 2026. Deadline: November 13, 2026.

**Status: shared infrastructure implemented and tested; the existing migration was applied and verified by the database coordinator. Complete learner write workflows and learner UI integration remain separate responsibilities.**

## 1. Approved business rules

1. A newly approved and published version becomes available to existing eligible enrollments automatically.
2. Every affected learner receives one persisted update notification.
3. The existing enrollment and its original CourseVersionId remain unchanged.
4. No new enrollment charge or instructor credit occurs; the existing 20/20/20 rules remain unchanged.
5. Completed logical lessons stay completed, including after content/media edits.
6. Approved logical tasks stay approved, including after changed instructions or assessment requirements.
7. Learners are not forced to repeat earned content.
8. Added lessons/tasks start incomplete for ongoing learners.
9. Completed courses keep their status, completion date and existing certificate; new content is optional.
10. Revisit and new optional attempts are allowed by policy without overwriting previous achievements.
11. Edits alone do not reset progress/completion.
12. Update notifications are committed only with successful publication, never draft edits, submission or rejection.
13. Old published snapshots, attempts, assessments and achievement attribution remain intact.
14. Course updates never charge another 20 points.

Only enrollment statuses `active` and `completed` are eligible. Unknown/canceled/cancelled/refunded/suspended statuses fail closed. EnrollmentPaused blocks **new** enrollment staging, not existing eligible learners' version access.

## 2. Previous architecture and changes

Existing Course has DraftVersionId and PublishedVersionId; CourseVersion owns sections, lessons and tasks. The real CourseReviewService already authorized assigned CategoryAdmins, validated eligibility, serialized writes using the course lock, approved a specific snapshot and advanced publication.

Enrollment already pins CourseVersionId; progress references concrete lesson IDs, attempts reference concrete task IDs, and certificates/reviews reference enrollment. The learner enrollment/progress/submission/certificate services are still missing in this checkout. Existing learner pages largely use local preview data, while the public catalog and notification inbox use real APIs.

This change:
- Preserves all existing IDs and original enrollment attribution.
- Adds stable logical lesson/task identity carried by future clones.
- Adds append-only availability receipts per enrollment/version.
- Hooks successful approval into transactional receipts and persisted notifications.
- Adds a read-only authenticated version-state projection and a small frontend contract adapter.
- Adds explicit nullable certificate/review version attribution and optional-attempt-at-creation attribution.
- Does not replace completed course/Identity/category/notification functionality or rebuild learner pages.

## 3. Schema additions

| Object | Addition / meaning |
| --- | --- |
| Lessons | LogicalLessonId, non-null GUID; immutable after insertion through EF |
| CourseTasks | LogicalTaskId, non-null GUID; immutable after insertion through EF |
| EnrollmentVersionAccess | New append-only table: Id, EnrollmentId, CourseId, CourseVersionId, PreviousCourseVersionId, GrantedAt, Reason, WasCourseCompleted |
| Certificates | Nullable CourseVersionId for explicit earned-version attribution |
| CourseReviews | Nullable CourseVersionId for explicit review-version attribution |
| TaskSubmissions | Nullable IsOptionalAtCreation; future services set true/false when creating the draft; null means unknown legacy mode |
| Enrollments | No new version column. Original CourseVersionId is retained and made immutable through EF; alternate key (Id, CourseId) supports ownership-safe receipt FKs |

Receipt uniqueness is (EnrollmentId, CourseVersionId). Composite FKs ensure the enrollment and referenced version belong to the same course, including the previous version reference. Additional lookup/lineage indexes are additive.

Current availability is the approved Course.PublishedVersionId **with a receipt for that enrollment**. There is no second mutable enrollment version pointer to drift out of sync.

Progress remains attributed through Lesson → CourseSection → CourseVersion. Attempts/assessments remain attributed through CourseTask → CourseVersion. No duplicate progress/submission entity was introduced.

EF also forbids retargeting existing progress/attempt enrollment/content IDs, changing attempt numbers or optional-at-creation mode, and retargeting existing certificate/review enrollment/version attribution. These are application persistence guards; they do not replace authorization or database permissions.

## 4. Migration and application status

Migration: `20261105182722_AddCourseVersionUpdates`.

Artifacts:
- `backend/esham.DAL/Data/Migrations/20261105182722_AddCourseVersionUpdates.cs`
- Corresponding Designer and updated AppDbContextModelSnapshot

**Application status:** the database coordinator confirmed the existing migration was applied and verified. Target identities, recovery evidence and execution reports are private operational records.

The forward migration adds columns/table/indexes/FKs. It does not drop or recreate existing tables, change Identity, delete data, rewrite enrollment versions, mutate ledger entries or issue notifications.

Backfill:
- Each existing lesson/task uses its own existing ID as its initial logical ID.
- Identical titles/order/media in different historical versions are **not** treated as proof of shared identity.
- Eligible existing enrollments receive baseline receipts for their original version and currently available approved publication, if different and visible.
- Baseline receipts do not reconstruct all intermediate publications and generate no notifications.
- PreviousCourseVersionId on a baseline receipt identifies its known original reference, not a claimed immediate historical publication transition.
- Existing certificate/review version attribution and attempt optionality remain null when unknown. No earned version/mode is guessed.

A populated legacy SQL test verified these backfills while preserving enrollment versions, completion date, progress, old answers, certificates and reviews.

### Coordinator deployment sequence — requires explicit approval

1. Recheck migration history/schema and take the normal shared database backup.
2. Pause writers/coordinate deployment with Mais. An old cloning binary cannot propagate the new lineage fields.
3. Generate and review forward SQL from the existing EF migration, including backfills and indexes, for the authorized target.
4. Apply it through the coordinator's authorized database connection, not automatically from app startup.
5. Deploy/restart the new backend, then verify the version-state endpoint and review flow.
6. Resume writers.

The design-time factory deliberately builds an offline model and never runs application startup/seeders or loads hosted secrets. Its placeholder connection is **not** the deployment connection. The migration was generated with temporary EF Core 9.0.21 tooling matching the project.

Do not apply a down migration after use without an explicit data-retention/recovery plan: generated rollback removes the newly added metadata/history.

Development startup and schema compatibility were subsequently verified. Historical test counts below describe their recorded verification run, not a new run during documentation cleanup.

## 5. Content lineage

- New lesson/task creation generates a fresh logical GUID.
- ReviseAsync copies LogicalLessonId/LogicalTaskId while generating new physical section/lesson/task IDs.
- Editing retains logical identity, even for substantial edits; inherited credit is intentionally retained under the approved policy.
- Deleting/replacing through delete + create produces new logical identity. Old snapshots/proofs stay intact.
- Multi-version cloning carries the same logical GUID across V1 → V2 → V3 and beyond.
- Client write DTOs do not accept logical IDs; identity cannot be selected through a normal instructor edit request.
- Tasks are unique per version/logical ID. Lessons have section/logical uniqueness and publication/projection additionally reject duplicate logical lessons across sections of one version.
- Empty/ambiguous lineage fails closed.
- Media identity/content fingerprints are used only to identify displayed updates, never to infer lineage or decide whether previous credit survives.

Historical clones without authoritative mapping remain separate roots. Any later reconciliation requires explicit evidence and coordinator review; do not mass-match titles or positions.

## 6. Version transition integration

CourseReviewService.DecideAsync calls CourseVersionUpdates.StagePublicationAsync only in its successful approved branch, inside the existing serializable course-lock transaction.

The transaction commits:
- the approved version and publication pointer,
- immutable review decision and existing admin audit entry,
- availability receipts for eligible enrollments,
- deduplicated notifications.

It does not change Enrollment.CourseVersionId, enrollment status/dates, progress rows, attempts, assessments, certificates, wallets or points.

Previous publication remains an immutable approved snapshot. Publication receipts record the actual previous published pointer. Missing intermediate availability is not fabricated.

StageEnrollmentAsync is the shared integration point for Mais's future **new enrollment** service. It requires the caller's transaction, acquires the same course lock, validates active/current approved publication and stages initial access without a notification or fee. Capture original CourseVersionId under that lock.

All future enrollment/cancellation/completion writers must use a consistent course-first lock order. Complete the initial enrollment fee operation in its actual business transaction; do not call enrollment purchase logic from publication.

A concurrent enrollment either enrolls before publication and receives the update, or enrolls directly in the new version. SQL tests verified both operations serialize without missing current access or duplicate receipts.

## 7. Achievement and progress preservation

GetStateAsync:
- Verifies the authenticated owner and eligible enrollment.
- Requires an active course, active category, approved current publication and current-version receipt.
- Reads owned historical achievements from approved versions of the same course.
- Uses logical identity to project earned completion/approval onto current content.
- Prefers existing historical evidence over optional current attempts for provenance.
- Accepts an immutable approved assessment or an explicitly persisted legacy `approved` attempt status. Client demo statuses are not proof.
- Does not require a fabricated access receipt to honor an explicitly recorded historical achievement.
- Does not copy, delete, reset or retarget old achievement rows.

For ongoing learners:
- Current requirements include current lessons and practical tasks.
- Added unrelated content starts incomplete.
- ProgressPercentage is earned current requirements / total current requirements.
- Removing old content changes the current denominator but does not erase its historical proof.
- Editing earned content retains credit regardless of changed content/instructions/rubric.

For completed learners:
- IsCourseCompleted is derived from completed status or a recorded CompletedAt.
- ProgressPercentage remains 100 and RequiredItemCount is zero.
- Existing completion date/certificate stay unchanged.
- CurrentCoveragePercentage separately describes coverage of optional current content; it is **not** a reset of course completion.

CompletionSource/ApprovalSource identify the concrete earned record, content ID and version. Legacy approval time may be unknown; no approval date is fabricated from submission time.

## 8. Optional revisit and attempts

Revisit is a policy permission, not a newly implemented playback API. Old completion and LastPositionSeconds remain stored. The projection separates:
- current concrete lesson playback position,
- preserved previous position,
- safe resume position (inherited automatically only for the same immutable video asset),
- logical earned completion.

For a changed video, previous position is retained but not blindly applied to a different timeline.

For an optional task attempt, Mais must:
- Create a **new** TaskSubmission ID against the concrete updated CourseTaskId.
- Allocate AttemptNumber within (EnrollmentId, concrete CourseTaskId).
- Set IsOptionalAtCreation from existing earned logical approval or completed-course status before the first save.
- Preserve previous attempts, files and immutable assessment reviews.
- Assess using the submitted task's version/rubric, not the latest public task.
- Never replace a previously approved attempt with the optional answer.
- Keep logical approval even if the optional attempt is rejected.

IsOptionalAtCreation describes the attempt's creation mode, not whether that attempt is currently required after later achievements. Null is retained for unknown legacy attempts.

## 9. Notifications

Reuses NotificationWriter and the current persisted recipient-owned inbox:
- Type: `course.updated`.
- Stable ID derived from learner user ID + published version ID.
- One logical message per learner/version.
- Replays preserve existing read/unread state and timestamps.
- First publication without a previous published version does not emit an update message.
- Draft editing, submission and rejected/changes-requested decisions do not emit it.
- Rollback removes staged notifications along with publication.
- No push/socket implementation was invented; the existing frontend polls/focus-refreshes its inbox.

Messages:
- Arabic: تم تحديث دورة {CourseTitle}. يمكنك الاطلاع على المحتوى الجديد، مع الاحتفاظ بتقدمك وإنجازاتك السابقة.
- English: Course {CourseTitle} has been updated. You can explore the new content while keeping your previous progress and achievements.

Publication currently stages the cohort synchronously in the transaction. For a large production cohort, a durable transactional outbox/batched worker would be a separate scalability improvement; do not replace this with fire-and-forget notifications.

## 10. Implemented services and endpoint

- `ICourseVersionUpdates / CourseVersionUpdates`
  - `StageEnrollmentAsync(Enrollment, ct)`: internal transaction-owned initial access integration.
  - `StagePublicationAsync(Course, CourseVersion, previousPublishedVersionId, ct)`: internal approval integration.
  - `GetStateAsync(enrollmentId, authenticatedLearnerUserId, ct)`: read-only ownership-checked state.
- `GET /me/enrollments/{enrollmentId:guid}/version-state`
  - Real Identity Learner membership required.
  - Ownership verified from the server user ID.
  - 403 for other owners/ineligible enrollments/unavailable content.
  - 404 for an unknown enrollment.
  - 409 for missing current availability initialization or ambiguous lineage.
- No client-controlled version-switch mutation endpoint exists.
- Existing review/publish routes and CategoryAdmin scope remain authoritative.

## 11. Contracts Mais must use

The response DTO is `backend/esham.BLL/DTOs/Courses/LearnerVersionDtos.cs`.

Important state fields:
- enrollmentId, courseId, originalCourseVersionId
- availableCourseVersionId, availableVersionNumber
- enrollmentStatus, isCourseCompleted, completedAt
- certificateId, certificateCourseVersionId (nullable legacy attribution)
- currentItemCount, requiredItemCount, earnedItemCount
- progressPercentage, currentCoveragePercentage, meetsCurrentRequirements
- learnerContentApiAvailable=false, learnerSubmissionApiAvailable=false
- lessons and tasks with logical/physical IDs and achievement provenance

Lesson fields distinguish isCompleted, isInherited, isNewToEnrollment, isUpdated, isOptional, revisitAllowedByPolicy and the position fields. Task fields distinguish isApproved, isInherited, isNewToEnrollment, isUpdated, isOptional and optionalResubmissionAllowedByPolicy. Completed learners may also make a voluntary first attempt on newly added tasks; the optional-attempt policy flag covers that case.

`isNewToEnrollment` means absent from the original enrollment snapshot, not unread since the last visit. `isUpdated` compares current content/attachments to the matching original content. Neither flag resets credit.

Frontend adapter:
- `loadEnrollmentVersionState` validates server identity/state and has no local success fallback.
- `versionContentActions` separates earned credit from policy permissions and executable capabilities.
- `versionProgressPercentage` keeps completed-course presentation at 100.
- Revisit/resubmission buttons must remain disabled until the corresponding real APIs exist. Do not flip availability booleans merely to enable UI.

Future learner writes must authenticate, verify enrollment ownership/eligibility and server-resolved version/content membership, and coordinate publication races under the course lock. Include an expected available version precondition for new current-content writes. Preserve an existing in-flight attempt's recorded task/version and answer; never silently retarget it after publication.

When completing a course, resolve current requirements under the same lock. If completion wins before an update, new content is optional. If publication wins, ongoing learners must meet the new requirements before first completion. This avoids retroactively undoing completed courses.

Future certificate/review creation must set explicit CourseVersionId from trusted server context and validate it belongs to the enrollment's course. Preserve existing issued certificates and one-review/one-certificate-per-enrollment constraints. Additional per-version certificates/reviews would need a separate agreed design.

## 12. Exact files changed for this policy

Backend model/configuration:
- backend/esham.DAL/Entities/Lesson.cs
- backend/esham.DAL/Entities/CourseTask.cs
- backend/esham.DAL/Entities/TaskSubmission.cs
- backend/esham.DAL/Entities/Certificate.cs
- backend/esham.DAL/Entities/CourseReview.cs
- backend/esham.DAL/Entities/EnrollmentVersionAccess.cs (new)
- backend/esham.DAL/Data/AppDbContext.cs
- backend/esham.DAL/Data/Configurations/CourseVersionUpdateConfiguration.cs (new)
- backend/esham.DAL/Data/Migrations/20261105182722_AddCourseVersionUpdates.cs (new)
- backend/esham.DAL/Data/Migrations/20261105182722_AddCourseVersionUpdates.Designer.cs (new)
- backend/esham.DAL/Data/Migrations/AppDbContextModelSnapshot.cs

Services/API:
- backend/esham.BLL/DTOs/Courses/LearnerVersionDtos.cs (new)
- backend/esham.BLL/Interfaces/ICourseVersionUpdates.cs (new)
- backend/esham.BLL/Services/CourseVersionUpdates.cs (new)
- backend/esham.BLL/Services/CourseReviewService.cs (extends the preceding local review implementation)
- backend/esham.PL/Development/AppDbContextDesignFactory.cs (new)
- backend/esham.PL/Endpoints/EnrollmentVersionEndpoints.cs (new)
- backend/esham.PL/Program.cs (preserves preceding local registrations/routes)

Tests/integration documentation:
- backend/esham.Tests/CourseVersionUpdateTests.cs (new)
- backend/esham.Tests/CourseVersionUpdateSqlTests.cs (new)
- backend/esham.Tests/CourseVersionBackfillSqlTests.cs (new)
- backend/esham.Tests/RelationalQueryTests.cs
- frontend/src/services/learnerVersionApi.js (new)
- frontend/tests/learner-version.test.mjs (new)
- frontend/package.json (append test; retain all prior suites)
- docs/course-version-updates-handoff.md (new)

Existing uncommitted publishing/UI work was preserved. No chatbot, video-creation frontend, admin dashboard styling or unrelated UI was modified by this policy task.

## 13. Remaining learner-side work for Mais

1. Implement real enrollment/list/access and purchase services/endpoints with existing point rules and StageEnrollmentAsync.
2. Replace local learner preview data with authenticated server content/progress/submission APIs.
3. Add ownership/version-bound content and media reads for available/historical authorized versions.
4. Implement monotonic lesson completion and separate optional playback updates without clearing earned records.
5. Implement task draft/submit/optional attempts and owner assessments using immutable historical task context.
6. Persist completion only when current required content is satisfied; preserve completed status/date forever under updates.
7. Issue certificates with explicit earned version and retain already issued certificates.
8. Implement real learner course reviews with explicit version attribution.
9. Integrate server version state/badges and enable capabilities only after those APIs are implemented.
10. Coordinate exact status tokens, cancellation/reactivation rules and lock ordering with the coordinator.

This change does not implement enrollment charging, learner progress mutations, task submission mutations, certificate issuance, full playback or their complete UI flows.

## 14. Verification

- Backend build: passed, zero warnings/errors.
- Backend full regression suite: **296 passed**, **20 opt-in SQL cases skipped** in the normal run.
- Dedicated isolated SQL run: **4 passed**, including real concurrency, rollback and populated legacy backfill.
- Frontend tests: **103 passed**.
- Frontend production build: passed (existing dependency bundling warnings remain).
- Offline model consistency: no pending model changes after the generated migration.
- Forward script reviewed: no DROP/DELETE/TRUNCATE of existing data/tables; updates only initialize the new logical columns, inserts only add access/history rows.
- Shared hosted migration application: **not performed**.
- Real learner achievements used for testing: **none**.

Coverage includes edited lesson/task credit, added requirements, completed learners/certificates, optional rejected attempts, old video positions, deleted/replaced content, multiple publications, replay/read-state deduplication, rejection, ineligible/unauthorized access, immutable attribution, unknown historical availability, changed attachments, concurrent approval/enrollment and rollback of all publication effects.

SQL tests require explicit opt-in and a separately provisioned Esham_AccountTests_* connection. The populated backfill test creates a fresh **LocalDB-only** test database; it never uses hosted application settings/secrets. Local temporary test databases were retained; no shared records were cleared.

## 15. Integration risks and limits

- The hosted database remains on the old schema; deploy this backend only after coordinating and explicitly applying the reviewed migration.
- Old binaries must not continue cloning content after deployment begins; they do not carry logical identity.
- Ambiguous old versions have separate lineage roots. No automatic historical achievement matching is claimed where lineage is unknowable.
- Unknown certificate/review attribution and legacy optional mode remain null by design.
- The future learner write services must enforce their complete business rules, preserve approved/completed records and use the shared transaction/version contracts. The read projection is not a replacement for them.
- Canceled/unknown statuses are excluded; reactivation behavior must be explicitly integrated rather than interpreted as a fresh paid enrollment.
- Publication notification fanout is synchronous; very large cohorts need separately designed batching/outbox capacity.
- Tests exercised SQL Server LocalDB and isolated data, not new writes or migrations against the shared hosted database.
- Full learner end-to-end functionality remains pending Mais's services and integration.

## ملخص عربي لميس

الجاهز: هوية ثابتة للدروس والمهام عبر النسخ، وسجل إتاحة الإصدارات مع حفظ إصدار التسجيل الأصلي، واحتساب الإنجاز الموروث حسب السياسة الجديدة حتى بعد تعديل المحتوى، وحماية الإنجازات والشهادة للمتعلمين المكتملين، وإشعار محفوظ وممنوع التكرار عند النشر الناجح. يوجد endpoint لقراءة الحالة وعقد واجهة لا يعرض نجاحًا وهميًا أو يفعّل خدمات غير موجودة.

المطلوب منك: خدمات التسجيل والدفع والتقدم والتسليم والتقييم والشهادات ومحتوى المتعلم الفعلي، وربط صفحات التعلم بالـAPI، مع استخدام قفل الدورة وعقود الإصدار والإنجاز الموضّحة أعلاه. المحاولة الاختيارية سجل جديد، ولا تلغي نجاحًا سابقًا. الجديد للمتعلم المكتمل اختياري ولا يعيد احتساب رسم التسجيل.

الهجرة جاهزة ومجرّبة محليًا، لكنها لم تُطبّق على قاعدة البيانات المشتركة. يجب أن تراجعها المنسقة وتنسّق التطبيق والنشر قبل تشغيل الباكند الجديد عليها.
