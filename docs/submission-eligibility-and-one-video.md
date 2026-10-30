# Submission eligibility and one video per lesson

## Exact real-course result

Course **أساسيات cpp** (`d95a3d7a-7a6d-407a-8b29-d68684bb349e`), current version `7f74d574-b1fc-4cd8-a665-0d54c2bf53be`, remains an editable **draft**. It was not submitted or published.

| Check | Persisted/backend result |
| --- | --- |
| Curriculum content | 100%, ready |
| Section | One completed section, 100% |
| Lesson | One ready video lesson, 100% |
| CourseTask count | 1, satisfies the 1–3 requirement |
| Task completeness | 1/1 ready; `IsReady=true`, localized title/description/instructions and assessment requirements present |
| Course title/category | Complete; Programming is active |
| Course description | Complete |
| Course language/level | Arabic / beginner, valid |
| Course cover | **Missing: `CoverMediaAssetId=null`** |
| Course-level objectives | **Missing: `Objectives=[]`**; lesson objectives do not substitute for course objectives |
| Review status | `draft` |
| Backend Submit for Review/moderation | **Not implemented** |

This course is **not eligible yet**: cover and course learning objectives are missing. These requirements already existed on the old review screen; they were not invented to block submission. The practical task is not a blocker, and no task per lesson/section is required.

## Original submission inconsistency and scope

The curriculum displayed an unconditional generic reminder about completing lessons/tasks, regardless of their actual state. The review route still read the old demo/localStorage workspace, counted section tasks instead of CourseVersion tasks, and used `submitCourse` to simulate a local administrator queue. No corresponding ASP.NET submission endpoint or real moderation transition existed.

The existing review layout now loads the real course, backend curriculum readiness, real CourseTasks, and backend eligibility. The curriculum sidebar uses the same eligibility endpoint. They show exact checks and workflow availability rather than the misleading generic blocker. Both remain stable after refresh.

`GET /api/courses/{courseId}/draft/submission-eligibility` returns the current version/status, per-check results, task/ready-task counts, percentage, content eligibility, `submissionImplemented=false`, and `canSubmit=false`. A single complete task passes. An incomplete task or 0/4+ tasks fails. Existing Instructor ownership and editable-draft guards apply.

The task predicate follows the existing backend save contract: the task must be explicitly ready and have title, description, instructions, and nonblank assessment requirements. It does not adopt the obsolete frontend section-task model.

This change intentionally implements **eligibility diagnosis/integration**, not a new administrator moderation workflow. The real course is already ineligible, and adding admin review/publication would exceed the requested boundaries. Local fake submission was removed from this user-facing route. Once metadata is complete, real submission/pending-review transitions and administrator review still need their own implementation; no direct publishing bypass was added. Existing unrelated admin/preview services were not edited.

## Inspected legacy video relationships

Lesson **تعريف مكتبة iostream** (`c5e34da0-71a2-41d1-a239-8766b5f0798a`) had:

| File | MediaAsset ID | Attachment ID | Action |
| --- | --- | --- | --- |
| `2026-10-30 22-54-44.mp4`, 21,608,919 bytes | `2602ef5c-6e36-4bfb-aaf0-010ce3027462` | `3a04ca7a-3fa5-4fbb-b69e-2426228ddabb` | Detached relationship only |
| `recording-1793394024107.webm`, 15,493,131 bytes | `271bbddd-d078-46bc-b72e-d019b85251aa` | `a6f4f821-4b63-4710-a3cf-555a6d8c35c8` | Detached relationship only |
| `edited-1793394183162.webm`, 13,044,740 bytes | `5d99a8ae-141b-4ad3-893c-3b31b28e725e` | `c751ffdf-428d-4ea6-a5d9-55b3116d7e7f` | **Kept: currently selected primary** |

They were inspected and reported before normalization. All belonged to the same Instructor. The selected edited video points to the recording through `SourceMediaAssetId`; that link remains unchanged. All three MediaAssets, content hashes, physical files and screening history were retained. Only the two non-primary LessonAttachment rows were removed through the authorized draft service. No startup mass-cleanup or ambiguous primary selection was introduced.

`POST .../lessons/{lessonId}/media/normalize` is an explicit owner/draft-guarded operation. It requires an unambiguous owned selected primary when duplicates exist, retains that relationship, and removes only extra video relationships. Foreign ownership or a missing selected primary prevents unsafe normalization.

## One-video rule

- Normal upload is allowed only when no video is attached; an identical upload retry is idempotent.
- A new parallel upload returns conflict when a video already exists, before streaming bytes when possible. State is checked again inside the existing serializable course-lock transaction to prevent racing uploads.
- Explicit replacement supplies internal `X-Replace-Attachment-Id`. It must identify the current relationship; a stale or foreign ID fails. Asset registration, old relationship removal, new relationship creation, and primary pointer update commit atomically.
- Replacement and removal never delete MediaAssets, bytes, screening records or source history. Non-video relationships are not normalized away.
- Removing the video clears the primary pointer and allows a new Add Video afterward.
- Derived media preserves its source chain. Original/source files may be registered as the sole current video during export and then explicitly replaced by the derived result; only one relationship exists at each committed step. Interrupted exports retain the current usable video and permit idempotent retries.
- Detached ancestors are accepted as sources only through the currently attached video's same-lesson owned lineage. Arbitrary media from another course/version cannot be attached by supplying its ID.
- Readiness uses the same backend policy and requires exactly one valid owned video relationship for a video lesson. Approved/published versions remain immutable.

The Lesson Editor now shows Add Video only when empty. With a video, it shows the existing preview, **Replace Video**, and **Remove Video**. Replace opens the same creation/upload environment, carrying the current relationship as internal context. No manual IDs, layout redesign, recording-control edits or tool refactor were introduced. The environment's persistence adapter now sends explicit replacement intent when needed.

## Files changed in this task

Backend:

- `backend/esham.BLL/DTOs/Courses/LessonMediaDtos.cs`
- `backend/esham.BLL/DTOs/Courses/SubmissionEligibilityDtos.cs`
- `backend/esham.BLL/Interfaces/ILessonMediaService.cs`
- `backend/esham.BLL/Interfaces/ICourseSubmissionEligibilityService.cs`
- `backend/esham.BLL/Services/LessonMediaService.cs`
- `backend/esham.BLL/Services/CurriculumService.cs`
- `backend/esham.BLL/Services/CourseTaskService.cs`
- `backend/esham.BLL/Services/CourseSubmissionEligibilityService.cs`
- `backend/esham.PL/Endpoints/LessonMediaEndpoints.cs`
- `backend/esham.PL/Endpoints/CourseEndpoints.cs`
- `backend/esham.PL/Program.cs`
- `backend/esham.Tests/LessonMediaServiceTests.cs`
- `backend/esham.Tests/DraftContentReadinessTests.cs`

Frontend:

- `frontend/src/services/lessonMediaApi.js`
- `frontend/src/services/submissionEligibility.js`
- `frontend/src/components/instructor/SubmissionEligibilityPanel.jsx`
- `frontend/src/pages/instructor/EditLessonPage.jsx`
- `frontend/src/pages/instructor/LessonVideoWorkflow.jsx` — context/persistence integration only
- `frontend/src/pages/instructor/CourseCurriculumPage.jsx`
- `frontend/src/pages/instructor/CourseReviewPage.jsx`
- `frontend/tests/lesson-media.test.mjs`
- `frontend/tests/curriculum.test.mjs`
- `frontend/tests/frontend.test.mjs`
- `frontend/scripts/verify-lesson-media.cjs`
- `frontend/scripts/verify-review-eligibility.cjs`
- This report and supersession notes in the earlier media/readiness reports.

No chatbot, learner/admin workflow, recording/upload component, or video stylesheet edits. No migration or schema change. No commit/push.

## Verification

- Backend build: passed, zero warnings/errors.
- Complete backend tests: **254 passed; 16 existing opt-in SQL tests skipped**. Added eligibility cases for 0–4 tasks, valid one-task metadata, missing cover/objectives, incomplete tasks and ownership; media tests cover second-video rejection, explicit/stale replacement, remove/add, safe normalization, source retention and existing cross-course/version/immutable guards.
- Frontend: **94 tests passed**; production build passed with existing third-party bundling warnings.
- Real-course browser: exact eligibility checks, 1/1 ready tasks, curriculum 100%, missing cover/objectives, unavailable backend submission, correct disabled action, consistent refresh. Real legacy relationships normalized 3→1 while keeping the primary. Lesson Editor shows one Replace and one Remove action, no additional Add action.
- Temporary-course browser: first video succeeds; actual trim preserves source while keeping one attachment; second parallel video is rejected; idempotent retry; explicit Replace succeeds; Remove succeeds; Remove→Add succeeds; refresh retains exactly one video; protected range playback and cleared-cache persistence still pass. Recording/upload/edit UI remains unchanged.
- Read-only database/file verification confirmed all three original real-course assets, hashes, files and the selected source link survived normalization. The temporary test course, assets, screenings, relationships and tracked files were cleaned afterward.
- Real-course cover/objectives, task data, review status and publication pointers were not changed to make checks pass.
