# Server-backed user categories

The account category selectors, onboarding, summaries, profile editing and learner
interest consumers now use database GUIDs. The existing card/search/checkbox layout
and styles are retained. Category labels/descriptions come from the server; demo
category counts and semantic icons cannot be joined safely to GUIDs and are not
presented as authoritative catalog data. Existing course-authoring/demo taxonomy
files are unchanged and are not used to interpret user category selections.

## Connected flows

- The category provider fetches GET /api/categories and uses each returned active
  category's id, nameAr/nameEn and description fields. Ordering does not establish
  identity. Loading, empty, error and retry states are rendered.
- Startup, focus refresh, password login and the existing Google completion screen
  restore GET /auth/session followed by GET /me/categories. Server selections
  replace cached claims. Actual Identity roles are included in account responses.
- Onboarding submits optional learningCategoryIds/teachingCategoryIds through
  PATCH /me with profile metadata. The existing finalization transaction validates
  active GUIDs, stages UserCategory changes, grants the selected learner/instructor
  memberships and initializes the existing welcome wallet atomically. This avoids
  calling membership-protected PUT endpoints before a new account has memberships.
  Only the selected persona's kinds are submitted; administrative roles cannot be
  selected. GUID and nonempty legacy index inputs cannot be mixed.
- Valid password login can now return onboardingRequired=true and an authenticated
  onboarding cookie. Full profile metadata is returned for incomplete sessions so
  names, bios, English names and other fields do not disappear during recovery.
  Login itself grants no memberships or points. APIs still enforce actual roles.
- Profile category edits use PUT /me/categories/learning and /teaching, then PATCH
  /me for metadata and an authoritative session/category reload. The disabled
  persona's category history is retained. Each replacement is atomic; the complete
  sequence of separate HTTP requests is **not** one transaction. On failure the
  UI reports possible partial persistence, refreshes saved server state and keeps
  the editable draft for retry. It never announces success from local storage.
- Role expansion that needs selections uses the existing onboarding screens.
  Existing GET/PUT authorization uses actual Learner/Instructor memberships;
  users with both memberships can edit both kinds. Persona flags or cached roles
  never authorize server writes.

## Legacy caches

Legacy interests/teachingAreas integer arrays are not translated by position,
label, display order or insertion order. They are removed from the editable
category model and marked for explicit reselection. Reconciliation preserves
unrelated profile fields. Old server selections likewise route the user into
onboarding for reselection; saving GUIDs clears the corresponding server index
arrays in the same finalization transaction.

Local/session storage is optional UI caching. An unfinished onboarding form may
cache GUIDs and metadata for the same account only; it is validated against the
active catalog and again by the server on submit. A draft from another account is
not adopted. Browser storage failure does not prevent server-backed operation.
Unconfigured APIs, expired sessions and request failures never produce a local-only
category-save success. Workspace access waits for session restoration when an API
is configured. Logout invalidates the restored in-memory session.

Inactive or deleted selections are not silently remapped. The UI displays an
unavailable-category notice with removal/reselection. A learner must select at
least one active learning category; an instructor needs a teaching category or the
existing custom-skill alternative. Both personas require both applicable conditions.

## Configuration and remaining deployment dependencies

- VITE_API_BASE_URL must identify the backend root, e.g. http://localhost:5206
  for the existing HTTP launch profile, or an HTTPS same-origin gateway prefix
  such as /backend. Account paths use /auth and /me; category catalog paths use
  /api/categories. No additional /api prefix is prepended by the client.
- All API requests use credentials: include, JSON, X-Requested-With and the
  existing timeout/error handling. The backend uses the existing HttpOnly cookie.
- For cross-origin development, Cors:AllowedOrigins must explicitly contain the
  exact frontend origin, including port. The current defaults include
  http://localhost:5174. Use localhost consistently for frontend and API; if using
  127.0.0.1, explicitly configure that origin as well. Vite's existing proxies
  are for AI only; they do not proxy account/category requests.
- Production needs HTTPS. The current SameSite=Lax cookie requires same-site
  frontend/API hosting, preferably a same-origin gateway. Separate-site hosting
  requires a separately reviewed cookie/CSRF deployment policy.
- Fatima must provide the real active category catalog and coordinate the existing
  schema's deployment. Required Identity roles must already be provisioned.
  This change creates no category records, migrations, schemas or database updates.
- Demo course category strings cannot be reliably joined to database GUIDs.
  Learner preference ranking only matches a real course category GUID when one is
  supplied. Course catalog integration and taxonomy ownership remain with Fatima.
  Google OAuth backend endpoints remain outside this change.

## Checks and modified files for this integration task

Backend changes:

- esham.BLL/Interfaces/AccountContracts.cs
- esham.BLL/Services/AccountService.cs
- esham.PL/DTOs/AccountRequests.cs
- esham.PL/DTOs/AccountResponses.cs
- esham.PL/Endpoints/AccountEndpoints.cs
- esham.Tests/AccountCategoryIntegrationTests.cs (new)
- esham.Tests/AccountLoginTests.cs
- esham.Tests/AccountFinalizationTests.cs
- esham.Tests/UserCategoryServiceTests.cs
- USER-CATEGORIES.md and ACCOUNT-FINALIZATION.md (updated handoff notes)

Frontend changes:

- src/App.jsx
- src/context/AccountSessionContext.jsx (new)
- src/context/CategoryCatalogContext.jsx (new)
- src/services/categorySelections.js (new)
- src/services/accountApi.js and googleAuth.js
- src/hooks/useAccountProfile.js
- src/pages/auth/InterestsSetup.jsx, OnboardingPage.jsx, ProfileSetup.jsx,
  SetupComplete.jsx, SignupPage.jsx, LoginPage.jsx, GoogleAuthComplete.jsx
- src/pages/shared/AccountPage.jsx
- src/components/shared/RoleArea.jsx and WorkspaceNavigation.jsx
- src/components/learner/CourseRecommendations.jsx
- src/pages/learner/LearnerDashboard.jsx
- tests/category-selections.test.mjs (new) and tests/frontend.test.mjs
- package.json (includes the new test file) and this document

Commands: dotnet build backend/esham.sln --no-restore;
dotnet test backend/esham.Tests/esham.Tests.csproj --no-restore;
npm --prefix frontend test; npm --prefix frontend run build.

Frontend tests cover API contracts/cookies, legacy reconciliation, catalog order,
session restoration, role failures, invalid GUIDs, request whitelisting, persistence,
draft recovery and bilingual rendering of the existing selection cards. Backend
tests cover transactional GUID onboarding, role mapping, invalid selections,
metadata preservation, welcome-once behavior and resumed onboarding sessions.
SQL Server integration tests remain opt-in and require a separately provisioned
isolated database. No shared-database or live deployment check was performed.

No frontend/backend package versions, course/category business logic, schema or
20 welcome / 20 enrollment / 20 instructor reward policy was changed. Enrollment
implementation is explicitly excluded.
