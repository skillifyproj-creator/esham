> Public technical handoff. Operational identities, recovery evidence and database-specific scripts are intentionally kept outside version control. Verification counts below are historical snapshots; see README for current startup and regression commands.

# Course moderation and publishing — current implementation

Updated November 5, 2026. This report supersedes the earlier verification snapshot in course-review-workflow.md. Work remains uncommitted for UI/code review. Target: Fatima backend delivery before November 13, 2026.

## Completed workflow

The existing CourseReviewService and existing role pages were retained and verified, rather than rebuilt.

- Owner Instructor explicitly submits the current eligible draft using its expected version ID. The backend re-evaluates real requirements inside the locked transaction. The version becomes pending and stops accepting draft edits; submission alone does not publish anything.
- Pending review queues, version details, feedback and activity load from real APIs. No local moderation queue or simulated success is used in these connected pages.
- An assigned CategoryAdmin other than the course owner may approve/publish, reject or request changes. Rejection/requested changes require feedback (maximum 4000 characters).
- Approval rechecks content/category readiness and active course safety status, then publishes exactly the approved pending version.
- A decided version can be revised by its owner into a new numbered draft. Sections, lessons, tasks and attachment relationships receive new physical IDs; lesson/task logical identities survive cloning. Historical content, submissions and decisions remain attributable to their old versions.
- The previous published version stays public during private revision, resubmission and rejection. Public APIs select the approved PublishedVersionId only.
- Decisions and AdminActivityLog entries persist in the same transaction as the state transition. Stale/duplicate mutations return conflict. Course-row locking serializes publication and enrollment integration.

## Work completed in this continuation

1. Fixed version review snapshots to include a lesson's primary video even when it is not duplicated in LessonAttachments. The existing authenticated, version-bound media endpoint is reused; no video creation/editor code was changed. Duplicate primary/attachment references are returned once per lesson.
2. Corrected CanReview so stale pending versions do not offer decision actions after the course points at another draft. Server-side conflict enforcement remains in place.
3. Clarified GeneralAdmin oversight permissions in the existing review detail component.
4. Browser verification found the public Footer was rendered by the existing AdminWorkspace. Removed only that Footer/import to meet the required no-Footer Admin layout; preserved sidebar, styling and responsive behavior.
5. Restricted the mutation browser verifier to an explicitly provided isolated fixture and separate local API port. The old hosted fixture manifest is rejected. Added read-only layout mode and 12 role/language/viewport checks.

## API endpoints

All private endpoints require Identity authentication. POST review mutations require X-Requested-With: XMLHttpRequest. IdentityRoleFilter derives actor roles from current database memberships, rather than trusting client persona flags.

| Method | Endpoint | Behavior |
| --- | --- | --- |
| GET | /api/course-reviews?status=pending | Submitted versions filtered by server-side role/category scope; optional status filter |
| GET | /api/course-reviews/activity | Persisted review activity; CategoryAdmin results remain category-scoped |
| GET | /api/courses/{courseId}/review | Current snapshot, readiness, decisions and permission flags |
| GET | /api/courses/{courseId}/review/versions/{versionId} | Explicit historical/current version snapshot |
| POST | /api/courses/{courseId}/review/submit | Body: expectedVersionId; owner-only submission |
| POST | /api/courses/{courseId}/review/revision | Body: expectedVersionId; owner-only new draft from a decided version |
| POST | /api/courses/{courseId}/review/versions/{versionId}/decision | Body: decision (approved/rejected/changes_requested), comment |
| GET | /api/courses/{courseId}/review/versions/{versionId}/media/{assetId} | Authorized attached/primary media, private no-store response and byte-range streaming |
| GET | /me/enrollments/{enrollmentId}/version-state | Owned eligible learner enrollment's latest version availability and preserved achievements |

There is no independent bypass-publish endpoint: successful authorized approval performs publication atomically.

## Permissions

| Role | Read | Mutate |
| --- | --- | --- |
| Owner Instructor | Own course versions, readiness and decisions | Submit eligible current draft; create revision after decision |
| Other Instructor / ordinary learner / guest | No private review access | No moderation decisions or ownership bypass |
| CategoryAdmin | Submitted versions and activity in active assigned categories | Decide current pending submissions only within that scope, never own course |
| GeneralAdmin | Cross-category queue, versions, media and review activity | Oversight only under the existing product policy; this continuation does not broaden decision privileges |
| GeneralAdmin + CategoryAdmin | GeneralAdmin read visibility | Decisions still require assigned CategoryAdmin authority and non-ownership |

CategoryAdmin scope is checked against the submitted version's category, not a client-selected category. Inactive/missing assignments cannot authorize decisions. CanReview mirrors the current pending pointer; actual mutation authorization remains server-side.

## Publication and course-version updates

CourseReviewService invokes CourseVersionUpdates.StagePublicationAsync after staging successful approval and the publication pointer change, before save/commit.

- Existing eligible active/completed enrollments receive baseline/new-version availability receipts. Original Enrollment.CourseVersionId is preserved.
- Previous versions and historical progress/submissions/reviews/certificates are retained. Logical lesson/task IDs support inherited earned achievements without title/position guessing.
- Completed learners keep completion and certificates; added content is optional. Optional attempts do not erase an earned approval.
- StagePublicationAsync uses the caller's transaction. Failure rolls back publication, review decision, activity, receipts and notifications together.
- Updated-publication notifications use the existing NotificationWriter and deterministic per-learner/per-version IDs. Unique version-access receipts and course locking prevent duplication on racing decisions/retries.
- Draft edits, submit, rejection and requested changes do not create course.updated notifications. Initial publication does not send an update notification. Canceled/ineligible enrollments are excluded.
- No enrollment replacement, repeat fee, wallet mutation or new point transaction occurs in publication integration.

See course-version-updates-handoff.md for Mais's API contracts and learner-write responsibilities.

## Migration status and deployment boundary

The existing `20261105182722_AddCourseVersionUpdates` migration was applied and verified by the database coordinator. The EF migration, Designer and model snapshot are the source-controlled schema definition. Recovery evidence and database-specific deployment scripts are private operational material. Never apply migrations automatically at startup. New deployments require coordinator approval, a verified recovery method and schema compatibility checks.

## Verification results

| Check | Result |
| --- | --- |
| Backend build via test build | Passed |
| Backend unit/regression suite | 300 passed, 20 opt-in SQL tests skipped, zero failed |
| Isolated SQL integration | 7 passed: publication concurrency/deduplication, rollback, enrollment/publication race, admin mutation concurrency/rollback/query checks |
| Isolated migration/backfill integration | 1 passed; legacy populated data preserved without fabricated lineage or notifications |
| Frontend tests after final shell change | 103 passed, zero failed |
| Frontend production build | Passed; existing dependency use-client bundling warnings remain |
| Browser/API workflow on isolated LocalDB | Passed: guest landing, eligible/ineligible/unauthorized submit, refresh persistence, feedback, revision, scoped review, GeneralAdmin oversight-only, concurrent submit/decision conflicts, approved public version, later private/rejected revision isolation, activity |
| Existing role layouts | 12 passed: Instructor/CategoryAdmin/GeneralAdmin, Arabic RTL and English LTR, 1440px and 390px, no horizontal overflow or JavaScript errors; Admin pages have no Footer |
| Patch formatting | git diff --check passed |


Frontend tests also print an existing Vite WebSocket-port contention message while passing; it does not affect the independent isolated browser checks.

## Remaining work and blockers

1. Coordinate future schema deployments explicitly; the existing version-update migration has already been applied and verified. Apply no migration automatically.
2. Mais implements/integrates the remaining enrollment, lesson-progress, task-submission/review and completion/certificate write services. Current tree exposes reusable version-state infrastructure, not a complete learner write workflow. Enrollment creation must invoke StageEnrollmentAsync in the locked transaction; optional task attempts must preserve historical approval and attribution. No duplicate 20-point charge is permitted.
3. Use read-only shared-environment checks; use isolated fixtures for all submit/review/publication tests.
4. Review the UI/code and commit/push only after the owner's instruction.

## Administrator security

Keep the safeguards in AdminUserService and DevelopmentIdentityRoles that prevent unauthorized GeneralAdmin grants. Account identities, role-cleanup history and recovery evidence belong in private operational records.

## Files changed in this continuation

- backend/esham.BLL/Services/CourseReviewService.cs
- backend/esham.Tests/CourseReviewWorkflowTests.cs
- frontend/src/pages/shared/CourseReviewAdminPages.jsx
- frontend/src/components/admin/AdminWorkspace.jsx
- frontend/scripts/verify-course-review.cjs
- docs/course-moderation-publishing.md
- docs/course-review-workflow.md (superseding-status reference)

Existing uncommitted moderation/version-update/frontend/security work was preserved. No commit or push was performed.
