# Account persona and Identity membership verification

## Root cause and scope

The historical AccountService in commit `35d0aa1` updated `ApplicationUser.Role` during
profile saves without assigning Identity memberships. The hosted database contained two
accounts consistent with that legacy-only state. This is not evidence that current main's
canonical UI finalization is still missing assignments: Mais's `d36c730` already introduced
transactional persona-to-Identity synchronization for learner, instructor and both.

Registration intentionally creates an authenticated onboarding session without guessing a
persona or assigning roles. The UI submits its complete final selection to `PATCH /me`;
that service validates onboarding and synchronizes memberships before committing.
Stopping partway through onboarding must not grant a role based on a browser-only choice.

The small production change centralizes the existing synchronization and makes role-name
comparisons consistent with Identity's case-insensitive normalization. Previously removal
and onboarding-completeness checks used case-sensitive role display names, so a legacy
lowercase role could survive a persona transition or incorrectly force further onboarding.
Regression tests reproduce that casing failure. No new signup endpoint or frontend persona
workflow was introduced, and existing completeness, transaction, session and cookie rules
were preserved.

## Synchronization

- `learner` -> `Learner`; `instructor` -> `Instructor`; `both` -> both memberships.
- Add only missing memberships; remove only obsolete Learner/Instructor memberships.
- Compare membership sets case-insensitively. Repeat finalization and repair of a missing
  membership produce the same role set without duplicate joins.
- Administrative and other non-persona memberships are never changed by this helper.
- Existing validation rejects GeneralAdmin, CategoryAdmin, Combined and unsupported personas
  through both `PATCH /me` and `PATCH /me/role`. Self-service never creates roles.
- The legacy persona remains synchronized as part of the same finalization transaction.
  APIs authorize through Identity membership; login/session reads do not infer grants from
  the legacy string or change account roles.
- Persona changes before completion remain draft UI selections. Only the completed selection
  is persisted; later valid transitions synchronize the exact persona membership set.

## Hosted development account audit and repairs

Before repair: four existing users audited; two mismatches. All four authoritative roles
already existed. Two accounts were already correctly configured and were not modified.

| Account | Saved evidence | Repair |
| --- | --- | --- |
| `rahaf@instructer.com` | instructor persona, valid username `Rahaf`, name, goal 1, one legacy teaching selection, no Identity roles | Added Instructor |
| `Dana@learner.com` | learner persona, valid username `Dndn`, name, goal 0, one legacy learning selection, no Identity roles | Added Learner |

These records satisfy the existing backend profile-completeness rules apart from missing
memberships; their intended persona is explicit. Repairs used the existing Development
Identity assignment command, changing only the missing membership and refreshing the
security stamp. No profile/persona, categories, ownership, wallet or notification data was
rewritten for either account. No ambiguous accounts were guessed or provisioned.

Legacy category indexes were deliberately not mapped to category GUIDs. Mais's current
frontend can still request explicit category reselection for these legacy accounts; that is
separate from Identity membership synchronization and remains unchanged. Existing sessions
for the repaired accounts should sign in again after the security-stamp change.

After repair and verification cleanup: four existing users audited, zero persona/Identity
mismatches. The database contains Learner, Instructor, GeneralAdmin and CategoryAdmin and
no Combined role.

## Verification

- Backend build passed with zero warnings/errors.
- Backend tests: **199 passed, 16 skipped, zero failed**. Existing opt-in isolated SQL Server
  tests are skipped because their separate test database is not configured.
- Five new regression cases cover actual registration followed by GUID onboarding for all
  three personas, repeated finalization, recovery of missing memberships, correctly configured
  session reads, and canonical/lowercase Identity role-name transitions preserving admin roles.
  Existing tests continue covering rejection of self-assigned admin and Combined roles.
- Frontend tests: **86 passed, zero failed**, including session/category/admin routing tests.
- Real Edge UI signup and complete onboarding passed separately for Learner, Instructor and
  Both. Each run changed the initial persona selection before completion, then verified the
  final intended memberships and no stale grant from the abandoned selection.
- Repeating `PATCH /me` twice retained the exact role set. Attempts to self-assign each admin
  role or Combined through both self-service routes returned 400 without changing memberships.
- Login and refreshed-session redirects passed: Learner -> `/learner`, Instructor ->
  `/instructor`, Both -> `/learner` (the existing default). Identity-protected instructor
  course listing returned 403 for Learner and 200 for Instructor/Both.
- Direct SQL inspection of AspNetUserRoles confirmed Learner, Instructor and both corresponding
  joins, and no Combined role. Four temporary test accounts (including one earlier runner
  attempt) and only their generated test artifacts were transactionally removed afterward.
  The four original accounts were preserved.

The browser runner `frontend/scripts/verify-onboarding-roles.cjs` uses installed Edge and a
Playwright module specified by PLAYWRIGHT_MODULE. It generates credentials only in memory;
ESHAM_ROLE_MANIFEST points to a temporary ID/email-only manifest for explicit cleanup.
Optional ESHAM_TEST_API / ESHAM_TEST_FRONTEND default to ports 5206 / 5173. The runner creates
temporary accounts and does not itself delete them; the verification session performed the
guarded manifest-scoped cleanup after inspecting memberships.

## Exact files changed for this request

- `backend/esham.BLL/Services/AccountService.cs` — normalize and centralize persona membership synchronization.
- `backend/esham.PL/Development/DevelopmentIdentityRoles.cs` — include profile evidence in mismatch audit output.
- `backend/esham.Tests/AccountPersonaSynchronizationTests.cs` — five regression cases.
- `frontend/scripts/verify-onboarding-roles.cjs` — real signup/onboarding verification for all three personas.
- `docs/account-persona-synchronization.md` — findings, repairs and verification results.

No migration, schema change, frontend production-flow change, or modification to course,
enrollment, wallet, notification or admin-management logic was made for this request.
