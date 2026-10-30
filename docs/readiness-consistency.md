# Lesson and curriculum readiness consistency

Update: the three attachments below describe the inspected state at this audit. The later [one-video normalization](submission-eligibility-and-one-video.md) retained the selected primary relationship and detached the other two, preserving all MediaAssets/files. Readiness remains backend-authoritative.

## Exact lesson and persisted evidence

Verified with the authorized owner account, without repairing or saving any course/lesson data:

- Course: **أساسيات cpp**, `d95a3d7a-7a6d-407a-8b29-d68684bb349e`.
- Current editable draft: `7f74d574-b1fc-4cd8-a665-0d54c2bf53be`, review status `draft`.
- Section: **iostream**, `d74b5714-3135-43f3-b5f0-401312fb4a2a`.
- Lesson: **تعريف مكتبة iostream**, `c5e34da0-71a2-41d1-a239-8766b5f0798a`.
- Arabic description: `فقط تعلم كيفية تعريف مكتبات داخل البرنامج`.
- Saved objective: `تعلم اضافة مكتبات`.
- Estimated lesson duration: 600 seconds / 10 minutes.
- Content type: `video`. No separate article body applies.
- Primary MediaAsset: `5d99a8ae-141b-4ad3-893c-3b31b28e725e`, an owned edited WebM, 13,044,740 bytes. Its media duration is approximately 58.58 seconds, distinct from the Instructor's estimated lesson duration.
- Matching LessonAttachment: `c751ffdf-428d-4ea6-a5d9-55b3116d7e7f`. Three owned video attachments exist in total, including the original uploads/recording. Existing ScreeningResult rows are pending/untrusted; draft-content completeness is not AI approval.
- The Lesson model has **no persisted `status`, `ready`, or completion flag**. Readiness is derived from actual content fields and associations.

## Root cause

Before this fix there was no backend lesson/section/curriculum readiness calculation. The backend returned stored metadata; only Course Tasks had a separate backend count check for later submission.

The Lesson Editor independently calculated four checks: nonempty active-language title, article text or `PrimaryVideoMediaAssetId`, objectives, and duration. The curriculum called the older `courseReadiness.lessonIsReady` helper, which expected `video.mediaId` or a remote `videoUrl`. The real backend adapter intentionally returned `video: {}` and `videoUrl: ''` while retaining the real `PrimaryVideoMediaAssetId`. Consequently the persisted video passed the editor but failed the curriculum. This was a contract/formula mismatch, not missing data or a wrong draft.

The section's old four flags were title, at least one lesson, all lessons ready, and `!section.task || taskIsReady(section.task)`. For this lesson they evaluated true/true/false/true, explaining **75%**. The last flag was a leftover section-task assumption: tasks belong to CourseVersion, and optional display placement is not a lesson/section completion requirement. Legacy local `lesson.status` is not a real database completion flag and is not an authority for these backend-backed pages.

Both pages were reading the same current draft/lesson. No stale local curriculum, media cache or historical version caused this particular mismatch. A separate discrepancy was that the editor treated a one-character title as complete while the older curriculum required two characters; the shared policy preserves the stricter existing two-character requirement.

## Fix and authoritative rules

`DraftContentReadiness` is now the single backend policy used for:

1. Readiness included in ordinary section/lesson API responses.
2. A combined current-draft curriculum response, with lesson, section and overall results from the same loaded graph.
3. A read-only preview of unsaved lesson metadata, so the editor does not duplicate the policy in JavaScript.

Lesson checks: an Arabic or English title of at least two characters within existing limits; Article text of at least 20 characters within existing limits **or** a valid existing primary video with an owned video MediaAsset and matching attachment to this same lesson; one to fifty nonblank valid localized objectives; finite duration from one to 600 minutes. A primary GUID alone, foreign-owned media, an empty file record, or missing attachment does not satisfy video readiness. Valid localized content in one language remains valid when switching the UI language.

Section checks: valid localized title, at least one lesson, every lesson ready according to that same policy. Tasks are not section prerequisites. Curriculum content readiness aggregates the current draft's sections. Empty sections/curricula remain incomplete. Course-task count and full Submit for Review/moderation requirements remain separate; no task or approval rule was weakened.

The editor uses the persisted readiness initially, then calls a debounced read-only preview after edits. Responses are abortable; late responses for old form values cannot set the current readiness. API failures do not fall back to cached/demo readiness. Both pages keep their existing labels and layout.

The curriculum reads its data and aggregation from one backend response. Existing nonempty curricula no longer invoke default-section initialization on every visit, keeping this verification genuinely read-only. Empty curricula still use the existing atomic initializer.

New Instructor-owner/current-draft endpoints:

- `GET /api/courses/{courseId}/draft/sections/readiness`
- `POST /api/courses/{courseId}/draft/sections/{sectionId}/lessons/readiness` — computes a preview only, with an optional existing Lesson ID and lesson metadata; does not save.

## Files changed in this fix

- `backend/esham.BLL/DTOs/Courses/CurriculumDtos.cs`
- `backend/esham.BLL/Interfaces/ICurriculumService.cs`
- `backend/esham.BLL/Services/CurriculumService.cs`
- `backend/esham.BLL/Services/DraftContentReadiness.cs`
- `backend/esham.PL/Endpoints/CurriculumEndpoints.cs`
- `backend/esham.Tests/DraftContentReadinessTests.cs`
- `frontend/src/services/curriculumApi.js`
- `frontend/src/hooks/useLessonReadiness.js`
- `frontend/src/pages/instructor/EditLessonPage.jsx`
- `frontend/src/pages/instructor/CourseCurriculumPage.jsx`
- `frontend/tests/curriculum.test.mjs`
- `frontend/scripts/verify-readiness-consistency.cjs`
- This report.

Chatbot and video-environment code were not changed by this readiness fix. No migration, schema change, data repair, commit or push.

## Verification

- Backend build/test compilation passed. Complete backend tests: **246 passed, 16 existing opt-in skips**. Sixteen new cases cover policy agreement, incomplete content, duration bounds, Arabic-only content, valid/invalid persisted media, preview isolation, ownership/current-draft restrictions, and empty curricula.
- Frontend tests: **93 passed**; production build passed, with existing third-party bundling warnings.
- Real browser: login to the actual owner account; open this exact lesson; four checked requirements and 100%; Back to the same curriculum; lesson Ready, section Complete/100%, curriculum 100%; refresh both pages; matching status persists.
- Unsaved invalid duration preview becomes 75%; refresh discards it and restores the saved 100%. English/Arabic switching preserves the same content readiness.
- Exact before/after API snapshots, including course/draft row version and complete persisted curriculum response, were equal. Browser observed zero course/lesson mutation requests; preview POSTs are read-only.
- Screenshots in the OS temporary directory: `esham-readiness-lesson.png`, `esham-readiness-curriculum.png`.
