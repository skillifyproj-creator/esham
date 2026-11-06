# Instructor unchanged-resubmission dialog

The previous UI exposed only a distant inline error and refreshed review data after every attempt. There was no machine-readable validation identifier.

The existing backend validation now adds `code: course_resubmission_unchanged` to HTTP 400 ValidationProblem responses. ServiceResult carries an optional code; other errors keep their existing contract. No eligibility rule, persistence or schema changed. The shared course request helper preserves the response status and code on the thrown error.

CourseReviewPage opens the existing Modal design only for status 400 plus this exact code. It does not match translated message text. The new Instructor-scoped dialog contains the exact requested Arabic/English title, description and acknowledgment label. It adds screen-reader description, explicit acknowledgment focus, Tab/Shift+Tab containment, native Escape dismissal and focus restoration to Submit for Review. A synchronous request guard and one boolean dialog state prevent repeated clicks from producing duplicate requests or stacked dialogs. Other HTTP/network failures still show an inline alert. Refresh and success feedback occur only after a successful submission.

Rejected submission does not mutate status: the revision remains draft and the reviewed source remains changes_requested with its feedback/history intact. There is no optimistic transition or success toast on error.

## Verification

- Frontend: 119 tests passed; production build passed with existing third-party bundler warnings.
- Backend build: passed, no warnings/errors. Full suite: 328 passed, 32 opt-in SQL skips. Focused resubmission tests: 12 passed, one SQL opt-in skip.
- Isolated browser: eight Arabic/English x Light/Dark x 1440/390px combinations passed. Real HTTP 400 produced one dialog and one request despite repeated confirm clicks. Initial focus, Tab containment, Escape, restored trigger focus, mobile width, accessible naming/description passed. HTTP 503 and simulated network failure used different inline feedback. A real meaningful edit then submitted successfully without the dialog. Original reviewed state remained changes_requested. No page errors.
- Normal local API restarted with both startup seeders disabled; Swagger checked separately.

## Changed files for this task

- backend/esham.BLL/DTOs/ServiceResult.cs
- backend/esham.BLL/Services/CourseReviewService.cs
- backend/esham.PL/Endpoints/ServiceResults.cs
- backend/esham.Tests/CourseResubmissionTests.cs
- frontend/src/services/curriculumApi.js
- frontend/src/pages/instructor/CourseReviewPage.jsx
- frontend/src/components/instructor/UnchangedResubmissionDialog.jsx
- frontend/tests/course-review.test.mjs
- frontend/tests/frontend.test.mjs
- frontend/scripts/verify-resubmission-dialog.cjs
- docs/course-resubmission-dialog.md

The browser script requires explicit isolated fixture/API/frontend variables and refuses the normal port 5206. Use fresh temporary review fixtures; the script finishes by submitting the edited fixture. No shared database records or real C++ course were modified. No migrations, chatbot/AI/video changes, unrelated redesign, commits or pushes. Prior work is preserved.
