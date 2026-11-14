# Phase 3: learner tasks, submissions, attachments and assessment integration

Implemented for the approved isolated development scope, November 14, 2026. See PHASE3-VERIFICATION.md for commands/results. Phase 4 has not started. No migrations, entities, statuses or dependencies were added.

## Coordination and scope

The project owner explicitly confirmed Fatima's approval during this session for original task/version assessment detail, transaction-bound assessment notification and necessary locking/session integration. InstructorInsightsService remains the only assessment implementation. Its decision vocabulary, terminal rules, original-or-receipt historical eligibility and instructor ownership policy are preserved. The existing instructor review endpoint was NOT wrapped in the new submission gate or disabled.

New learner mutations have an independent SubmissionMutations gate, default false. It reuses the existing actual LocalDB verifier with its own options, independently of progress/purchase flags. It requires the exact approved catalog, configured LocalDB instance, actual DB_NAME(), IsLocalDB and local-machine SQL identity. Hosted writes cannot be enabled by setting the flag alone. Shared User Secrets and processes were not changed.

## Final API contracts

E = `/me/enrollments/{enrollmentId:guid}`; S = `E/submissions/{submissionId:guid}`. All routes require authentication and actual Learner membership including Both. Reads use current eligible learning entitlement, active category and receipt; they do not import catalog visibility or EnrollmentPaused purchase restrictions.

| Method | Route | Contract |
| --- | --- | --- |
| GET | E/tasks | LearnerTaskPage: accountId, enrollmentId, availableCourseVersionId, mutationsEnabled, items |
| GET | E/tasks/{taskId} | Current concrete LearnerTask with instructions, requirements and protected resources |
| GET/HEAD | E/tasks/{taskId}/attachments/{attachmentId}/content | Current task-bound resource download |
| POST | E/tasks/{taskId}/submissions | CreateAttempt -> SubmissionDetail, HTTP 200 including replay |
| GET | E/submissions?taskId=&page=1 | SubmissionPage, 20 entries/page, totalCount |
| GET | S | Owned historical/current SubmissionDetail |
| PUT | S/draft | SaveDraft -> SubmissionDetail |
| POST | S/submit | FinalizeAttempt -> SubmissionDetail, including canonical replay |
| POST | S/attachments | One multipart file plus uploadId, expectedTaskVersionId, expectedDraftToken |
| DELETE | S/attachments/{attachmentId} | AttachmentMutation JSON body -> SubmissionDetail |
| GET/HEAD | S/attachments/{attachmentId}/content | Owned attempt-bound attachment download |

Exact DTOs are in `esham.BLL/DTOs/Submissions/SubmissionDtos.cs`. Ownership, dates, status, attempt number, optional attribution and asset associations are never accepted from clients. Mutation JSON rejects unmapped fields. Writes reuse trusted-origin/application-header checks plus X-Esham-Account-Id as a session precondition, never an ownership selector. Multipart does not use a client-supplied Content-Type boundary.

Safe examples, using illustrative identifiers:

```json
{ "requestId": "<stable-request-guid>", "expectedCourseVersionId": "<current-version-guid>" }
```

```json
{
  "expectedTaskVersionId": "<recorded-task-version-guid>",
  "expectedDraftToken": "<opaque-server-fingerprint>",
  "answerText": "My practical explanation",
  "workUrl": "https://example.test/work"
}
```

Finalization/removal accept only expectedTaskVersionId and expectedDraftToken. Responses include:

```json
{
  "accountId": "<current-account>",
  "enrollmentId": "<owned-enrollment-guid>",
  "id": "<submission-guid>",
  "courseTaskId": "<concrete-task-guid>",
  "courseVersionId": "<recorded-version-guid>",
  "attemptNumber": 1,
  "isOptionalAtCreation": false,
  "status": "awaitingReview",
  "answerText": "My practical explanation",
  "workUrl": "https://example.test/work",
  "createdAt": "2026-11-14T12:00:00+00:00",
  "submittedAt": "2026-11-14T12:01:00+00:00",
  "draftToken": "<opaque-server-fingerprint>",
  "canEdit": false,
  "task": { "id": "<concrete-task-guid>", "courseVersionId": "<recorded-version-guid>" },
  "attachments": [],
  "reviews": []
}
```

The example abbreviates the nested task; its full DTO contains bilingual title/description, instructions, requirements, logical identity, ordering, approval/optional presentation and protected resources. Historical instructions are returned through the owned attempt. Task-resource URLs still authorize only the current published task; history does not grant arbitrary historical media access.

Errors use existing Problem Details: 400 validation, 401 session, 403 membership/unavailable content/disabled writes, 404 foreign/missing resources and 409 state/version/request conflicts. Codes include submission_disabled, publication_changed, attempt_pending, draft_conflict, submission_locked, request_conflict, upload_conflict, attachment_limit, empty_submission, invalid_work and invalid_attachment. draft_conflict returns canonicalState. Oversized HTTP requests return 413; unsupported request media type returns 415.

## Lifecycle and version semantics

`inProgress -> awaitingReview -> approved or rejected`.

- Drafts require inProgress, no SubmittedAt and no review. Only one draft/pending attempt per enrollment/concrete task may be created by the service.
- Attempt numbers are server-allocated max+1 under the course lock, backed by the existing unique index.
- Finalization requires an answer, safe HTTP/HTTPS URL or persisted attachment. Answer/URL lengths and URL safety are revalidated. Task requirements are free-text rubric entries, not a machine-readable mandated file-type schema; semantic compliance is assessed by the instructor.
- Finalization freezes answer, URL and attachment set. No pending editing, withdrawal, deletion of finalized evidence or new statuses were introduced.
- Rejection leaves the original attempt/review intact. A new request creates a new numbered attempt.
- Approval is terminal for that attempt. Optional attempts derive IsOptionalAtCreation from authoritative logical approval/completed-course state. Rejection of an optional attempt cannot revoke prior credit.
- Superseded unsubmitted drafts remain readable and reject edits, uploads, removal and finalization with publication_changed. The current concrete task can have a separate draft.
- Historical finalized attempts stay attributed to their original task/version and remain assessable under existing policy. No row is retargeted.
- New/replaced logical identities do not inherit approval. Existing logical approvals continue contributing to CourseVersionUpdates.
- No wallet, ledger, original enrollment version/owner, receipt, lesson progress, course completion or certificate is modified by submission or assessment.

History requires the same owned enrollment, approved same-course recorded task and original-version attribution or an access receipt. Unknown legacy access is not repaired. Historical instructor read visibility remains separate from permission to assess; existing policy was not narrowed.

## Transactions, fingerprints and replay

EF execution-strategy retries wrap serializable SQL transactions. Locks follow course -> learner/account -> enrollment -> attempt/attachments. The existing assessment service shares the course lock and rechecks actual instructor membership after locking. Publication and learner writes serialize without silently changing target versions. File transfer/expensive validation is outside these locks.

Draft creation derives a stable account-scoped submission identity from its request GUID. Immutable enrollment/task/version binding is checked before replay succeeds. Cross-task/course reuse conflicts. The Identity account lock serializes same-account cross-course requests as well as the course lock serializing same-course attempt allocation.

Draft fingerprints include submission/enrollment/task identity, answer, URL and sorted attachment IDs/media IDs/content hashes. Different current state rejects stale edits with canonical state. The approved ABA limitation remains: editable content A -> B -> A has the same fingerprint. CreatedAt and immutable fields are not revision counters. A future RowVersion migration remains an optional Fatima-coordinated improvement.

Finalization uses the attempt identity and frozen content fingerprint. A committed finalization is reconciled before current-version checks, returning its current canonical pending/approved/rejected state without reopening it or emitting another event. Unknown/different tokens conflict. Assessment duplicates retain the existing 409 behavior.

Upload identities are account-scoped and bound to their submission through persisted attachment identity and server-computed byte metadata. Matching retries return the existing link even if the prior response was lost. Different bytes/name/type/target or a detached identity conflict. Clients retain request identities after uncertain responses instead of creating another attempt/upload automatically.

## Private files and SQL/filesystem consistency

Supported: PDF, PNG, JPEG, WebP, UTF-8 TXT and DOCX. Legacy DOC is rejected. Maximum five linked files per attempt and 10 MiB/file, including concurrent uploads. Multipart requests are capped at 10 MiB plus 64 KiB framing allowance and accept exactly one file.

The new submission writer shares the configured private media root/opaque-key read infrastructure but does not widen existing cover/video upload behavior. New storage keys are server-generated GUIDs. Filenames are sanitized display metadata. Existing metadata/hash identity is never modified. Client storage keys or arbitrary asset links are not accepted.

Validation checks byte structure, extension and MIME agreement:

- PDF: header, EOF, xref location and root catalog structure; active/embedded program markers are rejected.
- PNG: chunk boundaries/CRC, dimensions and bounded zlib content.
- JPEG/WebP: bounded container/frame structure and signatures.
- TXT: strict UTF-8 and control-character validation.
- DOCX: at most 256 entries, 32 MiB expanded total, 20 MiB per entry, compression ratio at most 100, unique safe entry paths, XML with DTD/external resolution disabled, correct document/content-type/root relationship. Embedded binary programs/macros and external relationships are rejected.

These are conservative structural acceptance checks, not a complete document renderer, sanitizer or antivirus product. Unsupported/encrypted/complex variants may be rejected with validation errors. DOCX with external relationships is intentionally rejected. No uploaded content is executed or rendered by the server. Downloads force application/octet-stream, sanitized content disposition, private/no-store and nosniff. Work URLs reject non-HTTP/HTTPS protocols, credentials and control characters and are never fetched server-side.

Lifecycle:

1. Check session/owned attempt and actual isolated gate before accepting file writes.
2. Create a uniquely keyed private temporary file and a .phase3-journal pending marker with an exclusive lease.
3. Stream with bounds, validate bytes/container and hash; move to its final private key before SQL references can commit.
4. Under SQL locks revalidate owner/version/editability/token/count/request identity, then save immutable MediaAsset and SubmissionAttachment together.
5. Reconcile persisted key references after success, rollback or exceptions. A committed MediaAsset row retains the file. No persisted metadata after definitive rollback permits deleting only this newly generated file.
6. If the database outcome cannot be established, retain file/journal; never infer rollback from an exception.

SQL rollback does not roll back filesystem writes. An interrupted process can leave a journal/file. Explicit reconciliation processes only this writer's pending GUID markers older than 24 hours, skips exclusive active leases, re-verifies the actual isolated target and retains any file with a MediaAsset row. Any dependent resource must reference such a row through existing FKs, so this check conservatively covers every resource reference.

Attachment removal deletes only the editable draft link. Immutable MediaAsset metadata and its file are retained as the upload-identity tombstone; delayed retries cannot resurrect it. Retained detached assets are not crash-orphans and are deliberately not reclaimed by the orphan command. Their longer-term quota/retention policy belongs to coordinated storage operations, not an unsafe sweep. Lease marker files contain no credentials.

Explicit recovery command, with the already-approved isolated process configuration and both seeders disabled:

```powershell
$contentRoot = Join-Path (Get-Location) 'backend/esham.PL'
dotnet artifacts/phase3-regression-bin/esham.PL.dll --contentRoot $contentRoot --reconcile-submission-uploads true
```

This action exits before application seeding and refuses hosted/non-isolated targets or the wrong media root. It reports only a count. Recovery/retention ownership is the deployment/storage operator; Fatima coordinates any later database retention/schema changes. No schema or new dependency was needed for the file journal.

## Assessment and notification integration

Existing instructor submission detail adds original instructions, requirements, CourseVersionId, LogicalTaskId, IsOptionalAtCreation and review IDs. The frontend displays original context and clears selection/feedback on account change. Approval/rejection remain the existing POST route and body.

Finalization stages one task.submitted notification to the course owner using the submission identity. Assessment stages one task.assessed notification using its persisted review identity in the SAME review transaction. No after-commit send, duplicate review implementation, draft/upload notification or historical backfill was added. Replays cannot reset read state. Navigation resolves from persisted ownership-checked event records, never message parsing.

## Frontend

LearnerTasksContext and the connected task page no longer import preview submissions or IndexedDB media. Real task lists, drafts, uploads/removal, finalization, paginated history and feedback use server responses. The old standalone preview adapter remains unused by connected source; no legacy marks/files were imported. Unrelated preferences are preserved.

New routes: `/learner/enrollments/:enrollmentId/tasks/:taskId` and `/learner/enrollments/:enrollmentId/submissions/:submissionId`; `/learner/tasks` is the server-backed overview for the current enrollment page. The player, enrollment detail and dashboard link to real tasks. Existing progress projections refresh on confirmed changes/focus. Original CSS classes, Arabic/English and RTL/LTR layouts are retained.

State binds account/enrollment/task/version/attempt, masks private data during render, aborts obsolete requests and ignores late results. Mutations have a synchronous double-click guard. Upload retries keep the same identity and file. Mixed-version details never enable editing. Session refresh remains with the account provider; passive summary failures do not reintroduce the Phase 2 logout/login race.

## Exact Phase 3 source manifest

Created:

- backend/esham.BLL/DTOs/Submissions/SubmissionDtos.cs
- backend/esham.BLL/Interfaces/ILearnerSubmissionService.cs
- backend/esham.BLL/Services/LearnerSubmissionService.cs
- backend/esham.BLL/Services/SubmissionMutationGate.cs
- backend/esham.PL/Storage/SubmissionAttachmentWriter.cs
- backend/esham.PL/Storage/SubmissionFileStructure.cs
- backend/esham.PL/Endpoints/LearnerSubmissionEndpoints.cs
- backend/esham.Tests/LearnerSubmissionTests.cs
- backend/esham.Tests/SubmissionApiTests.cs
- backend/esham.Tests/SubmissionFileTests.cs
- backend/esham.Tests/SubmissionSqlServerTests.cs
- backend/esham.Tests/Phase3IsolatedEnvironmentTests.cs
- frontend/src/services/learnerSubmissionsApi.js
- frontend/tests/learner-submissions.test.mjs
- frontend/scripts/verify-learner-submissions.cjs
- backend/PHASE3-TASKS-SUBMISSIONS.md
- backend/PHASE3-VERIFICATION.md

Modified, preserving earlier local work:

- backend/esham.BLL/Services/InstructorInsightsService.cs
- backend/esham.BLL/Services/NotificationService.cs
- backend/esham.BLL/Services/CourseVersionUpdates.cs (submission capability only)
- backend/esham.PL/Program.cs
- backend/esham.PL/appsettings.json
- backend/esham.Tests/CourseVersionUpdateTests.cs (new executable capability expectation)
- backend/esham.Tests/InstructorInsightsTests.cs (actual isolated DB guard before SQL setup)
- backend/esham.Tests/Phase2IsolatedEnvironmentTests.cs (separate regression artifacts, unchanged approved media root)
- frontend/package.json
- frontend/src/App.jsx
- frontend/src/context/LearnerTasksContext.jsx
- frontend/src/pages/learner/LearnerTasksPage.jsx
- frontend/src/pages/learner/LearnerLessonPage.jsx
- frontend/src/pages/learner/LearnerDashboard.jsx
- frontend/src/pages/learner/LearnerEnrollmentPage.jsx
- frontend/src/pages/instructor/InstructorSubmissionsPage.jsx
- frontend/src/services/notifications.js
- frontend/scripts/verify-learning-progress.cjs (optional regression artifact directory)

Task/submission access shares one service/interface rather than duplicating separate task-service plumbing. Existing authoring services, DAL mappings, migrations, wallet and progress writers are unchanged. Other dirty files predate Phase 3. Ignored credentials, synthetic files, binaries, logs and screenshots are verification artifacts, not source.
