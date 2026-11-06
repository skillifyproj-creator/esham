> Public technical handoff. Operational identities, recovery evidence and database-specific scripts are intentionally kept outside version control. Verification counts below are historical snapshots; see README for current startup and regression commands.

# Real Admin business-data integration


## Completed

The existing GeneralAdmin Dashboard and Reports now consume real overview aggregates, category metrics, Identity-backed administrator candidates and persisted activity. All `superAdminDemo`, `usePersistentState` and `esham-admin-*` business-record dependencies were removed from the routed GeneralAdmin provider. Existing API-backed users, announcements, review/moderation queues and CategoryAdmin pages remain in place; routes, shared admin design, footer exclusion, sidebars and permission guards were preserved. No learner, instructor, chatbot or video source was modified for this task.

Category creation/editing now uses the existing CategoryService CRUD endpoints. The existing dialog supports required Arabic/English names, descriptions, parent and display order, plus existing CategoryAdmin selection. Category activation/deactivation uses the existing PATCH endpoint. The list includes inactive categories and real distinct-course/learner counts. Names and assignment candidates are real database records, not browser-generated IDs or fake accounts.

## Endpoints

New service: `AdminIntegrationService`; new endpoint registration: `AdminIntegrationEndpoints`.

| Method | Path | Permission / behavior |
| --- | --- | --- |
| GET | `/api/admin/overview` | GeneralAdmin; distinct-course totals and status distribution, pending revisions, category/enrollment/distinct-learner totals |
| GET | `/api/admin/categories` | GeneralAdmin sees all categories including inactive; CategoryAdmin sees only currently active assignments; real category metadata and counts |
| GET | `/api/admin/category-admins` | GeneralAdmin only; candidates must already hold the actual Identity CategoryAdmin role |
| GET | `/api/admin/categories/{id}/assignments` | GeneralAdmin only; active user IDs and assignment version |
| PUT | `/api/admin/categories/{id}/assignments` | GeneralAdmin only; `{ userIds, expectedVersion }`; replaces active category assignments without deleting history or changing account roles |

Reused existing routes: POST `/api/categories`, PUT `/api/categories/{id}`, PATCH `/api/categories/{id}/status`, GET `/api/admin/activity`, and real Identity directory APIs. All writes use the existing authenticated application request header/origin pattern where supported; new assignment writes reuse AdminMutationFilter.

No existing endpoint contract was replaced. Existing public category reads remain public and active-only. CategoryAdmin queue/detail/review/moderation authorization continues to use current active CategoryAdminAssignments.

## Metric definitions

- Total courses is one row per Course, including courses with unsubmitted drafts and courses with no version pointers. Historical submitted/approved CourseVersion rows never inflate the total.
- Exclusive distribution: published when the current PublishedVersion pointer targets an approved version; otherwise current draft review status, falling back to draft. An old approved version without a publication pointer does not count as published. Publication counts describe retained publication records; they do not override course safety/availability rules.
- Pending-review indicator counts distinct courses whose current draft is pending, including revisions to already published courses. This indicator can overlap published courses; the distribution itself is exclusive.
- Reports include draft, pending, rejected, changes-requested, approved-unpublished and published categories.
- Course/category grouping uses the current published category first, otherwise the current draft category. Courses with neither pointer are uncategorized. Historical version categories do not duplicate courses.
- Category learner count is distinct learner IDs in enrollments for courses currently grouped under that category. Enrollment statuses are not rewritten and no completion/reward business rules are inferred.
- Dashboard/report activity comes from existing persisted AdminActivityLogs; empty activity is shown honestly rather than replaced with demo events. The existing activity endpoint limit remains in effect.

## Assignment safety

Canonical Identity membership and current lockout are read from the database; role claims/client flags cannot grant authority. CategoryAdmin cannot list candidate accounts, read assignment management state or write assignments. They cannot expand their own scope. Every selected user must already have CategoryAdmin membership; ordinary/unknown users and duplicate/malformed selections are rejected. No UserManager role-grant operation exists in this service.

Writes run in a retry-aware serializable transaction and lock the existing category row with UPDLOCK/HOLDLOCK. A SHA256 version of current assignment records rejects stale forms. Existing assignments are activated/deactivated; historical rows are retained. Actual scope changes and an immutable AdminActivityLog record commit together. No-op saves do not create duplicate activity. Simultaneous actual changes from the same version commit one change and reject the other. No new tables, columns, entities or migration are needed.

## Honest UI states and limitations

The provider clears old data on identity/reload changes, aborts late requests and presents loading/error/retry states instead of fake statistics. No browser business records are created or updated. Existing old browser cache keys are ignored, not silently deleted.

Category metadata and assignments use separate APIs. If metadata saves but assignment saving fails, the dialog explicitly reports that partial result and retains the real category ID, avoiding a second create on retry. Close/reopen reloads the latest assignment version after conflicts. These two saves are not claimed to be one atomic operation. Duplicate-name checking is retained on the client against the loaded server list; the existing category backend validation/hierarchy rules remain authoritative.


## Changed files for this task

- `backend/esham.BLL/Services/AdminIntegrationService.cs` (new)
- `backend/esham.PL/Endpoints/AdminIntegrationEndpoints.cs` (new)
- `backend/esham.PL/Program.cs` (service/route registration)
- `backend/esham.Tests/AdminIntegrationTests.cs` (new)
- `frontend/src/services/adminIntegration.js` (new)
- `frontend/src/pages/admin/SuperAdminModule.jsx`
- `frontend/src/pages/admin/AdminUsersPage.jsx` (scope-management helper text)
- `frontend/src/i18n/adminCopy.js` (additional status translations)
- `frontend/tests/admin-integration.test.mjs` (new)
- `frontend/scripts/verify-admin-integration.cjs` (new)
- `frontend/package.json` (test registration)
- This document and a follow-up note in the original audit.

## Verification

- Backend build: passed with zero warnings/errors.
- Backend regression: 314 passed, 26 opt-in SQL tests skipped.
- Focused integration suite with explicit LocalDB opt-in: all four passed (three in-memory plus one SQL test), covering distinct-course/draft/historical-version semantics, fresh role authorization, category scope, stale versions, immutable role memberships, no-op audit deduplication and concurrent scope updates.
- Frontend regression: 109 passed. Production build passed; pre-existing third-party use-client warnings / test HMR port warnings remain non-fatal.
- Browser: real isolated category create, edit, deactivate, assignment grant/revoke, user/role preservation, unauthorized401/403 and stale409 passed. Mutations were limited to a newly created category in the existing guarded disposable LocalDB database. No shared account was logged into or changed.
- 16 Arabic RTL/English LTR desktop/mobile checks passed for Dashboard, Reports, Categories and the CategoryAdmin queue; loading/empty/API error states showed no demo fallback. Four additional bilingual desktop/mobile category-dialog checks passed with mutations blocked. Screenshots were saved under OS temp as `esham-admin-integration-*` / `esham-admin-category-form-*`.
- Backend restarted on http://localhost:5206 with existing User Secrets and all startup seeding disabled. Swagger lists the new operations. Frontend remains on http://localhost:5173/.
- No accounts, GeneralAdmin memberships, shared domain records or schema were modified; no commits/pushes.

GeneralAdmin-only CategoryAdmin account creation supports atomic initial category assignments. Password recovery/invitation delivery and large-directory pagination remain separate work.
