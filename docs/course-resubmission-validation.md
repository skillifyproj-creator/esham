# Course resubmission validation

## Cause and implementation

`ReviseAsync` correctly clones a decided version and preserves the reviewed snapshot and its review decision. `SubmitAsync` previously checked ownership, draft state and readiness only. A byte-for-byte clone therefore passed immediately.

Submission now compares normalized meaningful content with the course's most recent decided version when that decision is `changes_requested`. The existing immutable reviewed snapshot is the reliable persisted baseline; no new table, migration or stored fingerprint column is needed. SHA-256 fingerprints are computed from canonical content inside the existing serializable submission transaction and course update lock. Existing content writers also serialize through the course/version and reject pending-version edits. First submissions, approval and rejection lifecycle behavior remain unchanged.

Compared: course titles/descriptions/objectives/category/language/level/cover; ordered sections and lesson content/objectives/preview mode/type; task titles/descriptions/instructions/requirements/placement; attachment display names/order/content; primary video and cover bytes. Media use immutable content hash, byte size and media/MIME type; missing hashes fall back to asset identity. Identical-byte reuploads are unchanged. Text normalizes Unicode, line endings, null/empty and surrounding whitespace. List ordering remains meaningful.

Ignored: generated row/version/lineage IDs as content values, version numbers, timestamps, UI state, readiness flags, screening status, original upload filenames, storage paths and derived duration metadata. Reverting an edit returns the original fingerprint. A meaningful edit on the same draft ID is detected.

Identical content returns HTTP 400 with both exact requested Arabic and English messages. The existing review page renders failed requests as an accessible alert. A changed draft must still pass the existing eligibility checks. The CategoryAdmin still judges whether changes adequately address feedback; no automated semantic approval was added.

## Verification

- Backend build: passed, no warnings/errors.
- Full backend suite: 328 passed, 32 opt-in SQL skips.
- Focused resubmission suite with isolated SQL enabled: 13 passed. Cases: no edit; unchanged Save; metadata only; normalization; edit/revert; real details/section/lesson/task/attachment changes on the same draft ID; identical-media reupload versus changed video bytes; ownership and readiness; fresh-scope persistence and concurrent edit/submission serialization.
- Frontend tests: 117 passed. Production build passed with existing third-party bundler warnings.
- Isolated browser: exact bilingual alert in Arabic/English and Light/Dark; unchanged draft stays draft; meaningful edit becomes pending; original feedback survives; no page errors.
- Normal local API restarted with seeders disabled. All mutation verification used isolated fixtures.

## Files

- backend/esham.BLL/Services/CourseContentSnapshot.cs
- backend/esham.BLL/Services/CourseReviewService.cs
- backend/esham.Tests/CourseResubmissionTests.cs
- frontend/src/pages/instructor/CourseReviewPage.jsx
- frontend/tests/course-review.test.mjs
- frontend/scripts/verify-course-resubmission.cjs
- docs/course-resubmission-validation.md

The browser harness requires explicit isolated fixture/API/frontend variables, refuses port 5206 and uses a temporary course in changes_requested (or its unchanged revision draft). It finishes by submitting that edited temporary course. No real course should be supplied.

## Limits and safety

This validates actual content difference, not whether an edit is pedagogically sufficient. It relies on the existing application rule that reviewed versions and media bytes are immutable; it does not repair out-of-band SQL alterations of historical snapshots. A decided snapshot itself cannot be reopened and resubmitted: a revision draft is required. No review decisions are reset or changed.

No shared database records, accounts, schema or migrations were changed. Chatbot/AI/video-recording/theme code is untouched. No commit or push.
