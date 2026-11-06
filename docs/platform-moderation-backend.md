> Public technical handoff. Operational identities, recovery evidence and database-specific scripts are intentionally kept outside version control. Verification counts below are historical snapshots; see README for current startup and regression commands.

# Announcements and course-safety backend handoff

Completed locally November 6, 2026, continuing the existing uncommitted working tree. No commit or push.

## Runtime and database readiness

- No new entity/table/column/migration was introduced by this implementation. Existing Announcement, CourseReport, CourseWarning, CourseAppeal, AdminActivityLog and Notification models were reused.
- Restarted the verified old backend, then deployed the final local build to http://localhost:5206. Swagger is available at http://localhost:5206/swagger.
- Added SeedData:Enabled opt-out (default remains true for compatibility); this run explicitly sets SeedData__Enabled=false and SeedData__DemoCourses=false. Thus startup performs no role/catalog/demo seeding and preserves existing data. User Secrets and committed connection configuration were not changed.
- Frontend http://localhost:5173 remains running with existing configuration. Separate LocalDB-backed verification servers on localhost:5216 and localhost:5175 remain running; their data is isolated from hosted databases.

## Completed features

### Announcements

GeneralAdmin can create/edit drafts, publish/unpublish them and archive them without deleting records. A content/state fingerprint provides optimistic concurrency protection; serialized updates reject stale versions. Published content must be returned to draft before editing. Archived announcements cannot be edited or republished.

Real audience filtering uses current Identity memberships: all, learners or instructors. Guests see only published all-audience announcements. Private drafts/archives are accessible only to GeneralAdmin. Public announcements are a persisted feed; no automatic inbox fan-out or push delivery was added.

All announcement mutations create AdminActivityLog entries atomically. The existing Admin announcements route now uses the real service, preserves the Admin shell and replaces local deletion with archiving.

### Course reports

Authenticated users can report accessible approved course content. The server records actual reporter identity and observed CourseVersionId, with optional version-bound lesson/media references. Non-preview lesson/media reports require existing owned/enrolled access. Same-user, same-version, same-reason open duplicates return conflict.

Report reasons reuse harmful/inappropriate/misleading/copyright/other. Description length is 20–2000; closing feedback is 10–4000 characters. Moderators can start investigation, resolve or dismiss a report using expected current status. Closed reports retain their observed content and cannot be overwritten through another outcome.

GeneralAdmin has cross-category access. CategoryAdmin lists are restricted by active assignments to the observed version category; mutation also disallows course-owner self-moderation. Opening or closing a report never automatically warns, pauses or archives a course.

The real course-details page now includes the existing report component, connected to these APIs. Reporter identity is never taken from a client display-name or local profile string.

### Course warnings and suspension

A moderator must explicitly confirm evidence and supply a distinct incident key, reason, required correction and current/future deadline. Warning media/report references must belong to the same observed course/version. CategoryAdmin cannot moderate an unsubmitted draft; GeneralAdmin has oversight scope, with course-owner self-moderation still blocked.

Course-row locking serializes incident deduplication and warning numbering across instances. Existing unique indexes enforce (CourseId,IncidentKey) and (CourseId,WarningNumber). Warning evidence is immutable.

- Warning 1: retain existing safety/enrollment state.
- Warning 2: pause new enrollment.
- Warning 3: archive course and keep enrollment paused.
- Reject warning 4 or duplicate incidents. Preserve all historical course versions, learner work, media, enrollments and wallets.

Explicit urgent suspension requires verified evidence and a 10–2000 character reason; it suspends an active course and pauses enrollment without creating a fake warning. Safety changes never alter a publication pointer or trigger a new fee.

Warning/suspension writes, owner notifications and activity records commit in the same transaction. Warning notice IDs are deterministic and duplicate requests cannot create additional warnings/notifications.

### Course appeals

Only the owner Instructor can appeal a warning belonging to that course. One appeal is permitted per warning; duplicate submissions return conflict and history remains intact. Explanation and final-decision feedback require 10–4000 characters.

**Confirmed owner policy: only GeneralAdmin makes final appeal decisions.** An assigned CategoryAdmin cannot decide an appeal. Only pending appeals accept a final accepted/rejected outcome; racing/duplicate final decisions conflict. Owner notification and activity persist atomically.

Acceptance/rejection records the final outcome; it does not erase immutable warnings, reset warning counts or automatically reactivate an archived/suspended course. A reinstatement workflow/policy was not confirmed and was intentionally not invented. There is currently no new reinstatement endpoint.

The existing Instructor review page includes the reused real safety/appeal component. Existing Admin/CategoryAdmin moderation pages display reports plus warning/appeal cases, including cases without open reports. GeneralAdmin sees final-decision controls; assigned CategoryAdmins see scoped investigation/warning controls.

### Admin activity

The real activity endpoint combines existing user-management/review records with new announcement/report/warning/suspension/appeal events. GeneralAdmin can read all events; CategoryAdmin sees only actively assigned category events. Global announcement/account events are not exposed through CategoryAdmin scope. Results are bounded to the latest 200 events. Both existing activity routes now use the persisted service.

## Endpoints

Private endpoints require Identity authentication. Services independently load current database roles and reject locked accounts/forged role claims. Mutation endpoints also reuse AdminMutationFilter for the application header and trusted-origin checks.

| Method | Endpoint | Permission / purpose |
| --- | --- | --- |
| GET | /api/announcements | Published audience-filtered feed; guests receive all-audience only |
| GET | /api/admin/announcements | GeneralAdmin draft/published/archive list |
| POST | /api/admin/announcements | GeneralAdmin create draft |
| PUT | /api/admin/announcements/{id} | GeneralAdmin edit current draft; expectedVersion |
| PUT | /api/admin/announcements/{id}/status | GeneralAdmin publish/unpublish/archive; status + expectedVersion |
| GET | /api/course-reports | GeneralAdmin or actively assigned CategoryAdmin queue |
| GET | /api/course-reports?mine=true | Current authenticated user's reports |
| POST | /api/courses/{courseId}/reports | File report; observed approved version and available-content checks |
| PUT | /api/courses/{courseId}/reports/{reportId} | Independent scoped moderator; status, resolution, expectedStatus |
| GET | /api/course-safety | Scoped warning/appeal case queue |
| GET | /api/courses/{courseId}/safety?versionId=... | Owner or scoped moderator; persisted history and server permission flags |
| POST | /api/courses/{courseId}/warnings | Explicit verified warning; scoped moderator |
| POST | /api/courses/{courseId}/suspend | Explicit urgent verified suspension; scoped moderator |
| POST | /api/courses/{courseId}/appeals | Owner Instructor only |
| POST | /api/courses/{courseId}/appeals/{appealId}/decision | GeneralAdmin final decision only |
| GET | /api/admin/activity | Persisted, role/category-scoped activity |

Existing CourseReviewService submission, revision, decision, publishing, historical snapshots and course-version update endpoints are retained. GeneralAdmin retains cross-category course-review oversight; course approval/rejection remains assigned CategoryAdmin work under the existing review policy. New appeal authority does not broaden publishing authority.

## Verification results

| Check | Result |
| --- | --- |
| Backend final build | Passed; zero warnings/errors |
| Backend complete unit/regression suite | 306 passed, 24 opt-in SQL checks skipped, zero failed |
| New isolated SQL integration suite | 4 passed: warning deduplication race, post-save rollback, competing appeal decisions, announcement stale-version race/query translation |
| Frontend suite | 105 passed, zero failed |
| Frontend production build | Passed; existing dependency use-client bundling warnings remain |
| Isolated API/browser workflow | Passed announcements, real report UI, category scope, report investigation, explicit warning, duplicate rejection, owner appeal, GeneralAdmin-only final decision, second/third warning escalation and persisted activity |
| Responsive/browser checks | 12 passed: existing announcements/moderation/Instructor review pages in Arabic RTL and English LTR at 1440px and 390px; no horizontal overflow or JavaScript errors; Admin layouts retain no Footer |
| Existing review/publishing HTTP flow | Submit, assigned review and approved version publication passed on temporary isolated course only |
| Shared live Swagger/API | Swagger 200 with 70 paths including all new routes; public announcements/categories/catalog 200; guest private endpoints 401 |
| Patch formatting | git diff --check passed |



## Files changed in this continuation

Backend:
- esham.BLL/DTOs/Moderation/PlatformModerationDtos.cs
- esham.BLL/Services/ModerationAccess.cs
- esham.BLL/Services/AnnouncementService.cs
- esham.BLL/Services/CourseSafetyService.cs
- esham.BLL/Services/AdminActivityService.cs
- esham.PL/Endpoints/PlatformModerationEndpoints.cs
- esham.PL/Program.cs (DI/routes and startup seed opt-out)
- esham.Tests/PlatformModerationTests.cs
- esham.Tests/PlatformModerationSqlTests.cs

Frontend:
- src/services/platformModerationApi.js
- src/components/admin/AnnouncementsPanel.jsx
- src/components/shared/CourseSafetyPanel.jsx
- src/components/learner/ReportCourseButton.jsx
- src/pages/CourseDetailsPage.jsx
- src/pages/instructor/CourseReviewPage.jsx
- src/pages/shared/ModerationQueuePage.jsx
- src/pages/shared/CourseReviewActivityPage.jsx
- src/pages/admin/SuperAdminModule.jsx
- tests/platform-moderation.test.mjs
- scripts/verify-platform-moderation.cjs
- package.json (include the new tests)

Docs: this report and the current-status reference in course-moderation-publishing.md.

Earlier working-tree edits, including video-source polish, were preserved rather than reverted or extended.

## Remaining work and boundaries

- Confirm a reinstatement policy/process before enabling any automatic/manual API transition out of suspended/archived state after an accepted appeal.
- Mais's remaining learner write workflows must continue honoring course safety/enrollment pause flags and the existing version-availability contracts; this implementation does not replace her enrollment/progress/submission/certificate services.
- Existing unrelated preview analytics remain separate; these results claim only the connected features listed above.
- Existing client-only safety/report helper modules are no longer used by the connected production components; their pure helper tests remain for compatibility. They do not authorize backend actions.
- No new migration is required. No shared mutation smoke test is necessary to demonstrate persistence; repeat mutations only with isolated fixtures.
- Owner reviews changes before any commit or push.
