# Phase 2: protected learning content and lesson progress

Implemented for development and the explicitly approved isolated LocalDB scope. Hosted progress writes and purchases remain disabled. No migrations, schema changes, new dependencies, task writes, reconciliation or certificate issuance were introduced.

## Access and version policy

`LearnerLearningAccess` checks actual Identity Learner membership (including Both), lockout/session and onboarding, owned enrollment, active/completed enrollment status, active course, the current approved same-course publication, active category and the enrollment's version receipt. A lesson must belong to that exact published version. Every media request revalidates this relationship and resolves only the lesson's primary asset or its exact attachment link.

EnrollmentPaused continues to block purchases, not existing learning access. The documented active-category policy is deliberately retained. Public catalog/purchase availability additionally uses EducationalCategories.Visible; that predicate is not imported into learning entitlement. Fatima should coordinate any future policy unification. My Courses prefers successful learning entitlement over the catalog-derived availability hint.

The default player serves the current publication with a receipt. It does not accept a historical version selector. Enrollment.CourseVersionId remains the original purchase. Historical achievements from approved same-course versions remain evidence, even when legacy receipts are unknown; they do not grant arbitrary historical playback. Missing receipts and ambiguous lineage fail closed without repair.

## API contract

All routes require authentication. Let E be `/me/enrollments/{enrollmentId:guid}` and L be `E/learning/lessons/{lessonId:guid}`.

| Method | Route | Response |
| --- | --- | --- |
| GET | E/learning | LearningCourse |
| GET | E/progress | LearningCourse, the same authoritative curriculum/progress projection |
| GET | L | LessonContent with current progress and protected relative media URLs |
| POST | L/open | ProgressState; records an explicit visit without clearing position/completion |
| PUT | L/progress | ProgressState; saves position with a concurrency token |
| PUT | L/completion | ProgressState; monotonic completion acknowledgement |
| GET, HEAD | L/video | Authenticated primary video, with range support |
| GET, HEAD | L/attachments/{attachmentId:guid}/content | Authenticated attachment download |

Existing E/version-state remains compatible; learnerContentApiAvailable is now true. learnerSubmissionApiAvailable remains false.

Exact DTO definitions: `esham.BLL/DTOs/Learning/LearningDtos.cs` and existing `DTOs/Courses/LearnerVersionDtos.cs`. JSON uses the existing camelCase policy. LearningCourse includes accountId, enrollmentId, courseId, originalCourseVersionId, availableCourseVersionId, bilingual titles, progressWritesEnabled, resumeLessonId, lessonCoveragePercentage, versionState and ordered sections/lessons. Sections sort by SortOrder then ID; lessons sort by SortOrder then ID within each section.

Open/position request:

```json
{
  "expectedCourseVersionId": "<current-version-guid>",
  "expectedProgressToken": "<opaque-token-from-server>",
  "lastPositionSeconds": 12.5
}
```

Open ignores the position field and preserves server position. Completion accepts only:

```json
{ "expectedCourseVersionId": "<current-version-guid>" }
```

Representative ProgressState response (illustrative identifiers):

```json
{
  "accountId": "<current-account-id>",
  "enrollmentId": "<owned-enrollment-guid>",
  "courseVersionId": "<current-version-guid>",
  "lessonId": "<current-lesson-guid>",
  "isCompleted": false,
  "completedAt": null,
  "lastPositionSeconds": 12.5,
  "resumePositionSeconds": 12.5,
  "progressToken": "<opaque-token>",
  "updatedAt": "2026-11-14T12:00:00+00:00"
}
```

Writes require X-Requested-With: XMLHttpRequest, an allowed Origin/fetch context and X-Esham-Account-Id matching the cookie account. The header is a precondition, never an ownership selector. Video elements/download links use cookie authorization without custom mutation headers.

Errors follow existing Problem Details: 400 validation, 401 unauthenticated, 403 membership/unavailable content/disabled gate, 404 foreign or missing enrollment/lesson/media, 409 account/version/access/progress conflict. Codes include progress_disabled, progress_conflict, publication_changed, version_access_missing, onboarding_required and invalid_position. A progress_conflict includes canonicalState with current ProgressState; the client reloads rather than automatically overwriting it. Current GET version-state retains its existing foreign-owner 403 contract.

## Transactions, concurrency and retries

Every progress write uses the independent LearningProgress gate, disabled by default. Its enabled path requires the exact approved LocalDB catalog and datasource, actual DB_NAME(), IsLocalDB=1 and a local-machine LOCALDB server identity. Flags alone cannot enable hosted writes. Purchase gating remains unchanged.

The EF execution strategy wraps a serializable transaction. SQL locks follow course -> learner Identity row -> enrollment -> progress. Publication uses the same course-first convention. Access, actual membership and expected publication are rechecked under the lock. The existing unique enrollment/lesson index and serialized first writes prevent duplicate rows. Failed attempts clear tracking; rollback covers progress and LastOpenedAt together. Media streaming never holds this transaction.

Progress tokens hash persisted row identity, enrollment/lesson identity, exact position bits, completion fields and UTC timestamp ticks. UpdatedAt strictly advances by at least one tick, including repeated positions and backward clocks; relational tests force a future timestamp and verify SQL datetimeoffset precision round trips.

An equal position is NOT proof of an exact replay. Stale open/position tokens return 409 with canonical state, including after ambiguous commit acknowledgement. No receipt table/schema is fabricated for progress request identities. Completion alone is recognizably replayable because it is monotonic: a repeated acknowledged completion returns the existing state without changing its first date or update token. Explicit opens and positions cannot clear completion. Legitimate backward seeks are allowed.

Video positions must be finite, nonnegative and within the persisted primary asset duration. Unknown/nonpositive/nonfinite duration prevents position persistence; article positions are zero. Opening/completing a newly accessible physical lesson preserves safe inherited position where appropriate. GETs never create progress or update activity.

Lesson completion is learner acknowledgement, not proof of viewing. No course status/date, wallet, ledger, receipt, certificate or task approval is changed by these writes.

## Achievement and resume semantics

Logical completed lessons retain credit after cloning/edits. Old concrete rows and dates are preserved. Current lesson completion can be inherited; a fresh physical visit/position does not revoke it. Resume position crosses versions only for the same immutable primary video asset. A changed/missing video preserves old evidence without seeking a new timeline.

Resume chooses the most recent valid owned approved progress/visit logical identity mapped to the current curriculum, falling back to the first required incomplete lesson then the first available lesson. There is no new last-lesson column. Reads do not rewrite historical data.

Lesson coverage is separate from existing combined lesson/task progress. Added content starts incomplete for ongoing learners; completed courses retain their completed status/date and 100% course progress, with optional current coverage separately available. All lessons complete with a required unapproved task does not finalize the enrollment. Final reconciliation/certificates remain deferred.

## Media and frontend

Media uses IMediaStorage and authenticated streaming; storage keys/hashes/paths never enter learner DTOs. No static media mount or unrestricted private URL was added. Range and HEAD requests are authorized. Attachments force application/octet-stream download with sanitized filenames. Responses are private/no-store and nosniff. Articles render as React text. Already downloaded bytes cannot be revoked and this is not DRM.

The isolated process explicitly uses a separate `artifacts/phase2-isolated/media` root. The development handshake additionally reports progressWritesEnabled and mediaIsolated without exposing filesystem paths or connection information. Browser guards require isolated API 5216/frontend 5175, the real database handshake and dedicated media configuration.

LearningProvider owns account-scoped server summaries with bounded four-request concurrency over the current enrollment page. The player uses enrollment GUIDs, server curriculum, generation/account/version checks, abort signals, serialized token updates, throttled position saves, explicit completion and server resume. Account switches mask private data during render and remove video/pending writes; late responses cannot restore it. Legacy course links resolve only through owned server enrollments. No local preview marks are imported as achievements. Existing non-authoritative preferences remain.

Passive summary 401s hide learning data but do not invalidate global session state during logout/login; AccountSessionProvider remains the session authority. Active player failures refresh the current cookie session. This fixes the race discovered by the Phase 1 browser regression.

My Courses, enrollment detail, dashboard and progress pages consume the persisted projection. The existing course-report action remains in the player. Task/review/certificate actions are not activated from local completion. Existing CSS/layout classes and bilingual/RTL behavior are retained.

Hard page/process termination can lose unsent playback seconds; saves occur periodically and on pause/seek/lesson navigation. Server-acknowledged progress remains authoritative. Storage-file deployment is independent of SQL deployment: a database asset with missing bytes produces a protected 404, not a demo fallback.

## Exact Phase 2 source manifest

Created:

- backend/esham.BLL/DTOs/Learning/LearningDtos.cs
- backend/esham.BLL/Interfaces/ILearnerLearningService.cs (learning, progress and write-gate interfaces)
- backend/esham.BLL/Services/LearnerLearningAccess.cs
- backend/esham.BLL/Services/LearnerLearningService.cs
- backend/esham.BLL/Services/LessonProgressService.cs
- backend/esham.BLL/Services/LearningProgressWriteGate.cs
- backend/esham.PL/Endpoints/LearnerLearningEndpoints.cs
- backend/esham.Tests/LearnerLearningTests.cs
- backend/esham.Tests/LearnerLearningApiTests.cs
- backend/esham.Tests/LessonProgressSqlServerTests.cs
- backend/esham.Tests/Phase2IsolatedEnvironmentTests.cs
- frontend/src/context/LearningContext.jsx
- frontend/src/services/learningApi.js
- frontend/src/services/lessonProgressApi.js
- frontend/tests/learning.test.mjs
- frontend/scripts/create-phase2-video.cjs
- frontend/scripts/verify-learning-progress.cjs
- backend/PHASE2-PROTECTED-LEARNING.md
- backend/PHASE2-VERIFICATION.md

Modified, preserving the existing Phase 1 changes:

- backend/esham.BLL/Services/CourseVersionUpdates.cs (content capability flag only)
- backend/esham.PL/Program.cs
- backend/esham.PL/appsettings.json
- frontend/package.json
- frontend/src/App.jsx
- frontend/src/context/LearnerContext.jsx
- frontend/src/data/learnerHelpers.js
- frontend/src/services/financialApi.js (account precondition for PUT/PATCH/DELETE as well as POST)
- frontend/src/pages/learner/LearnerCoursesPage.jsx
- frontend/src/pages/learner/LearnerEnrollmentPage.jsx
- frontend/src/pages/learner/LearnerDashboard.jsx
- frontend/src/pages/learner/LearnerLessonPage.jsx
- frontend/src/pages/learner/LearnerProgressPage.jsx

Existing dirty files outside this list belong to the preserved pre-Phase 2 work. Ignored build outputs, synthetic fixtures/credentials, media, screenshots and verification logs are operational artifacts, not source. No credentials or connection strings were added to source.
