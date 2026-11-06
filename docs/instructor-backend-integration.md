> Public technical handoff. Operational identities, recovery evidence and database-specific scripts are intentionally kept outside version control. Verification counts below are historical snapshots; see README for current startup and regression commands.

# Existing Instructor pages: backend integration

## Audit and scope

The existing routes remain unchanged: `/instructor`, `/instructor/performance`, `/instructor/courses/:courseId/performance`, `/instructor/feedback`, `/instructor/courses/:courseId/feedback`, `/instructor/submissions`.

Before this change, Dashboard mixed real own-course data with `instructorDemo` statistics and a browser wallet. Performance used demo courses, invented learner/rating/section figures, and a browser ledger. Ratings used `instructorFeedback` and localStorage replies. Submissions used static courses and browser task submissions. The four existing page layouts, styles and bilingual text remain in use; fake data and browser mutations were removed from these pages.

The repository already has Enrollment, LessonProgress, TaskSubmission, SubmissionAttachment, immutable TaskSubmissionReview, CourseReview and PointTransaction entities. The learner enrollment, progress, submission, rating and completion write APIs are not implemented in the current BLL/endpoint tree. `CourseReviewService` is **moderation**, not learner ratings. `CourseVersionUpdates` supplies approved-version access and logical lesson/task achievement interpretation and remains unchanged.

## Implemented endpoints

All paths below are under `/api/instructor`, require an authenticated, unlocked Identity account with current database Instructor membership, and restrict queries/actions to `Course.OwnerUserId`. GeneralAdmin/CategoryAdmin are not substitutes for Instructor ownership. Forged role claims do not authorize access.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/dashboard` | Real aggregate dashboard statistics and six monthly enrollment/completion buckets |
| GET | `/performance?courseId=&period=all` | Aggregate or owned-course analytics; periods `7d`, `30d`, `3m`, `all` |
| GET | `/reviews?courseId=&page=1` | Read-only persisted CourseReview rows; 50 per page |
| GET | `/submissions?status=awaitingReview&page=1` | Owned submitted attempts; 50 per page; approved/rejected filters supported |
| GET | `/submissions/{id}` | Authorized answer, work link, task title, learner display name, attachments and immutable decisions |
| GET | `/submissions/{id}/attachments/{attachmentId}` | Authorized attachment download, no storage keys exposed, private/no-store, nosniff |
| POST | `/submissions/{id}/review` | `{ decision: "approved" or "rejected", feedback }`; revision requests require feedback, maximum 2000 characters |

Foreign course/submission/attachment identifiers return 404; non-Instructors return 403; guests return 401. Mutation requests reuse the existing application-header/origin protection. Lists use stable time/ID ordering and bounded pagination. Draft answers are not exposed. The client clears private response state when account identity or query changes and ignores late aborted responses.

## Metric definitions and limits

- Dashboard learner count is distinct learners across owned enrollments. Performance enrolled count counts enrollment records, so the same learner enrolled in two owned courses contributes twice.
- Period filters select enrollment cohorts by EnrolledAt. Ratings and teaching ledger totals use their respective event timestamps. Monthly completion buckets use persisted CompletedAt within the cohort.
- Started means completion evidence, LastOpenedAt, valid course lesson progress, or a submitted attempt. Completed uses persisted completed status/CompletedAt; analytics never sets either field.
- Section completion measures distinct completed LogicalLessonId evidence for each enrolled learner against the current published section's logical lessons, within the same course and approved versions. Cloned lesson rows are not double-counted. This is lesson coverage, not a recomputation of certification or mandatory-task completion.
- Awaiting-review and approved-attempt counts are submission counts, not distinct tasks or certified course completions.
- Ratings aggregate existing CourseReview rows. Existing saved InstructorReply is displayed only; reply editing and browser persistence were removed. The ratings page explicitly labels its summary, filters and CSV export as applying to the current 50-row page; pagination exposes remaining reviews. Performance rating summary covers its full server scope.
- Teaching points read only existing `PointTransactions` with `TransactionType=teaching`, owned enrollment attribution and current instructor recipient. No ledger writes, wallet updates or inferred reward grants occur. Mais must use/coordinate the canonical transaction discriminator when implementing enrollment rewards.
- Watch duration and growth percentage are unavailable (null); resume position is not watched duration and is not misreported as watch hours. The activity panel explicitly says no activity feed is available.

## Submission workflow boundary / Mais handoff

Only `awaitingReview` attempts with SubmittedAt and no prior review can be decided. The course is locked first with SQL Server UPDLOCK/HOLDLOCK under a serializable, retry-aware transaction. The task must belong to the enrollment's course and an approved version covered by its original version or an existing access receipt; enrollment must be active/completed. The ownership check is repeated after locking. Both append-only review evidence and attempt status commit atomically. Duplicate/concurrent decisions return conflict, and earlier approved reviews survive rejection of later optional attempts.

The persisted status/decision vocabulary is `awaitingReview`, `approved`, `rejected`, matching `CourseVersionUpdates` approved evidence. `inProgress` remains private. The unrelated browser learner prototype uses different legacy statuses; it has not been overwritten or wired into these endpoints.

Mais remains responsible for learner-owned enrollment creation, StageEnrollmentAsync access integration, progress writes, attachment uploads, locking submitted work, new attempt creation after rejection, course ratings eligibility/writes, completion reconciliation, reward ledger and certificate issuance. Future learner writes must use the existing course-first lock order and preserve IsOptionalAtCreation. Instructor review deliberately does not complete enrollments, modify LessonProgress, create certificates, award points, rewrite previous reviews, or re-open completed courses. No notification rule was invented for task reviews.

## Changed files for this task

- `backend/esham.BLL/Services/InstructorInsightsService.cs` (new)
- `backend/esham.PL/Endpoints/InstructorInsightsEndpoints.cs` (new)
- `backend/esham.PL/Program.cs` (service/route registration only in this task)
- `backend/esham.Tests/InstructorInsightsTests.cs` (new)
- `frontend/src/services/instructorInsights.js` (new)
- `frontend/src/hooks/useInstructorInsights.js` (new)
- `frontend/src/pages/instructor/InstructorDashboard.jsx`
- `frontend/src/pages/instructor/InstructorPerformancePage.jsx`
- `frontend/src/pages/instructor/InstructorFeedbackPage.jsx`
- `frontend/src/pages/instructor/InstructorSubmissionsPage.jsx`
- `frontend/tests/instructor-insights.test.mjs` (new)
- `frontend/scripts/verify-instructor-insights.cjs` (new; refuses shared API port)
- `frontend/package.json` (test registration)
- This document.

The working tree already contained unrelated changes from earlier tasks; they were preserved. No entities, migration files, Admin pages, learner services, authentication rules, chatbot or video environment were changed for this task.

## Verification

Final results (November 6, 2026):

- Backend build: passed, zero warnings/errors.
- Backend regression: 311 passed, 25 opt-in SQL tests skipped.
- Instructor focused run with guarded LocalDB opt-in: all 6 passed (5 in-memory and 1 SQL integration test). Includes fresh role checks, forged claims, ownership, unavailable metrics, persisted populated/empty data, draft privacy, protected attachments, cancelled-enrollment denial, replay protection, optional-attempt evidence and simultaneous decisions from independent SQL contexts.
- Frontend tests: all 107 passed, including 2 new API-client tests.
- Frontend production build: passed. Existing third-party module directive warnings remain; Vite's pre-existing test HMR port warning does not fail tests.
- Browser: all 16 Arabic RTL/English LTR layouts at 1440/390px passed with no horizontal overflow or page errors, including populated submission details. Additional checks passed for guest401, foreign-course404, review persistence, duplicate409, real empty states and API503 without demo fallback.
- Shared development API restarted at `http://localhost:5206`, using existing User Secrets with startup seeding disabled. Swagger returned successfully and contains all seven instructor routes. Frontend `http://localhost:5173/` returned200. Servers remain running. The isolated API/frontend on5216/5175 are separate from shared data.
- `git diff --check`: passed. No commits or pushes. All mutation fixtures use in-memory databases or an explicitly guarded `(localdb)\MSSQLLocalDB` database named `Esham_AccountTests_*`. The browser script refuses API targets other than localhost:5216 and frontend targets other than port5175. It never logs shared users in.
