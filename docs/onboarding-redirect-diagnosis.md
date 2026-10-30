# Remaining onboarding redirect diagnosis

## Exact root cause

The backend did not consider Rahaf or Dana incomplete after their Identity memberships were
repaired. Both `/auth/login` and `/auth/session` returned `onboardingRequired: false`.
The frontend's `loadServerSession()` changed that answer:

```js
onboardingRequired: session.onboardingRequired || profile.categoryReselectionRequired
```

`reconcileCategoryProfile()` correctly detected legacy category indexes without corresponding
GUID selections and set `categoryReselectionRequired: true`. Conflating that catalog migration
notice with account completeness sent completed accounts through `accountDestination()` to
`/onboarding/role`. `RoleArea` enforced the same modified session value on workspace access.
The guards themselves were following their input; the erroneous input was constructed by the
session adapter. This was independent of Identity membership and persisted profile fields.

## Comparison of real database and API results

| Field | Working Fatima Instructor | UI-created Rahaf Instructor | UI-created Dana Learner |
| --- | --- | --- | --- |
| Persona | instructor | instructor | learner |
| Identity | Instructor | Instructor | Learner |
| Name | Fatima Test | rahaf | Dana |
| Username | fatima_instructor_test | Rahaf | Dndn |
| NameEn | null | null | null |
| Avatar present | no | no | yes |
| Bio | null | empty | empty |
| Interests | [] | [] | [3] |
| TeachingAreas | [] | [1] | [] |
| CustomSkills | [] | [] | [] |
| Goal | 0 | 1 | 0 |
| UserCategories | one active teaching GUID | none | none |
| Raw login/session onboardingRequired | false / false | false / false | false / false |
| Derived category reselection notice | false | true | true |
| Redirect after fix | /instructor | /instructor | /learner |

The hosted catalog currently contains Programming. No attempt was made to interpret legacy
indexes [1] or [3] as that GUID. Their saved choices are retained; updating them requires an
explicit selection from the current catalog.

## Existing completion rules retained

There is no persisted OnboardingComplete flag. AccountService derives completeness from:

- A supported persona (`learner`, `instructor`, `both`) and matching Identity memberships.
- Name containing 2–80 nonblank trimmed characters.
- A username of 3–24 letters, digits or underscores.
- Goal set to an index 0–3; zero is valid.
- For a learning persona, saved Interests or an active learning UserCategory.
- For a teaching persona, saved TeachingAreas, an active teaching UserCategory, or CustomSkills.

NameEn, Avatar and Bio are optional; neither their absence nor an empty Bio causes the
redirect. Instructor-only accounts do not need learning choices, and Learner-only accounts
do not need teaching choices. Both needs both relevant branches. Administrative exceptions,
Identity authorization, invalid-login rejection, cookie/session handling and server-side
validation were not changed.

The backend intentionally supports persisted legacy selections for account completion.
The old UI had persisted Rahaf's and Dana's selections in ApplicationUser's JSON fields;
those fields were not lost. The current GUID onboarding flow already saves UserCategories
through `PATCH /me`. Existing tests verify that it persists and reloads them. The fix does
not replace a missing required choice with a default, skip backend checks, or claim a
genuinely unfinished profile is complete.

## Fix

`loadServerSession()` now preserves the server's boolean unchanged. It still reconciles
category GUIDs and retains `categoryReselectionRequired` as profile-edit information.
The account profile page displays a nonblocking note for legacy selections. The current
catalog/selection validation remains required when saving category/profile edits.
Neither redirect guards nor localStorage can invent their own completion decision.

No database repair was necessary for existing profiles or categories. The earlier Identity
role repairs were sufficient for role authorization; this request only fixes the frontend
override of the backend's completion result. No existing persona, ownership, categories,
goal, optional profile data or password was changed. No migration/schema change was made.

## Verification

- Backend build: passed, zero warnings/errors. Backend tests: **207 passed, 16 existing
  opt-in SQL Server tests skipped, zero failed**. Eight new completion tests capture the
  real legacy/GUID shapes and preserve missing-name/username/goal/category rejection.
- Frontend build passed. Frontend tests: **87 passed, zero failed**. Regression coverage
  asserts complete legacy Learner/Instructor/Both sessions remain complete, category editing
  still requires explicit GUID choices, and server-incomplete sessions remain incomplete.
- Real browser login: Fatima -> Instructor, Rahaf -> Instructor, Dana -> Learner, all directly.
  The raw login and session responses agree (`false` for onboardingRequired).
- A temporary completed Both account with legacy selections -> `/learner`, the existing
  default; its Instructor workspace also loaded successfully.
- A temporary genuinely incomplete account -> `/onboarding/role`; a nonexistent account
  returned 401. Complete cached profiles could not bypass either case.
- Refreshes with stale localStorage and same-account/other-account onboarding drafts did
  not reinstate the redirect. Server profiles replaced stale cached profile fields.
- Rahaf/Dana profile pages displayed the category update notice without redirecting.
- Both temporary accounts and only their generated test artifacts were transactionally
  deleted after verification. The original four accounts remain.

The browser runner uses environment-only passwords (none stored in the repository), an
installed Microsoft Edge browser and PLAYWRIGHT_MODULE. ESHAM_FATIMA_PASSWORD,
ESHAM_RAHAF_PASSWORD and ESHAM_DANA_PASSWORD identify existing test logins;
ESHAM_REDIRECT_MANIFEST is a temporary ID/email-only cleanup manifest. `--diagnose` performs
only existing-account comparisons. Default verification additionally creates two temporary
accounts, which require the manifest-scoped cleanup performed in this session.

## Exact files changed for this request

- `frontend/src/services/categorySelections.js`
- `frontend/src/pages/shared/AccountPage.jsx`
- `frontend/tests/category-selections.test.mjs`
- `backend/esham.Tests/OnboardingCompletionTests.cs`
- `frontend/scripts/verify-onboarding-redirects.cjs`
- `docs/onboarding-redirect-diagnosis.md`
