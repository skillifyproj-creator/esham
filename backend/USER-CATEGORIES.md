# Mais-owned User Categories APIs

**Integration update:** the subsequent frontend integration supersedes the
frontend-blocker and login-recovery limitations below. See
[frontend/USER-CATEGORIES-INTEGRATION.md](../frontend/USER-CATEGORIES-INTEGRATION.md)
for the current GUID onboarding, profile, session and deployment contracts.
PATCH /me now accepts optional learningCategoryIds/teachingCategoryIds and commits
them with onboarding finalization. Password login can resume incomplete onboarding,
and incomplete account responses retain full profile metadata.

This change reuses UserCategory, Category and the existing composite key
(UserId, CategoryId, Kind). It changes no entities, EF configuration, migrations,
category/course business logic, enrollment or points policy.

## Contracts

All routes require the existing Identity cookie. The user ID comes only from the
authenticated principal; no user identifier can be supplied in the route or body.

| Method | Route | Request | Success |
| --- | --- | --- | --- |
| GET | `/me/categories` | None | 200 with both GUID arrays |
| PUT | `/me/categories/learning` | `{ "categoryIds": ["<category-guid>"] }` | 200 with both GUID arrays |
| PUT | `/me/categories/teaching` | Same | 200 with both GUID arrays |

Response shape:

```json
{
  "learningCategoryIds": [],
  "teachingCategoryIds": []
}
```

Use category IDs obtained from the existing GET /api/categories catalog.
PUT replaces only the specified kind. An empty array clears that kind. Omission,
null, duplicate IDs, Guid.Empty, malformed GUIDs and unknown body fields are
invalid. Every requested ID, including a retained selection, must exist and be
active. The same category may occur once in each kind. Kinds are exactly the
existing model values `learning` and `teaching`.

Learning writes require actual Learner membership, teaching writes require
Instructor. Having both memberships permits both operations. Legacy persona strings,
role claims, GeneralAdmin and CategoryAdmin do not substitute for those memberships.
An authenticated account can read its own stored history even if its memberships
have since changed or a selected category is now inactive. GET does not silently
erase history; inactive categories cannot be selected again through PUT.

The response conventions are 400 ValidationProblem for invalid selections/contracts,
401 for a missing valid cookie, 403 for missing required membership or a missing
current account, and existing exception-handler 409/503 responses for persistence
conflicts/unavailability. Other users' selections are never returned or modified.

## Profile/session consistency and the frontend blocker

Inspected sources include UserCategory/Category/ApplicationUser, learning/content
EF configuration, account/category services and endpoints, account DTOs, existing
tests, docs/backend-contract.md, and frontend accountApi.js, InterestsSetup.jsx,
OnboardingPage.jsx, AccountPage.jsx, categories.js and interestAreas.js. No separate
October 24 handoff document was found in the repository; the supplied Fatima/Mais
ownership boundaries and repository handoff were followed.

The unchanged frontend stores these explicitly defined legacy indexes:

| Frontend index | Frontend semantic key |
| --- | --- |
| 0 | programming |
| 1 | design |
| 2 | photography |
| 3 | marketing |
| 4 | crafts |
| 5 | business |

There is **no reliable mapping from those semantic keys to database GUIDs** in the
current schema or repository. Category has no stable external key or slug, IDs
are generated GUIDs, names are editable/nonunique, and DisplayOrder is presentation
data. Matching by index, name, insertion order or display order would invent a
relationship. No automatic translation or backfill is implemented.

Account profile/login/session responses now expose additive learningCategoryIds and
teachingCategoryIds fields from the same UserCategories rows as GET /me/categories.
These fields are also included in the minimal onboarding-required session profile.
Legacy interests/teachingAreas remain integer arrays with their existing contract.

An explicit GUID PUT clears only the corresponding legacy array atomically, so a
profile response cannot keep reporting old indexes for the kind just replaced.
Active GUID selections satisfy the existing onboarding interest/teaching requirement;
custom teaching skills continue to satisfy the teaching alternative. Clearing the
last required selection, or deactivating it, can make onboardingRequired true and
login return the existing 409. No roles, wallet, points or enrollments are changed.

After a kind has GUID selections, PATCH /me rejects changes to that kind's legacy
integer array with 409 instead of guessing how to overwrite the GUID selections.
Omitted/unchanged legacy arrays preserve GUID selections and allow other profile
edits. GUID updates use /me/categories. Selections survive persona changes; writes
remain gated by the current actual memberships.

The old onboarding/profile forms still submit integer arrays and do not invoke
the new routes or render the new GUID fields. Their legacy selections remain
unlinked preview data: successful legacy onboarding does not create UserCategories.
Thus this change does not claim end-to-end frontend integration. Newly registered
accounts without memberships also cannot use role-specific PUT until existing
onboarding has granted the corresponding roles.

Unblocking the existing forms requires an approved, stable semantic-key-to-GUID
mapping coordinated with Fatima, or frontend support for catalog GUID selections.
Neither is silently introduced here. Previously stored indexes and shared data
are not migrated, repaired or reinterpreted.

## Atomicity and verification

Each PUT runs inside the SQL Server EF execution strategy and a Serializable
transaction, taking UPDLOCK/HOLDLOCK on the current user row before membership,
category and selection reads. This is the same lock used by account finalization.
Validation locks protect selected categories until commit. Set differences retain
existing CreatedAt values; replayed requests cannot create duplicate rows under
the composite key. Each attempt clears tracking and reloads state; failures roll
back and clear tracking. Account ConcurrencyStamp changes prevent stale Identity
writes from restoring old legacy indexes. SecurityStamp/memberships are untouched.

Offline UserCategoryServiceTests covers validation, membership authorization,
ownership, both roles, replacement/replay, timestamps, clearing, stale Identity
writes, login/session/profile consistency, malformed JSON and route auth metadata.
The existing model/snapshot test continues to check that no migration is needed.
The InMemory transaction shim cannot prove actual SQL locking or rollback.

UserCategorySqlServerTests adds separately opted-in tests for concurrent replacements,
rollback after SaveChanges, and transient retries. They reuse the isolated test
database guard in AccountFinalizationSqlServerTests; they never read application
configuration/User Secrets or create/apply schema. See ACCOUNT-FINALIZATION.md for
the isolated database prerequisites. They remain skipped during offline verification.
No new package dependency is required.
