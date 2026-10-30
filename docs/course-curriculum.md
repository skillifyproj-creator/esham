# Draft Course Sections and Lessons

Implemented on top of main commit `d36c73044d326c7d228501176875154c78d66d6a`.
The pull was a fast-forward. Restoring the in-progress work produced no conflicts;
`Program.cs` merged automatically. The pre-sync stash is retained as a backup.
Mais's account, user-category, admin, notification, router and context changes remain intact.

## API

All routes require the authenticated Instructor Identity membership and ownership of the course.
The base path below is `/api/courses/{courseId}/draft/sections`.

| Method | Relative path | Behavior |
| --- | --- | --- |
| GET | (base) | Current editable draft sections, ordered, with ordered lessons |
| POST | (base) | Create section; returns 201 |
| PUT | `/{sectionId}` | Replace section title/order |
| DELETE | `/{sectionId}` | Delete empty section only |
| PUT | `/reorder` | Reorder all current draft sections |
| GET | `/{sectionId}/lessons` | List ordered lessons in that draft section |
| POST | `/{sectionId}/lessons` | Create lesson; returns 201 |
| PUT | `/{sectionId}/lessons/{lessonId}` | Replace lesson metadata |
| DELETE | `/{sectionId}/lessons/{lessonId}` | Delete a lesson without dependent records |
| PUT | `/{sectionId}/lessons/reorder` | Reorder all lessons in that section |

Section writes accept `titleAr`, `titleEn`, `sortOrder`. Lesson writes additionally accept
`descriptionAr`, `descriptionEn`, `contentType` (`video` or `article`), `durationSeconds`,
`isPreview`, `objectives` (`[{ar,en}]`) and `primaryVideoMediaAssetId`.
PUT is replacement, not PATCH; clients must retain existing values they want to preserve.
Reorders accept `{ "ids": ["GUID", "GUID"] }` containing every sibling exactly once;
the array positions become nonnegative, zero-based sort orders. Ordinary title/metadata
writes allow nonnegative order values and reads break equal-order ties by ID.

At least one localized title must be nonblank; each title is limited to 200 characters.
Descriptions are limited to 10,000 characters; up to 50 localized objectives are allowed,
each with nonblank localized text and at most 2,000 characters per language.
Duration is optional and must be finite and positive when supplied.
Video references must identify a video media asset owned by the instructor.
Unrecognized request properties are rejected; version/ownership IDs cannot be supplied in write bodies.

All references are resolved through the course's current DraftVersion and requested section.
Missing drafts, non-draft review statuses, an approval timestamp, a published draft pointer,
or a mismatched course/version reject access. Historical content is never modified by these routes.
Deleting a section with lessons or display tasks returns 409. Deleting a lesson with attachments,
learner progress or reports returns 409. Deleting a lesson never deletes its media asset.
Writes run in serializable transactions, lock the course before its children on SQL Server,
update draft/course timestamps, and allow EF to retry transient failures with fresh tracking.
Generated create IDs are stable across execution-strategy retries.

## Frontend

The existing layouts are retained in `InstructorCoursesPage`, `CreateCoursePage`,
`CourseCurriculumPage` and `EditLessonPage`. The first two now use the existing Courses API
so curriculum routes receive database course IDs rather than demo keys or `new`.
`curriculumApi.js` reuses `apiBase` from Mais's account API helper, sends cookies and application
headers, and surfaces validation/conflict errors. Server reads load curriculum on entry/refresh;
mutations reload it after success. Section and lesson move/delete controls are provided.
Arabic/English lesson metadata and objectives are preserved when editing either language.
Old demo/localStorage curriculum helpers remain available to unrelated mock pages.

Course Tasks are now integrated; see [Course Tasks](course-tasks.md). Media uploads/attachments
and review/publication remain separate features. Local-only lesson attachment/video upload
controls are unavailable until their own APIs are integrated. The course cover picker still belongs to
the existing basic-course form; this feature adds no media-upload endpoint.

## Validation and reproducibility

Final results: backend build succeeded with zero warnings/errors; backend tests passed
172 with 16 existing opt-in isolated-SQL-Server tests skipped; frontend build passed and
all 84 frontend tests passed. Swagger exposes all 10 operations. The real SQL Server API
check (including concurrent writes) and complete Edge browser flow passed. Test records
were cleaned up. Existing Vite dependency-directive and development WebSocket-port warnings
did not prevent these checks.

- `dotnet build backend/esham.sln --no-restore`
- `dotnet test backend/esham.Tests/esham.Tests.csproj --no-restore`
- `npm --prefix frontend run build`
- `npm --prefix frontend test`

`CurriculumServiceTests.cs` covers owner/role enforcement, editable status, published/historical
versions, cross-course/cross-section access, metadata validation, complete-set reordering,
delete dependencies and preservation of media/tasks. `curriculum.test.mjs` covers adapters,
cookie requests, exact course routing and server validation/conflict messages. The existing
instructor rendering test now expects loading states for API-backed pages.

The standalone API and browser scripts in `frontend/scripts/verify-curriculum*.cjs` use
`ESHAM_TEST_EMAIL`, `ESHAM_TEST_PASSWORD`, `ESHAM_TEST_COURSE_ID`, and `PLAYWRIGHT_MODULE`
(path to an installed Playwright module). Optional `ESHAM_TEST_API` and `ESHAM_TEST_FRONTEND`
default to ports 5206 and 5173. The browser script uses installed Microsoft Edge headlessly.
Credentials are never included in repository files. Both scripts delete only their own test
content; the API script restores pre-existing section sort values.

The supplied test account required onboarding after the main sync. With explicit user
authorization, setup was completed with username `fatima_instructor_test`, the existing
course's Programming teaching category, and goal index 0; its persona, Identity membership
and course ownership were preserved. The confirmed database course ID is
`c3458817-31ce-4064-8730-99ea57ff482b`; the originally supplied `31ca` segment was a typo.

No migration was created or applied, and no schema changes were needed.
There is no Sections/Lessons prerequisite blocker for starting Course Tasks. Tasks should
use the same ownership/current-draft boundary and respect DisplaySection relationships.

## Changed files

- `backend/esham.BLL/DTOs/Courses/CurriculumDtos.cs`
- `backend/esham.BLL/Interfaces/ICurriculumService.cs`
- `backend/esham.BLL/Services/CurriculumService.cs`
- `backend/esham.PL/Endpoints/CurriculumEndpoints.cs`
- `backend/esham.PL/Program.cs` (only curriculum registration/mapping)
- `backend/esham.Tests/CurriculumServiceTests.cs`
- `frontend/src/services/curriculumApi.js`
- `frontend/src/pages/instructor/InstructorCoursesPage.jsx`
- `frontend/src/pages/instructor/CreateCoursePage.jsx`
- `frontend/src/pages/instructor/CourseCurriculumPage.jsx`
- `frontend/src/pages/instructor/EditLessonPage.jsx`
- `frontend/tests/curriculum.test.mjs`
- `frontend/tests/frontend.test.mjs` (loading expectations)
- `frontend/package.json` (append curriculum tests; retain Mais's suites)
- `frontend/scripts/verify-curriculum-api.cjs`
- `frontend/scripts/verify-curriculum.cjs`
- `docs/course-curriculum.md`
