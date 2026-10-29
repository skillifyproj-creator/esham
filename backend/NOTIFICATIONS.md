# Notifications implementation handoff

## Scope and existing storage

Reuses the existing DAL Notification entity, configuration, primary key, recipient relationship, localized content, CreatedAt, IsRead and ReadAt. No entities, migrations, database updates, dependencies or points-policy changes were introduced. Existing unrelated working-tree changes are preserved; the branch remains main.

## HTTP contracts

All routes require the current authenticated Identity cookie. Recipients always come from Identity, never request parameters. Response property names below use the application's camelCase JSON convention.

| Method and route | Request | Response |
| --- | --- | --- |
| GET /me/notifications | Optional page (default 1), pageSize (default 20, maximum 100), isRead (true/false; omit for all) | {accountId, items, page, pageSize, totalCount} |
| GET /me/notifications/unread-count | None | {accountId, unreadCount} |
| PATCH /me/notifications/{id}/read | Nonempty GUID in D format; no body | {accountId, updatedCount} |
| PATCH /me/notifications/read-all | No body | {accountId, updatedCount} |

Each item contains id, notificationType, titleAr, titleEn, messageAr, messageEn, createdAt, isRead and readAt. No recipient or navigation objects are exposed. List ordering is CreatedAt descending, then Id descending; totalCount applies to the selected read filter. Unread count always covers the entire current inbox. Invalid pagination, overflowing offsets, GUIDs and malformed boolean filters are rejected.

PATCH requests require X-Requested-With: XMLHttpRequest and pass the existing trusted-origin mutation filter. They also require X-Esham-Account-Id to equal the authenticated account's NameIdentifier. This header is a session precondition only: it cannot select a recipient. It prevents a stale account A screen from marking account B's notifications after a cookie switch. Repeated successful reads return updatedCount 0 and preserve the original readAt.

Errors follow existing conventions: 401 for invalid/locked sessions, 400 for invalid input, 404 for a missing or foreign notification without distinguishing ownership, 403 for rejected mutation origin/header checks, and 409 for a changed-account precondition. There is no public notification-creation endpoint.

## Transactions, security and creation

The reader checks the current Identity account and lockout. Every query/update scopes RecipientUserId to that account, including administrators. Read mutations reuse serializable transactions, the account-row UPDLOCK/HOLDLOCK convention, execution-strategy retries and fresh tracking. SQL Server read-all uses one set-based update of unread rows, preserving existing read timestamps.

INotificationWriter.StageAsync requires an already-open transaction. It validates an existing recipient and content bounds, stages an entity, and never saves or commits the business caller's transaction. The caller supplies a stable notification GUID. Replaying an identical stored/tracked GUID is a no-op; reusing it for a different payload/recipient throws. Read state and creation timestamps are not reset.

The only connected real producer is initial welcome-wallet creation inside account finalization. The welcome notification uses a deterministic per-account event ID and is saved in the same transaction as the existing wallet and welcome ledger entry. Existing wallet/ledger guards and account locking protect retries. Login, profile/persona changes and repeated finalization do not create further welcome notifications. Existing wallets are not backfilled. The 20 welcome / 20 enrollment debit / 20 instructor reward policy is unchanged.

The schema has no general business-event deduplication column or outbox. Stable primary keys prevent duplicate rows, but StageAsync alone does not guarantee arbitrary concurrent business events succeed exactly once: callers must coordinate locking, transaction scope and rollback/retry after a competing insert. Broader deduplication/outbox support requires coordination with Fatima; none was added here.

## Frontend integration

Learner and instructor notification screens/bells, the GeneralAdmin notification navigation/page, and the CategoryAdmin notification page/sidebar use one authenticated account inbox. Switching roles does not select a different recipient. CategoryAdmin preview selectors cannot select the personal inbox owner.

The shared store fetches real list/count responses with cookie credentials and validates their account binding. It clears data on logout/account switches and ignores late responses from previous sessions. Render-time account gating also prevents stale content before effects run. PATCH helpers send the account precondition. Successful writes refresh canonical server data; failed writes do not manufacture success or unread counts.

The pages support read filtering, pagination, mark-one/all, loading, empty, retry, error and session-expiry states. Messages are rendered as plain React text with localized fallback. Unsupported types display their message without invented destination links. No mock/localStorage inbox is a fallback or authoritative source. Legacy category-admin course-decision preview code remains untouched and is not imported into the real personal inbox.

Refresh occurs on account changes, window focus, profile events, mutations and a 60-second visible-window poll. This is not push delivery. Page and unread count are separate live reads and can briefly differ if another event arrives between requests.

## Verification and remaining dependencies

| Check | Result |
| --- | --- |
| dotnet build backend/esham.sln --no-restore | Passed; 0 warnings, 0 errors |
| Backend automated tests, isolated SQL explicitly disabled | 150 passed, 0 failed, 16 skipped |
| Frontend npm test | 82 passed, 0 failed, 0 skipped |
| Frontend npm run build | Passed |
| git diff --check | Passed |

Backend notification coverage includes authentication/lockout, recipient isolation, pagination/filtering/order, unread count, idempotent reads, invalid/missing IDs, writer transaction requirements and payload replay, account binding, and welcome-once behavior. Frontend coverage includes contract validation, bell/list/states, server-confirmed reads, expiry, filtered pagination and account-switch races.

The 16 skipped tests comprise the prior 12 isolated SQL tests and four new notification SQL tests: concurrent read-one/read-all, rollback after tracked read save, caller-owned business transaction rollback, and rollback after the bulk read update. Existing account SQL tests now also assert welcome-notification uniqueness/rollback. These require the existing explicit isolated SQL opt-in and guarded test database; no SQL/shared database tests or schema commands were run. InMemory tests do not establish SQL locking/rollback guarantees.

Deployment requires the existing Notification table/configuration to be present. No new migration is required by these changes. Real SQL concurrency/failure validation remains pending isolated infrastructure. Future publication/moderation/announcement producers require Fatima's approval and transaction contracts; future learner-event producers require their actual implementations. No Enrollment or other learner feature was started.

## Exact file manifest for this notification task

Added:

- backend/NOTIFICATIONS.md
- backend/esham.BLL/DTOs/Notifications/NotificationDtos.cs
- backend/esham.BLL/Interfaces/INotificationService.cs
- backend/esham.BLL/Services/NotificationService.cs
- backend/esham.BLL/Services/NotificationWriter.cs
- backend/esham.PL/Endpoints/NotificationEndpoints.cs
- backend/esham.Tests/NotificationTests.cs
- backend/esham.Tests/NotificationSqlServerTests.cs
- frontend/src/services/notifications.js
- frontend/tests/notifications.test.mjs

Modified (some already contained changes from earlier approved tasks):

- backend/esham.BLL/Services/AccountService.cs
- backend/esham.PL/Program.cs
- backend/esham.Tests/AccountFinalizationTests.cs
- backend/esham.Tests/AccountFinalizationSqlServerTests.cs
- backend/esham.Tests/AccountLoginTests.cs
- backend/esham.Tests/AdminUserTests.cs
- frontend/package.json
- frontend/src/App.jsx
- frontend/src/services/accountApi.js
- frontend/src/context/NotificationsContext.jsx
- frontend/src/pages/shared/NotificationsPage.jsx
- frontend/src/components/shared/NotificationBell.jsx
- frontend/src/hooks/useLearnerNotifications.js
- frontend/src/components/admin/AdminWorkspace.jsx
- frontend/src/pages/admin/SuperAdminModule.jsx
- frontend/src/pages/category-admin/CategoryAdminModule.jsx
