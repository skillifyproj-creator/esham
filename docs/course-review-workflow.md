> Current status: see [course-moderation-publishing.md](course-moderation-publishing.md). The verification statements below are an earlier snapshot; the existing version-update migration was subsequently applied and verified by the database coordinator.

# Course review workflow ? implementation and verification

Implemented locally on November 5, 2026. No commit or push.

## API
All private endpoints require a valid Identity session. Mutation requests require the existing application header `X-Requested-With: XMLHttpRequest`.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | /api/courses/{courseId}/review | Current version snapshot, eligibility, decisions, media and publication pointer |
| GET | /api/courses/{courseId}/review/versions/{versionId} | Immutable version snapshot |
| POST | /api/courses/{courseId}/review/submit | Submit current draft; body: expectedVersionId |
| POST | /api/courses/{courseId}/review/revision | Clone current decided version to a new draft; body: expectedVersionId |
| POST | /api/courses/{courseId}/review/versions/{versionId}/decision | decision: approved/rejected/changes_requested; comment |
| GET | /api/courses/{courseId}/review/versions/{versionId}/media/{assetId} | Authorized version-bound media streaming with range support |
| GET | /api/course-reviews?status=pending | Scope-filtered submitted versions (optional status filter) |
| GET | /api/course-reviews/activity | Scope-filtered persisted course review audit entries |

Submission reuses the same eligibility evaluator as diagnostics, inside a serializable transaction that locks the parent course. It requires owner Instructor membership, the exact expected current draft, cover, course metadata/objectives, ready sections/lessons, and 1?3 ready practical tasks. Incomplete submissions return the missing requirement codes. Duplicate/stale operations return 409.

Decisions require actual CategoryAdmin membership, an active assignment for the submitted version's category, a different owner, and the current pending version. GeneralAdmin has cross-category oversight, but decisions remain CategoryAdmin work, preserving the existing product design. An account with both roles may decide only through its assigned CategoryAdmin authority.

Rejection/requested changes require nonblank feedback (maximum 4000 characters). Approval rechecks content/category eligibility and active course safety status. The approved version alone becomes PublishedVersionId. CourseReviewDecision and AdminActivityLog persist decisions and actions atomically.

## Transitions and isolation
- draft ? pending on submission; publication pointer stays unchanged.
- pending ? approved/rejected/changes_requested on an authorized decision.
- Approval points publication to the reviewed version only.
- A decided version's content stays locked. Revision explicitly creates a new numbered draft with new section/lesson/task/attachment relationship IDs.
- Immutable media assets are shared by identity; files and old content are not rewritten.
- Rejection or revision preserves earlier approved content and public visibility.
- Existing public catalog queries continue selecting only the approved PublishedVersionId; private snapshots are not added to public APIs.

## Connected frontend
- Instructor CourseReviewPage: real snapshot/eligibility, explicit submit confirmation, pending status after refresh, feedback, revision creation, and existing-public-version notice.
- Instructor course list: localized server review status and links to real review feedback; approved versions map to the published filter.
- Existing review-report route now opens the same real review interface.
- CategoryAdmin dashboard/course queue/details/activity: authenticated API data, no local moderation queue or admin impersonation selector.
- CategoryAdmin decisions: real approve/publish, reject and request changes; locked after a decision.
- GeneralAdmin course queue and snapshot viewer: real API data with oversight permissions.
- Arabic RTL and English LTR styling uses existing Esham tokens.

## Verification
- Backend build: success, zero warnings/errors.
- Backend tests: 276 passed, 16 existing isolated-SQL tests skipped, 292 total.
- Frontend tests: 99 passed.
- Frontend production build: passed; dependency `use client` bundling warnings remain.
- Real hosted SQL Server/API/browser tests used newly created temporary users/categories/courses only.
- Verified eligible submission, ineligible/unauthorized rejection, missing feedback rejection, unassigned CategoryAdmin denial, assigned review, GeneralAdmin oversight-only behavior, refresh persistence, revision cloning, feedback/audit persistence, correct approved publication, and private revision isolation.
- Concurrent real SQL submissions and concurrent decisions each returned exactly one success and one 409.
- Browser verified Arabic submit/reject actions and English submit/approve actions.
- Eight final browser layout checks covered instructor/reviewer pages at 1440px and 390px in Arabic and English; correct lang/dir, no horizontal overflow, no JavaScript errors. Additional queue, pending, feedback and guest Landing Page checks passed.
- All pre-existing course draft/publication pointers and UpdatedAt values matched the captured baseline after verification. No pending migrations; no model/schema/migration changes.
- The temporary verification course was archived afterward so test content no longer appears in the public catalog. Temporary records/history remain for inspection; no existing records were deleted or reset.
- The real C++ course was neither submitted nor published.

The repeatable browser script is `frontend/scripts/verify-course-review.cjs`. It requires a separately provisioned **fresh** temporary fixture manifest via ESHAM_REVIEW_FIXTURE (or the local temporary default) and Playwright via PLAYWRIGHT_MODULE; it deliberately never provisions or selects a real course automatically. Random test credentials are outside the repository and are not printed.

## Files for this workflow
Backend:
- esham.BLL/DTOs/ServiceResult.cs
- esham.BLL/DTOs/Courses/CourseReviewDtos.cs
- esham.BLL/Interfaces/ICourseReviewService.cs
- esham.BLL/Services/CourseReviewService.cs
- esham.BLL/Services/CourseSubmissionEligibilityService.cs
- esham.BLL/Services/CourseService.cs (reuse mapping)
- esham.BLL/Services/CurriculumService.cs (reuse mapping)
- esham.BLL/Services/CourseTaskService.cs (reuse mapping)
- esham.PL/Endpoints/IdentityRoleFilter.cs
- esham.PL/Endpoints/CourseReviewEndpoints.cs
- esham.PL/Program.cs
- esham.Tests/CourseReviewWorkflowTests.cs
- esham.Tests/DraftContentReadinessTests.cs

Frontend:
- package.json
- src/App.jsx
- src/services/courseReviewApi.js
- src/pages/instructor/CourseReviewPage.jsx
- src/pages/instructor/InstructorCoursesPage.jsx
- src/pages/category-admin/CategoryAdminModule.jsx
- src/pages/admin/SuperAdminModule.jsx
- src/pages/shared/CourseReviewAdminPages.jsx
- src/pages/shared/CourseReviewActivityPage.jsx
- src/styles/course-review-workflow.css
- tests/course-review.test.mjs
- tests/frontend.test.mjs
- scripts/verify-course-review.cjs

Earlier local UI polish in CourseCurriculumPage.jsx, LessonVideoWorkflow.jsx, instructor.css and lesson-video-workflow.css was preserved. No additional recording/editor changes were made for this workflow. Chatbot and Mais's learner enrollment/wallet/progress/submission code were untouched.

## Local review
- Frontend: http://localhost:5173/
- Swagger: http://localhost:5206/swagger
- Instructor: /instructor/courses/{courseId}/review
- CategoryAdmin: /category-admin/courses
- GeneralAdmin: /admin/courses

Both development servers were left running. Backend demo-course seeding was disabled for the verification run; no startup configuration/secrets were overwritten.
