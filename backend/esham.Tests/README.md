# Fatima Phase 2 verification

Run from the repository root:

    dotnet test backend/esham.Tests/esham.Tests.csproj

ContentApiServiceTests uses EF InMemory for service behavior. TestTransactionManager
is a test-only transaction shim: it checks the requested isolation level but does
not reproduce SQL Server rollback, locks, FK constraints or retry behavior.
RelationalQueryTests uses the real SQL Server provider to translate read queries,
suppresses connection opening, and captures commands before execution. It also
checks that the EF model still matches the existing migration snapshot.

No test reads User Secrets or connects to the hosted database. Transaction rollback,
concurrent writes and authenticated cookie/role write flows still require separate
integration testing against a disposable SQL Server database and authorized users.

Category tree edits and course writes use Serializable transactions within EF's
execution strategy. Course creation uses fixed operation IDs across retries and
three staged saves (course, version, draft pointer). No welcome points or other
learner-domain operations are performed by these APIs.

PATCH draft semantics: omitted fields are retained; explicit null clears optional
text or CoverMediaAssetId. CategoryId, Language, Level and Objectives cannot be null.
Objectives can be an empty array while drafting. Only review state `draft` is
editable. Reopening rejected versions and cloning approved versions are not part
of this phase.

Protected API calls require the existing Identity cookie and database-backed
Instructor/GeneralAdmin role membership. The legacy ApplicationUser.Role string
is not a substitute. Sign in through /auth/login from the same Swagger origin once
the required memberships exist. This phase does not seed roles or users.
