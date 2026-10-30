# Course Tasks implementation report

Tasks belong to the current editable CourseVersion. DisplaySectionId is optional placement,
not ownership. There is no task-per-lesson or task-per-section restriction. No migration was
created/applied, and no entity, EF mapping, snapshot or database schema was changed.
The existing Sections/Lessons work and Mais's account/category/admin/notification integrations
are preserved. Enrollment, wallets, notifications and learner flows were not modified.

## Endpoints

All paths below are relative to `/api/courses/{courseId}/draft/tasks` and require the actual
Instructor Identity membership and ownership of the course.

| Method | Path | Behavior |
| --- | --- | --- |
| POST | base | Create a task (201) |
| GET | base | Ordered draft tasks |
| GET | `/{taskId}` | Read one task in this draft |
| PUT | `/{taskId}` | Replace task fields |
| DELETE | `/{taskId}` | Delete task without dependent records |
| PUT | `/reorder` | Complete-set reorder |
| GET | `/readiness` | Task-count readiness for later submission |

Writes accept `titleAr`, `titleEn`, `descriptionAr`, `descriptionEn`, `instructions: {ar,en}`,
`requirements: [{ar,en}]`, `sortOrder`, nullable `displaySectionId`, and `isReady`.
PUT replaces fields; clients must send existing values they want to retain. Unknown body
fields are rejected, including attempts to set CourseVersionId or ownership.

## Rules

- Access uses the same ownership/current-draft guard as Sections/Lessons, including approval
  timestamps and published-version pointer protection. All task queries are scoped to the
  resolved DraftVersionId; historical or other-course task IDs return 404.
- Non-draft, published/approved, or missing drafts reject operations. GeneralAdmin alone
  does not grant task-edit access.
- DisplaySectionId must identify a section in that same draft. It can be assigned or cleared
  without changing task ownership. Multiple tasks can share a display section.
- At least one localized title is required, at most 200 characters per language. Descriptions
  and instructions are limited to 10,000 characters per language. Requirements allow at most
  50 localized entries, each nonblank and at most 2,000 characters per language.
- Partial task content is allowed in drafts. Marking an individual task ready additionally
  requires a description, instructions and at least one assessment requirement.
- SortOrder must be nonnegative. Reorder accepts `{ids:[...]}` containing every draft task
  exactly once; foreign, duplicate, omitted and missing IDs are rejected. Positions become
  zero-based consecutive orders; ordinary equal orders use stable ID tie-breaking.
- Normal draft create/update/delete permits zero tasks and more than three tasks. Count
  readiness is a separate check; it never prevents saving or editing the draft.
- Deletion refuses tasks with TaskAttachments or TaskSubmissions (409); it never cascades
  into historical, learner or media data.
- Writes reuse serializable transactions, the per-course SQL Server update lock and EF
  transient retry behavior. Generated create IDs are stable across retries. Course/draft
  update timestamps change only on successful mutations.

## Frontend

`CourseCurriculumPage` displays a course-wide task panel using the existing curriculum card
styles. Tasks show optional section placement and assessment-ready state. Create/edit/delete
and up/down ordering persist through cookie-authenticated APIs using the existing apiBase
derived from VITE_API_BASE_URL. Counts and readiness reload from the server.

`InstructorTaskPage` retains its existing header, form/card/sidebar and modal structure.
Localized fields and requirements are preserved when switching languages. A real-draft section
selector supports optional placement and unassignment. It supports partial draft saves,
validation/server errors, busy/loading/empty states, previews and confirmed deletion.

New course-level routes are `/instructor/courses/:courseId/tasks/new` and
`/instructor/courses/:courseId/tasks/:taskId/edit`. Existing section-based task routes remain
compatible; on create the section is only an initial placement selection. The lesson editor
links to course tasks and does not create lesson-owned tasks.

The old local/demo task helpers remain for unrelated mock flows. The connected task editor
does not write localStorage or pretend to upload attachments. The model has no SubmissionType
field, so accepted submission formats belong in Instructions until that feature is defined.

## Readiness and next phases

`ICourseTaskService.GetReadinessAsync` returns `{taskCount, meetsTaskCount, minimumTasks:1,
maximumTasks:3}` with the same owner/draft authorization as task reads. The pure reusable
`CourseTaskService.CheckTaskCount` supplies the 1–3 predicate independently of API access.
All CourseTask records are assessed practical tasks; no optional-exercise model was introduced.
This is deliberately count readiness, not a claim that the entire course is ready to submit.
Later submission logic can use the predicate inside its own transaction and combine it with
metadata, curriculum, media and individual assessment checks. Full Submit for Review was not
implemented. There is no Course Tasks prerequisite blocker for Media/Attachments or submission;
their upload, readiness, review-transition and publication workflows remain separate work.

## Tests and verification

- Backend build: passed, zero warnings/errors.
- Backend suite: **194 passed, 16 skipped, 0 failed**. Skips are the existing opt-in isolated
  SQL Server tests, whose test database is not configured.
- Added **22 backend task test cases**: role/ownership, noneditable/missing drafts, CRUD,
  historical/other-course rejection, optional placement, field validation, exact reorder,
  protected deletion and 0/1/2/3/4/5-task readiness. Editing and deleting remain possible
  regardless of the draft's task count.
- Frontend build: passed. Frontend suite: **86 passed, 0 failed**, including two new task API
  contract tests. Existing render tests now expect the task editor's real loading state.
- Swagger: all seven operations visible with request/response models and error statuses.
- Real SQL Server + Edge browser: passed login with the previously onboarded instructor,
  open owned draft, create/edit tasks, assign/unassign section, reorder, refresh and fresh API
  reads, preserve instructions/requirements/readiness, and editor/list deletion.
- Real API checks also confirmed anonymous 401, missing task 404, invalid placement/reorder
  400, saving more than three tasks, and count readiness failing above three.
- Temporary tasks and placement section were deleted; the original task list was confirmed
  restored. Account role, ownership and onboarding data were not changed for this feature.

Reproduce with `dotnet build backend/esham.sln --no-restore`,
`dotnet test backend/esham.Tests/esham.Tests.csproj --no-restore`,
`npm --prefix frontend run build`, and `npm --prefix frontend test`.
The browser script `frontend/scripts/verify-course-tasks.cjs` uses ESHAM_TEST_EMAIL,
ESHAM_TEST_PASSWORD, ESHAM_TEST_COURSE_ID and PLAYWRIGHT_MODULE, with installed Microsoft Edge.
The verified existing course ID is `c3458817-31ce-4064-8730-99ea57ff482b`. No credentials are
stored in repository files.

## Files added or changed for Course Tasks

- `backend/esham.BLL/DTOs/Courses/CourseTaskDtos.cs`
- `backend/esham.BLL/Interfaces/ICourseTaskService.cs`
- `backend/esham.BLL/Services/CourseTaskService.cs`
- `backend/esham.BLL/Services/CurriculumService.cs` (share the existing internal draft guard)
- `backend/esham.PL/Endpoints/CourseTaskEndpoints.cs`
- `backend/esham.PL/Program.cs` (task service registration and endpoint mapping)
- `backend/esham.Tests/CourseTaskServiceTests.cs`
- `frontend/src/services/courseTasksApi.js`
- `frontend/src/components/instructor/CourseTasksPanel.jsx`
- `frontend/src/pages/instructor/InstructorTaskPage.jsx`
- `frontend/src/pages/instructor/CourseCurriculumPage.jsx`
- `frontend/src/pages/instructor/EditLessonPage.jsx`
- `frontend/src/App.jsx` (two additional instructor routes; existing routes/providers retained)
- `frontend/tests/course-tasks.test.mjs`
- `frontend/tests/frontend.test.mjs` (task loading expectation)
- `frontend/package.json` (append task tests; retain all existing test suites)
- `frontend/scripts/verify-course-tasks.cjs`
- `docs/course-tasks.md`
- `docs/course-curriculum.md` (update the previous next-feature note)
