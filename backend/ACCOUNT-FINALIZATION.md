# Account onboarding finalization

**Integration update:** GUID selections can now be finalized through PATCH /me.
Password login restores an onboarding session for valid incomplete accounts and
returns onboardingRequired=true with full profile metadata and actual memberships.
The earlier 409-login limitation described below is historical; see
[the current integration contract](../frontend/USER-CATEGORIES-INTEGRATION.md).

`PATCH /me` finalizes a complete profile using the existing request and 204 response.
`PATCH /me/role` accepts `{ "role": "learner|instructor|both" }` and returns 204.
The selected persona must have a valid name, username, goal, and required learning
interests/teaching areas or custom skills. Incomplete requests return 400 without
persisting any profile, membership, or wallet changes. Category indexes remain the
existing account contract. The subsequent GUID-based User Categories APIs and
their frontend mapping limitation are documented in [USER-CATEGORIES.md](USER-CATEGORIES.md).

Self-service changes only Learner and Instructor memberships. `both` means those
two memberships, never a Combined role. Existing GeneralAdmin, CategoryAdmin and
other non-persona memberships are preserved; self-service cannot grant them.
Required roles must already exist. Missing roles return 503 without writes; this
service does not provision roles. Existing development provisioning remains unchanged.

## Atomicity and idempotency

Identity's existing EF stores and AccountService resolve the same scoped
AppDbContext through AddEntityFrameworkStores. All Identity SaveChanges calls,
profile changes, security-stamp changes, wallet and ledger writes execute in one
Serializable transaction inside SQL Server's EF execution strategy. Do not replace
the Identity store with a separate context without preserving this transaction boundary.

Finalization reads the existing AspNetUsers row with UPDLOCK/HOLDLOCK before
reading memberships or the wallet. Requests for one account serialize at that
row, including requests on different application instances. Every execution-strategy
attempt clears tracking and reloads state under the lock.

The first successful finalization inserts a Wallet with balance 20 and an immutable
PointTransaction with amount 20, type `welcome`, and operation key
`welcome:` followed by SHA-256 of the unchanged account ID. The wallet primary
key and unique operation key are additional duplicate protections. Replayed calls,
including a retry after an uncertain commit acknowledgement, find both existing
records and do not change the balance or insert another welcome entry. Existing
balances are preserved, including balances changed by later enrollment operations.
The existing EF ledger update guards remain unchanged; no ledger deletion is added.

A wallet without its canonical welcome entry, an entry without its wallet, an
invalid canonical entry, or preexisting ledger history without this initialization
returns 409. This requires deliberate reconciliation of legacy data, not an automatic
top-up or reset. No backfill or data repair is performed by this change.

Identity validation failures roll back the transaction. Storage/transient failures
roll back and either retry through EF or reach the existing exception handler.
Tracking is cleared on failures so an unsuccessful attempt cannot later be saved.

Cookie refresh happens only after commit. SQL and HTTP cookie delivery cannot be
one atomic operation. If delivery fails, database finalization remains committed;
signing in again or retrying safely recovers without granting more points. Other
existing cookies follow Identity's configured security-stamp revalidation interval.
Existing content endpoints additionally verify database memberships on every call.

Login and session use the same profile-completeness and actual-membership checks.
A normal account with incomplete onboarding or mismatched memberships gets the
existing 409 on login and onboardingRequired=true on an authenticated session.
Login does not grant roles or points. Administrators without a learner/instructor
persona retain access to the existing administrative APIs. The unchanged frontend
still does not accept an admin-only persona or route a 409 login into onboarding;
those frontend limitations are not changed here.

## Verification

Offline tests (no application configuration, secrets or database connection):

```text
dotnet build backend/esham.sln --no-restore
dotnet test backend/esham.Tests/esham.Tests.csproj --no-restore --filter "FullyQualifiedName!~AccountFinalizationSqlServerTests"
```

AccountFinalizationTests uses the existing InMemory transaction shim for service
rules. It does not prove SQL isolation, rollback or concurrency. Cookie tests use
Identity's real cookie handler and a separate request scope after registration.

AccountFinalizationSqlServerTests covers eight overlapping scopes, rollback after
Identity writes, transient execution-strategy retries, lost commit acknowledgement,
and Identity username-validation failure. It is skipped unless
ESHAM_RUN_ISOLATED_SQL_TESTS=1. A separately provisioned, disposable SQL Server
database with the existing schema is required, supplied only through
ESHAM_ACCOUNT_TEST_SQLSERVER. Its database name must start with Esham_AccountTests_.
Never supply the shared application's database. The tests add isolated users and
their records; they do not create/drop databases, apply migrations, or create schema.
Dispose of the isolated database separately after verification.

No NuGet packages, entities, model configuration or migrations were added.
The existing InitialIdentity and AddEshamDomainModel schema must already be
applied. Any deployment/migration coordination remains with Fatima. Welcome,
enrollment debit and instructor reward remain 20 / 20 / 20; enrollment is not
implemented by this change.
