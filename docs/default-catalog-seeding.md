# Default categories and development catalog

## Result and IDs

The running HTTP backend now returns six active default categories and 12 published demo
courses. Programming reused its existing database ID; no category, user selection or real
course reference was moved to another ID.

| Order | Arabic / English | Database category ID |
| --- | --- | --- |
| 1 | البرمجة / Programming | `f27472b2-acb5-4d4e-bcdf-90a547aa36af` (reused) |
| 2 | التصميم / Design | `e5a00001-0000-4000-8000-000000000002` |
| 3 | التصوير / Photography | `e5a00001-0000-4000-8000-000000000003` |
| 4 | التسويق / Marketing | `e5a00001-0000-4000-8000-000000000004` |
| 5 | الحرف والفنون / Crafts & Arts | `e5a00001-0000-4000-8000-000000000005` |
| 6 | الأعمال وتطوير الذات / Business & Personal Development | `e5a00001-0000-4000-8000-000000000006` |

On a completely empty database, Programming receives reserved ID
`e5a00001-0000-4000-8000-000000000001`; the initializer always prefers reusing a matching
existing record. All IDs remain stable after initialization. User-created categories remain
present, so another installation can have more than six total categories while still having
exactly these six defaults.

## Initialization and duplicate prevention

`DefaultCategorySeeder` runs on ordinary application startup in every environment, using
the current schema. It matches existing root categories by trimmed Arabic or case-insensitive
English name, or by their reserved ID. It only canonicalizes the six default labels, activates
them and sets display orders 1–6; descriptions, existing IDs and unrelated records are preserved.
It does not delete/merge categories. Ambiguous pre-existing matches or a reserved ID belonging
to a different category stop initialization rather than overwrite user data.

Initialization uses an EF execution strategy, a serializable transaction and a SQL Server
transaction-owned application lock (`Esham.DefaultCatalog.v1`). Two overlapping startups
serialize their checks/inserts. Repeated startups do not duplicate rows or update timestamps
when the defaults already match. No EF HasData, migration, Migrate or EnsureCreated call was
added, and no schema/snapshot changes were made.

`DemoCourseSeeder` runs only in Development, unless `SeedData:DemoCourses=false` (environment
variable `SeedData__DemoCourses=false`). This switch prevents future initialization; it does
not delete previously created demo records. Production startup does not create demo courses.

The designated owner is `catalog-demo@seed.esham.invalid`, ID
`e5a00002-0000-4000-8000-000000000001`, username `esham_catalog_demo`. It has only Instructor
membership, no password, and is locked out. No real user's ownership is used or reassigned.
An existing account occupying the reserved identity/email is never adopted automatically.
The initializer does not call onboarding finalization or create wallets/notifications.

Course IDs are fixed `e5a00003-0000-4000-8000-000000000001` through `...000012`; version IDs
use the `e5a00004` prefix, section/lesson/task IDs use `e5a00005`/`e5a00006`/`e5a00007`.
These stable IDs and the same startup lock prevent duplicate demo courses. Existing demo
publications are not rewritten or republished on later starts, including any manual edits.

## Sample courses created

Titles are explicitly prefixed `[تجريبي]` / `[Demo]` in the database.

| Category | Sample titles |
| --- | --- |
| Programming | أساسيات البرمجة / Programming Basics; مقدمة في تطوير الويب / Introduction to Web Development |
| Design | أساسيات التصميم / Design Fundamentals; مقدمة في تصميم واجهات المستخدم / Introduction to UI Design |
| Photography | أساسيات التصوير / Photography Basics; تصوير المنتجات / Product Photography |
| Marketing | أساسيات التسويق الرقمي / Digital Marketing Basics; صناعة المحتوى / Content Creation |
| Crafts & Arts | أساسيات الرسم / Drawing Basics; الحرف اليدوية للمبتدئين / Handmade Crafts for Beginners |
| Business & Personal Development | إدارة الوقت / Time Management; مهارات التواصل / Communication Skills |

Each sample uses the real Course/CourseVersion model: version 1 is approved, has submitted/
approved timestamps and the matching category; PublishedVersionId points to that version,
DraftVersionId is null, and SafetyStatus is active. A localized section, article lesson,
objective and practical task supply identifiable sample content. This is explicit development
fixture publication, not an Instructor approval endpoint or a bypass in the real review flow.
EnrollmentPaused is true, descriptions identify samples as demonstrations, and there are no
fake enrollments, reviews, balances, notifications or media uploads. The existing public
eligibility query determines visibility without changes to its authorization/filter rules.

## Frontend sources of truth

- Existing Learner/Instructor/Both onboarding selectors already use CategoryCatalogContext
  and the real Categories API; seeding makes all six available without another static list.
- Home category exploration/quiz options and course filters now use those same category IDs
  and bilingual backend labels. Course creation already loads the API's categories.
- PublicCatalogProvider loads only `/api/courses/public`, with cookie credentials and the
  existing VITE_API_BASE_URL. Empty/error responses never fall back to demo/localStorage rows.
- Home, paginated public catalog, recommendations, learner dashboard recommendations and
  the chatbot's supplied platform catalog use these real published records.
- CourseCard retains its existing classes/layout. It shows backend category/title/instructor
  data, and omits unavailable ratings, lesson counts and point values rather than inventing
  them. Thumbnail placeholders are used until Media/Attachments provides public media URLs.
- Public course detail links resolve the real GUID through `/api/courses/public/{id}` and
  show published metadata/objectives/related backend courses. The public API currently exposes
  metadata, not the full published-learning/enrollment workflow; those actions are not simulated
  using the old local points/enrollment store.
- Instructor dashboard course count/attention rows and certificate course cards use the
  existing owner-scoped `/api/courses/mine`; demo-owned courses are not listed as a real user's
  courses. No fake demo activity rows are presented as actual course activity.
- Learner course/dashboard display rows are constrained to backend-known course IDs. Existing
  enrollment/task state and storage are untouched; legacy numeric demo enrollment rows are
  not displayed as real catalog courses. Full backend enrollment/progress integration remains
  separate work and was not fabricated here.

Static data/helpers remain for isolated legacy learning previews/tests and unrelated unintegrated
features. They are not merged into the public catalog, its cards, or the connected course lists.
No enrollment, wallet, notification, account authorization or admin-management logic was changed.
Other unrelated dashboard analytics remain outside this catalog integration.

## Verification

- Backend build passed with zero warnings/errors; **212 backend tests passed, 16 existing
  opt-in isolated SQL Server tests skipped**. Five seed cases cover reuse/reactivation/order,
  preserving custom categories and real courses, repeated initialization, ambiguous matches,
  reserved IDs/owner email, correct publications/category distribution and no wallet/notification
  side effects. Existing model/snapshot tests still pass.
- Frontend build passed; **89 frontend tests passed**. Public catalog contract tests verify
  credentials, real IDs, absent fabricated metrics and no static fallback on empty/failure.
- Real backend restart left counts at six active categories and 12 distinct demo courses.
  Every field of all pre-existing real Course and CourseVersion rows was compared with a
  pre-seeding JSON snapshot after initialization and again after restart: unchanged.
- Browser verification passed in Arabic and English: Home shows the real records; both catalog
  pages contain exactly the IDs returned by the API; each of six category filters returns its
  two matching samples; real detail links load; a simulated API outage displays an error with
  zero fallback cards.
- All six real API category IDs/labels appeared in Learner and Instructor onboarding and in
  both selection groups for Both. These selector tests used fixture account sessions while
  fetching categories/course data from the real running backend; they created no accounts.
- Read-only real-account browser checks passed: Fatima sees only her original one course in
  course/certificate lists; Dana's dashboard recommendations use real published GUIDs.

Reproduce with the existing backend HTTP profile, frontend dev server, and
`frontend/scripts/verify-seeded-catalog.cjs` (PLAYWRIGHT_MODULE points to Playwright; installed
Edge is used). Optional ESHAM_FATIMA_PASSWORD / ESHAM_DANA_PASSWORD enable the real-account
read-only checks. No credentials are committed.

## Files changed for this feature

- `backend/esham.BLL/Services/DefaultCategorySeeder.cs`
- `backend/esham.BLL/Services/DemoCourseSeeder.cs`
- `backend/esham.PL/Program.cs` (startup initialization only)
- `backend/esham.Tests/CatalogSeedTests.cs`
- `frontend/src/services/publicCatalog.js`
- `frontend/src/context/PublicCatalogContext.jsx`
- `frontend/src/hooks/useInstructorCourses.js`
- `frontend/src/components/CatalogStatus.jsx`
- `frontend/src/App.jsx` (catalog provider)
- `frontend/src/components/CourseCard.jsx`
- `frontend/src/pages/HomePage.jsx`
- `frontend/src/pages/CoursesPage.jsx`
- `frontend/src/pages/CourseDetailsPage.jsx`
- `frontend/src/pages/learner/LearnerDashboard.jsx`
- `frontend/src/pages/learner/LearnerCoursesPage.jsx`
- `frontend/src/pages/instructor/InstructorDashboard.jsx`
- `frontend/src/pages/instructor/InstructorCertificatesPage.jsx`
- `frontend/src/components/learner/CourseRecommendations.jsx`
- `frontend/src/components/chatbot/EshamChatbot.jsx` (catalog input only)
- `frontend/tests/public-catalog.test.mjs`
- `frontend/package.json` (append catalog tests, preserve all existing suites)
- `frontend/scripts/verify-seeded-catalog.cjs`
- `docs/default-catalog-seeding.md`
