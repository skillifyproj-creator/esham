# Phase 6A verification - final reconciliation

Handoff November 24, 2026; branch feature/learner-phases-1-3 at unchanged baseline efcced57d940f364e61bce33585ad56dcab9bfed. The original and approved course-creation/category authorization findings are fixed. The two safe test failures were test-only and are resolved. Graduation readiness remains conditional on a new independent final audit; production readiness is not established.

## Before / after evidence

| Finding | Before | After |
| --- | --- | --- |
| Metadata/revision/decision authorization | Deterministic guarded SQL initial22-case matrix:13passed,9failed. Each of the3 paths accepted revoked, locked-out and absent persisted membership actors; those9 failures are now reproduced, not merely inspection concerns. | Final30-case expanded matrix passes, plus14 original authorization cases. Current role/lockout is checked after course/actor locks, and rejected-course snapshots remain unchanged. |
| Gateway cancellation | Initial7-case synthetic harness:2passed,5failed; provider/upstream calls continued in cancelled pre-forward scenarios. The independent audit also observed1 provider call after cancellation. | Final7cases pass, including a strengthened immediate-pre-forward body-projection boundary, document/image cancellation, zero early upstream/provider invocations, forwarded abort propagation and unaffected shared refresh. |
| Recommendation freshness | Independent audit established the ID-only signature and retained old course objects by code inspection. No pre-fix browser execution is claimed. | New frontend metadata contract test plus7 browser cases pass: unchanged GUID metadata/version, category/ownership, held stale results, public-feed removal, current objects and identical-refresh no-loop. Browser amendments are synthetic public HTTP responses, not DB writes. |

Before artifact names: round2-authorization-before.trx/log, round2-cancellation-before.log. After: round2-final-authorization-diagnostics.trx/log, round2-cancellation-final.log, round2-final-browser-freshness.log and browser-round2-freshness-results.json, all in ignored artifacts/phase6a-results. Existing failed synthetic records were preserved, not reset or repaired.

## Final results

| Suite | Passed | Failed | Skipped | Evidence under artifacts/phase6a-results |
| --- | ---: | ---: | ---: | --- |
| Complete safe backend | 442 | 0 | 135 | safe-final.trx/log |
| Existing Phase1–5 SQL,18 selected filters | 125 | 0 | 0 | round2-sql-*.trx |
| Authorization and concurrency SQL | 87 | 0 | 0 | round3-complete-authorization.trx/log |
| Frontend Node | 185 | 0 | 0 | round2-final-frontend.log |
| AI Node, synthetic providers | 36 | 0 | 0 | round2-final-ai.log |
| Browser checks | 118 | 0 | 0 | Round2 110 unique checks plus 8 creation/category API checks; round3 reruns overlap |
| Persisted invariant definitions | 5 | 0 | 0 | round2-invariant*-final.trx |

Do not interpret a sum as unique coverage. The46 consist of14 original authorization cases,30 new matrix cases,1 new shared-actor authoring/progress test and1 controlled mixed-workload definition running3 established Phase1–5 waves. Established mixed assertions are also exercised in the125 existing SQL runs. Browser checks reexercise many of the same contracts. Fixture/delivery actions and child-process recovery checks are not added to the table totals.

The latest safe TRX records exactly 135 NotExecuted test cases, and every case has a reason message in its result Output. The documented skipped-test names reconcile exactly with safe-final.trx: 135 documented, 0 missing, 0 extra. The reason-message breakdown is: 32 require explicit SQL opt-in and a separately provisioned test database; 85 require an explicitly approved isolated LocalDB identity; 4 are Phase 5 fixture actions; 2 are Phase 4 fixture actions; 2 are Phase 3 fixture actions; 2 are Phase 2 fixture actions; 4 are Phase 1 setup actions; 1 is child-process recovery; 1 is a Phase 6A fixture; 1 is a Phase 5 recovery child; and 1 requires isolated LocalDB opt-in. These categories total 135. Compared with round2-final-safe.trx, which records 131 skips, safe-final.trx has exactly four additions: the creation-tree mixed-workload, captured-creation-authority, real SQL gate-wait, and category-selection lockout SQL definitions listed below. Each added test's reason message requires an explicitly approved isolated LocalDB identity.

Backend solution, runtime and explicit test-project builds passed with zero warnings/errors in the recorded round2 and round3 builds. Frontend production build passed in the recorded round2 and round3 builds, retaining existing bundler module-directive warnings. Timeouts/isolation/locks were not weakened to achieve passes. git diff --check passes; line-ending notices are informational.

### Browser breakdown

- Enrollment/wallet14; learning progress13; learner submissions15; completion/certificates16; session renewal2.
- Phase5 full workflow17; legacy-null review1; deterministic AccountPage race cases6.
- Phase6A real-backend/synthetic-provider journeys19; freshness public-response contract checks7; creation/category API checks8.
- Total118 distinct checks, zero final failures or skips.

Logs use round2-browser-<suite>.log for Phase1–5/legacy/account races. The complete rerun Phase6A log is round2-final-browser-phase6a.log; freshness log round2-final-browser-freshness.log. JSON browser-phase6a-results.json records19; browser-round2-freshness-results.json records7. Decode PowerShell BOM-marked redirected logs as UTF16LE.

These verify actual cookie sessions, separate GeneralAdmin/CategoryAdmin memberships, owned instructor submission and assigned CategoryAdmin publication, real catalog GUIDs, Arabic/English/RTL/mobile layouts, text/error/retry/cancel, real TXT/PDF extraction and image preparation, guest policy replies, expired sessions/account switching, review/announcement/security workflows, recommendation refresh and held-response protection. Only final provider answers are synthetic; no live-provider delivery or accuracy claim. Freshness7 specifically mock public DTO changes to exercise client invalidation; actual DB authoring/publication is independently exercised by the19 journeys and SQL suites.

## Transaction, concurrency and invariant coverage

All eight Fatima-owned paths require Fatima review before merge into main: CurriculumService.InDraft; CourseReviewService.SubmitAsync, ReviseAsync, DecideAsync; CourseService.UpdateDraftAsync and CreateAsync; CategoryService mutations; UserCategoryService.ReplaceCurrentAsync. Existing submission/draft/assignment/self-review/version/feedback/publication/moderation/audit policies remain unchanged.

New SQL cases hold a course X lock (also blocks the old metadata S read), capture the request actor, commit actual role revocation/lockout/assignment removal under the actor user lock, then release the course. Each rejected operation compares persisted course/version/pointer/audit/notification/section/lesson snapshots. User security changes intentionally persist independently and are excluded from the unchanged-course comparison. Wallet/ledger assertions remain.

Positive and negative cases cover all3 operations, foreign owner/self-review, actual membership missing, stale version/state, removed assignment, approval/rejection/request-changes and concurrent writes. New shared-actor concurrency combines metadata, curriculum, revision, publication and learner progress, asserting empty SQL error numbers, preserved purchased receipt and0/40 learner/instructor balances with two enrollment ledger entries.

The selected125 SQL regressions are the same18 filters from the prior Phase6A report: Phase5SqlTests, Phase5HardeningSqlTests, CompletionSqlServerTests, EnrollmentSqlServerTests, LessonProgressSqlServerTests, SubmissionSqlServerTests, InstructorInsightsTests.Sql_server_queries, Phase4HardeningSqlTests, AccountFinalizationSqlServerTests, UserCategorySqlServerTests, NotificationSqlServerTests, CourseVersionUpdateSqlTests, CourseResubmissionTests.Sql_comparison, PlatformModerationSqlTests, CategoryAdminProvisioningTests.Sql_, AdminUserSqlServerTests, AdminIntegrationTests.Sql_queries and PublicEducationalContentTests.Sql_public.

Five persisted browser invariant definitions verify wallet/ledger equality and20/20/20 policy, unchanged immutable purchase receipts/access, submission/assessment history, original completion/certificate identity/timestamp/snapshots, review/audit integrity and notifications. No financial business logic changed. Valid synthetic fixture actors were given actual roles; only newly created SQL fixture owners/reviewers are auto-granted by helper setup. Existing negative-role actors are not repaired. SQL resubmission uses a fresh reviewer instead of changing an old fixture account.

## Database identity, gate state and SQL diagnostics

- Only existing Esham_AccountTests_Phase1_20261114 on (localdb)\MSSQLLocalDB; actual IsLocalDB=1.
- Latest controlled server identity: DESKTOP-I0292P0\LOCALDB#0B90D93A. Earlier report incarnations remain historical; the exact catalog/local identity is independently rechecked before fixtures and by the per-DML guard.
- Round2 diagnostic run:43 blocking samples,3994 connection opens,zero failed-command/connection events, maximum sampled wait614ms. This is a repeated diagnostic run, not 43 unique test definitions.
- Consolidated Round3 controlled diagnostic run:67 blocking samples, 5,420 connection opens, zero diagnostic errors, maximum sampled wait 1,887 ms. Its mixed-workload SQL definition passed; diagnostic samples are observations, not unique tests.
- Both runs verified actual DB_NAME() = Esham_AccountTests_Phase1_20261114 and IsLocalDB=1 on (localdb)\MSSQLLocalDB; the server incarnation changed between runs. Exact identity was checked by test guards before mutation.
- Existing Phase5 mixed workloads, forced announcement/security chains and recovery interruption/restart/pagination/concurrent-worker tests were rerun. Catalog-wide worker rollout remains disabled.
- Isolated API5216/frontend5175/synthetic gateway8002 used process-local configuration. Runtime handshake is isolated=true with explicitly approved local capabilities; source defaults remain false. Startup seed flags and recovery workers stayed false.
- No db75401 access, migration/provision/reset, shared User Secrets/hosted setting change, paid provider request, dependency/runtime addition, commit/push/merge or Phase6B work.

Historical SQL command-lock error-2, pre-login initialization timeouts and the earlier unexplained27m01s completion suite remain unresolved. The14m47.534s and12m02.188s completion cases had no original causal trace. Passing controlled reruns and current diagnostics do not establish their causes or prove permanent deadlock freedom. No timeout increase, lock removal or failure suppression was used.

## Diagnosed setup/test failures retained

1. The cancellation test file first had a harness syntax error; it was corrected before the recorded2pass/5fail behavioral baseline. The immediate-forward boundary was subsequently strengthened and final7cases pass.
2. New valid rule-test fixture actors originally relied only on boolean roles. Helpers now model current persisted Instructor/CategoryAdmin membership; no production bypass or old-account repair.
3. A parallel frontend build copied generated Excalidraw fonts while Vite watched them. Windows watcher EBUSY terminated Vite, causing a missing Arabic chat response and then confirmed ERR_CONNECTION_REFUSED in a diagnostic. This was a frontend test-runtime collision, not a SQL timeout. After builds finished, isolated Vite was restarted; complete19 checks pass. Future builds/browser runs must be sequenced.
4. A freshness assertion searched the whole page for a repeated synthetic title. Another legitimate candidate shared it. The assertion was scoped to the target GUID, retaining the unchanged-ID freshness requirement; all7 pass.
5. Failed/partial logs and fixture records remain ignored evidence. Only latest successful runs populate final totals.

## Authorization review and readiness

The complete matrix is in PHASE6A-GRADUATION-READINESS.md. Current persisted memberships, account lockout, ownership and assignment checks are made under the documented transactional locks for the eight Fatima-review paths. SQL regressions cover pre-fix reproductions and post-fix denied writes. No additional confirmed authorization gap was identified in the reviewed matrix. CourseSafetyService current authority reads occur within Serializable before its course U lock; that order remains an unproven contention risk, with no confirmed deadlock or authorization exploit. Graduation readiness is conditional on independent final audit. Production readiness is unestablished; historical SQL timeouts and deployment/provider/hosting/email/storage/recovery operations need separate resolution.

## Commands and private evidence

From repository root; process-local isolated connection values intentionally omitted. Existing installed SDK/browser tools only.

    dotnet build backend/esham.Tests/esham.Tests.csproj --no-restore -p:OutputPath=<round2-test-output>
    dotnet build backend/esham.sln --no-restore -p:OutputPath=<round2-solution-output>
    # SQL opt-in0: safe suite
    dotnet test backend/esham.Tests/esham.Tests.csproj --no-build -p:OutputPath=<round2-test-output> --logger 'trx;LogFileName=round2-final-safe.trx'
    # Explicit approved LocalDB config/opt-in and actual identity guards:
    dotnet test backend/esham.Tests/esham.Tests.csproj --no-build -p:OutputPath=<round2-test-output> --filter 'FullyQualifiedName~Phase6AExpandedAuthorizationSqlTests|FullyQualifiedName~Phase6AAuthorizationRaceSqlTests|FullyQualifiedName~Phase6ADiagnosticsSqlTests'
    npm.cmd --prefix frontend test
    npm.cmd --prefix frontend run build
    node --test ai/tests/*.test.mjs
    # Start isolated runtime only after builds; then guarded browser scripts:
    node frontend/scripts/verify-phase6a.cjs
    node frontend/scripts/verify-phase6a-freshness.cjs
    git diff --check

Exact wrappers: artifacts/phase6a-results/round2-run-sql.ps1, round2-fixtures.ps1, round2-start-runtime.ps1, round2-run-browsers.ps1 and round2-invariants.ps1. They use existing approved fixture actions only. Private media, credentials, generated PDFs/screenshots, logs, binaries and results are not source changes. The implementation report contains the complete updated file manifest and Fatima review requirements.

## Final operational and Git checkpoint

At the implementation verification checkpoint, isolated ports were stopped and shared ports were untouched. The current path count and manifest are in PHASE6A-GRADUATION-READINESS.md. No migration or dependency addition was made, package dependency sets remain unchanged, and no secrets or ignored runtime artifacts are listed in source. This documentation reconciliation does not alter the index or Git history.

## Safe backend failures follow-up — November 24, 2026

The prior safe run reported two failure causes (three test cases total): `AccountPersonaSynchronizationTests.Newly_registered_accounts_finalize_idempotently_and_repair_missing_memberships` for instructor and both personas plus `AccountCategoryIntegrationTests.Guid_onboarding_bootstraps_memberships_and_selections_in_the_existing_finalization` for persona both failed while ASP.NET Data Protection attempted to write a machine key under the default per-user `DataProtection-Keys` folder. The inner exception was `UnauthorizedAccessException` on a `.tmp` key file; the stack ended in `FileSystemXmlRepository.StoreElement`, `KeyRingBasedDataProtector.Protect`, cookie sign-in and `AccountService.RegisterAsync`/`LoginAsync`. This is the test runner's filesystem permission boundary, not an application cryptography or cookie defect. `AccountFinalizationTests.Services` now selects `UseEphemeralDataProtectionProvider`, scoped only to its service-test DI provider. It leaves PL host configuration and production key persistence unchanged. The affected seven test cases passed on rerun.

`ContentApiServiceTests.Create_rejects_inactive_category_and_another_users_cover` failed at test line97, `db.Categories.Update(data.Category)`. The previous `CourseService.CreateAsync` execution strategy attempt clears the context tracker and reloads the same category and owner. The fixture then called `Update` on the stale `Seed` graph, attaching a second `ApplicationUser` instance with the already tracked key. The fixture now changes `IsActive` on the currently tracked category row; it does not alter service logic. The test passed on rerun.

Verification: affected-filter run passed7, failed0, skipped0. Full safe backend run passed442, failed0, skipped135 (577 total). All 135 skipped names are listed below and match safe-final.trx with 0 missing and 0 extra; every skipped result has a reason message. The four additions over round2-final-safe.trx are the creation/category SQL definitions; their messages require an explicitly approved isolated LocalDB identity. The initial pre-fix safe run's failures are retained as diagnostic evidence, not counted as current failures.

No migration, dependency, production Data Protection configuration, shared database access, or database mutation was involved. `git diff --check` passes.



## Consolidated reconciliation (November 24, 2026)

**Current safe backend:** 442 passed, 0 failed, 135 skipped, 577 total (`safe-final.trx`). The affected filter passed 7/7. Phase 1-5 selected SQL regressions passed125; authorization/concurrency SQL passed87; frontend passed185; AI passed36. Browser coverage is118 distinct checks for the current integrated set (previous110 plus8 new creation/category API checks); the round3 reruns repeat earlier journeys and are not added again. Five persisted invariant definitions passed. Backend/frontend builds and `git diff --check` passed. Diagnostic samples, repeated suite runs, fixtures and browser replays are not counted as unique tests.

Comparison with round2-final-safe.trx confirms 131 prior skips and exactly four additions: `Creation_tree_and_existing_authoring_share_no_lock_inversion_and_preserve_tree_invariants`; `Captured_creation_authority_cannot_outlive_current_membership_or_lockout`; `Real_SQL_gate_wait_does_not_retain_captured_creation_authorization`; and `Category_selection_wait_rechecks_current_lockout_without_changing_membership_policy`. All four belong to `Phase6ACreationAuthorizationSqlTests` and their safe-final.trx reason messages require an explicitly approved isolated LocalDB identity. The safe backend totals remain 442 passed, 0 failed, 135 skipped, 577 total.

### Exact skipped test names from safe-final.trx

- `esham.Tests.AccountFinalizationSqlServerTests.Failure_after_identity_writes_rolls_back_profile_memberships_wallet_and_ledger`
- `esham.Tests.LessonProgressSqlServerTests.Transient_save_retries_with_fresh_tracking`
- `esham.Tests.Phase6AAuthorizationRaceSqlTests.Queued_curriculum_write_rechecks_membership_before_persisting`
- `esham.Tests.Phase6AExpandedAuthorizationSqlTests.Metadata_curriculum_revision_publication_and_progress_share_actors_without_SQL_errors`
- `esham.Tests.NotificationSqlServerTests.Failure_after_bulk_read_all_update_rolls_back_every_read_change`
- `esham.Tests.Phase4HardeningSqlTests.Recovery_interruption_restarts_from_durable_rows_in_a_new_scope`
- `esham.Tests.Phase6AAuthorizationRaceSqlTests.Queued_review_submission_rechecks_current_instructor_membership`
- `esham.Tests.LessonProgressSqlServerTests.Concurrent_first_position_and_exact_replays_conflict_without_overwrite`
- `esham.Tests.NotificationSqlServerTests.Failure_after_read_save_rolls_back_the_read_flag_and_timestamp`
- `esham.Tests.Phase5HardeningSqlTests.Concurrent_recovery_and_security_operations_commit_one_credential_generation`
- `esham.Tests.AdminUserSqlServerTests.Actual_sql_directory_queries_support_search_roles_status_and_pagination`
- `esham.Tests.LessonProgressSqlServerTests.All_lessons_complete_with_required_task_is_not_course_completion_and_invariants_hold`
- `esham.Tests.SubmissionSqlServerTests.Assessment_resubmission_race_and_immutable_approval_events`
- `esham.Tests.EnrollmentSqlServerTests.Both_publication_purchase_lock_orders_preserve_fees_and_original_attribution`
- `esham.Tests.CompletionSqlServerTests.Disabled_automatic_hooks_preserve_progress_and_assessment_then_durable_scan_recovers`
- `esham.Tests.PublicEducationalContentTests.Sql_public_outline_and_visibility_queries_execute_against_isolated_database`
- `esham.Tests.Phase5IsolatedEnvironmentTests.Verify_financial_receipt_review_audit_and_certificate_invariants`
- `esham.Tests.Phase4IsolatedEnvironmentTests.Prepare_fresh_Phase4_browser_graph`
- `esham.Tests.Phase2IsolatedEnvironmentTests.Verify_browser_progress_financial_and_achievement_invariants`
- `esham.Tests.SubmissionSqlServerTests.Upload_SQL_failure_rolls_back_link_and_compensates_file`
- `esham.Tests.CourseVersionUpdateSqlTests.Requested_changes_are_atomic_deduplicated_and_owner_inbox_survives_new_scope`
- `esham.Tests.Phase2IsolatedEnvironmentTests.Prepare_fresh_synthetic_learning_browser_fixtures`
- `esham.Tests.Phase5SqlTests.Actual_republication_generations_remain_distinct_when_clock_is_behind_previous_publication`
- `esham.Tests.CourseVersionUpdateSqlTests.Requested_changes_failure_before_commit_rolls_back_decision_status_log_and_notification`
- `esham.Tests.LessonProgressSqlServerTests.Invalid_duration_and_changed_actual_database_fail_closed`
- `esham.Tests.EnrollmentSqlServerTests.Lost_response_is_recovered_in_a_new_scope_after_wallet_balance_changed`
- `esham.Tests.CourseVersionUpdateSqlTests.Failure_after_saving_publication_rolls_back_pointer_receipts_notifications_and_decision`
- `esham.Tests.EnrollmentSqlServerTests.Failure_after_save_rolls_back_enrollment_wallets_ledger_and_access`
- `esham.Tests.LessonProgressSqlServerTests.Failure_after_persistence_rolls_back_progress_and_activity`
- `esham.Tests.CategoryAdminProvisioningTests.Sql_creation_persists_and_rejects_invalid_scope_without_partial_account`
- `esham.Tests.Phase5SqlTests.Fanout_pagination_interruption_concurrent_workers_and_republish_preserve_read_state`
- `esham.Tests.NotificationSqlServerTests.Internal_creation_never_commits_the_callers_business_transaction`
- `esham.Tests.AccountFinalizationSqlServerTests.Execution_strategy_retries_from_fresh_state_after_partial_identity_writes`
- `esham.Tests.PlatformModerationSqlTests.Announcements_serialize_stale_versions_and_atomic_audit_and_audience_queries_translate`
- `esham.Tests.CategoryAdminProvisioningTests.Sql_audit_failure_rolls_back_identity_user_role_and_scope`
- `esham.Tests.LessonProgressSqlServerTests.Completion_position_and_open_races_never_clear_completion`
- `esham.Tests.UserCategorySqlServerTests.Concurrent_replacements_are_whole_sets_and_do_not_merge_or_overwrite_other_kinds`
- `esham.Tests.SubmissionSqlServerTests.Concurrent_identical_uploads_and_cross_submission_identity_conflicts`
- `esham.Tests.SubmissionSqlServerTests.Interrupted_upload_reconciliation_uses_actual_database_and_respects_active_lease`
- `esham.Tests.CompletionSqlServerTests.Concurrent_last_lesson_hooks_are_atomic_and_replayable`
- `esham.Tests.Phase3IsolatedEnvironmentTests.Fresh_synthetic_submission_browser_fixture`
- `esham.Tests.CompletionSqlServerTests.Approval_hook_completes_and_repeated_assessment_preserves_first_record`
- `esham.Tests.Phase5HardeningSqlTests.Announcement_authoring_delivery_and_revoke_follow_forced_three_party_lock_chain`
- `esham.Tests.CourseResubmissionTests.Sql_comparison_survives_new_scope_and_serializes_with_content_edits`
- `esham.Tests.CompletionSqlServerTests.Last_lesson_and_instructor_approval_race_finalize_once`
- `esham.Tests.Phase4RecoveryResumeTests.Resume_in_new_process`
- `esham.Tests.SubmissionSqlServerTests.Historical_pending_approval_carries_forward_without_financial_effects`
- `esham.Tests.Phase5IsolatedEnvironmentTests.Prepare_fresh_browser_accounts_and_selected_announcements`
- `esham.Tests.Phase1IsolatedEnvironmentTests.Create_synthetic_browser_fixtures_only_in_verified_isolated_database`
- `esham.Tests.Phase6ACreationAuthorizationSqlTests.Creation_tree_and_existing_authoring_share_no_lock_inversion_and_preserve_tree_invariants`
- `esham.Tests.Phase3IsolatedEnvironmentTests.Verify_submission_browser_invariants`
- `esham.Tests.Phase5IsolatedEnvironmentTests.Deliver_only_selected_synthetic_announcements`
- `esham.Tests.EnrollmentSqlServerTests.Gate_checks_connected_database_not_just_connection_configuration`
- `esham.Tests.Phase6ACreationAuthorizationSqlTests.Real_SQL_gate_wait_does_not_retain_captured_creation_authorization`
- `esham.Tests.Phase5SqlTests.Announcement_authoring_delivery_and_revocation_race_has_no_partial_writes`
- `esham.Tests.Phase5SqlTests.Review_commit_acknowledgement_loss_reconciles_one_persisted_operation`
- `esham.Tests.CourseVersionUpdateSqlTests.Publication_and_new_enrollment_serialize_on_the_course_without_duplicate_access_or_fees`
- `esham.Tests.Phase5SqlTests.Metrics_query_count_remains_constant_as_the_synthetic_enrollment_cohort_grows`
- `esham.Tests.CompletionSqlServerTests.Durable_scan_recovers_gate_off_evidence_and_repeat_pass_is_idempotent`
- `esham.Tests.Phase4HardeningSqlTests.Mixed_shared_participants_purchase_progress_submit_approve_and_reconcile`
- `esham.Tests.SubmissionSqlServerTests.Account_wide_request_reuse_across_courses_conflicts`
- `esham.Tests.PlatformModerationSqlTests.Concurrent_appeal_decisions_commit_only_one_final_outcome`
- `esham.Tests.SubmissionSqlServerTests.Independent_creates_allocate_one_open_attempt_and_stale_edits_do_not_overwrite`
- `esham.Tests.SubmissionSqlServerTests.Finalization_edit_race_is_serialized`
- `esham.Tests.SubmissionSqlServerTests.Concurrent_identical_creates_and_account_wide_cross_task_conflicts`
- `esham.Tests.CompletionSqlServerTests.Transient_retry_and_lost_acknowledgement_reconcile_persisted_identity`
- `esham.Tests.CompletionSqlServerTests.Concurrent_reconciliation_creates_one_certificate_first_timestamp_and_notice`
- `esham.Tests.EnrollmentSqlServerTests.Concurrent_requests_never_duplicate_or_partially_transfer`
- `esham.Tests.AdminIntegrationTests.Sql_queries_and_concurrent_assignment_writes_use_explicit_isolated_database`
- `esham.Tests.PlatformModerationSqlTests.Duplicate_warning_race_creates_one_immutable_warning_and_notification`
- `esham.Tests.LessonProgressSqlServerTests.Timestamp_precision_and_repeated_positions_produce_distinct_tokens`
- `esham.Tests.LessonProgressSqlServerTests.Lost_commit_completion_reconciles_and_position_returns_canonical_conflict`
- `esham.Tests.Phase5HardeningSqlTests.Delivery_rechecks_actual_membership_after_waiting_for_the_recipient`
- `esham.Tests.AccountFinalizationSqlServerTests.Concurrent_initialization_from_independent_scopes_grants_welcome_once`
- `esham.Tests.SubmissionSqlServerTests.Concurrent_uploads_enforce_five_and_fingerprints`
- `esham.Tests.Phase5SqlTests.Metrics_translate_to_owner_scoped_sql_and_match_the_ledger`
- `esham.Tests.Phase5SqlTests.Capability_flags_fail_closed_independently_on_the_actual_isolated_target`
- `esham.Tests.Phase5SqlTests.Password_race_and_failure_preserve_stamp_and_lockout_invariants`
- `esham.Tests.CompletionSqlServerTests.Failed_approval_finalization_rolls_back_review_status_and_both_notifications`
- `esham.Tests.UserCategorySqlServerTests.Failure_after_save_rolls_back_replacement_and_legacy_profile_changes`
- `esham.Tests.AdminUserSqlServerTests.Cross_demotions_cannot_remove_both_administrators`
- `esham.Tests.Phase5SqlTests.Delivery_interruption_resumes_in_a_separate_process_without_duplicate_read_state`
- `esham.Tests.Phase6ACreationAuthorizationSqlTests.Captured_creation_authority_cannot_outlive_current_membership_or_lockout`
- `esham.Tests.CompletionSqlServerTests.Durable_scan_after_publication_uses_inherited_evidence_and_new_version_without_changing_purchase`
- `esham.Tests.Phase5SqlTests.Mixed_Phases1_through5_share_participants_without_partial_writes`
- `esham.Tests.CompletionSqlServerTests.Gate_checks_actual_catalog_inside_transaction_and_refuses_master`
- `esham.Tests.EnrollmentSqlServerTests.Version_access_staging_failure_after_intermediate_persistence_rolls_back_every_component`
- `esham.Tests.Phase1IsolatedEnvironmentTests.Provision_new_disposable_catalog_and_apply_existing_migrations_only`
- `esham.Tests.Phase6AIsolatedEnvironmentTests.Fresh_separate_admin_roles_and_trusted_public_recommendation_course`
- `esham.Tests.EnrollmentSqlServerTests.Atomic_success_and_actual_membership_owned_reads_are_verified_relationally`
- `esham.Tests.SubmissionSqlServerTests.Finalization_versus_upload_never_commits_a_partial_attachment_set`
- `esham.Tests.Phase5SqlTests.Review_audit_and_notice_rollback_after_intermediate_persistence`
- `esham.Tests.Phase4HardeningSqlTests.Concurrent_recovery_workers_preserve_one_certificate_and_notice_per_enrollment`
- `esham.Tests.LessonProgressSqlServerTests.Same_video_resume_inherits_but_changed_video_does_not_and_history_survives`
- `esham.Tests.UserCategorySqlServerTests.Transient_failure_after_save_retries_replacement_with_fresh_tracking`
- `esham.Tests.EnrollmentSqlServerTests.Lost_commit_acknowledgement_retries_to_the_existing_purchase`
- `esham.Tests.Phase6AExpandedAuthorizationSqlTests.Current_authorization_is_rechecked_after_the_course_wait`
- `esham.Tests.Phase5SqlTests.Review_publication_race_never_retargets_the_original_purchase`
- `esham.Tests.Phase5SqlTests.Concurrent_review_replay_edit_reply_and_withdraw_are_atomic`
- `esham.Tests.AdminUserSqlServerTests.Conflicting_updates_with_the_same_version_commit_only_one_action`
- `esham.Tests.Phase1IsolatedEnvironmentTests.Advance_only_the_synthetic_browser_publication`
- `esham.Tests.LessonProgressSqlServerTests.Concurrent_first_completion_inserts_once_and_preserves_first_timestamp`
- `esham.Tests.Phase4IsolatedEnvironmentTests.Verify_browser_financial_receipt_and_certificate_invariants`
- `esham.Tests.CourseVersionUpdateSqlTests.Concurrent_publications_commit_one_transition_and_one_notification_per_learner`
- `esham.Tests.SubmissionSqlServerTests.Duplicate_upload_removal_and_delayed_replay_preserve_tombstone`
- `esham.Tests.CompletionSqlServerTests.Revocation_is_gated_admin_only_audited_once_and_publicly_private`
- `esham.Tests.Phase5IsolatedEnvironmentTests.Prepare_selected_synthetic_legacy_review_without_version_attribution`
- `esham.Tests.Phase5SqlTests.Independent_duplicate_review_requests_and_cross_course_reuse_never_change_another_review`
- `esham.Tests.CategoryAdminProvisioningTests.Sql_duplicate_creation_race_commits_exactly_one_account_and_audit`
- `esham.Tests.EnrollmentSqlServerTests.Transient_save_failure_retries_with_fresh_wallet_and_enrollment_state`
- `esham.Tests.AccountFinalizationSqlServerTests.Lost_commit_acknowledgement_replays_without_a_second_welcome`
- `esham.Tests.Phase5SqlTests.Poison_delivery_batch_rolls_back_continues_and_is_recovered`
- `esham.Tests.AccountFinalizationSqlServerTests.Existing_identity_validation_failure_rolls_back_without_welcome`
- `esham.Tests.Phase6ADiagnosticsSqlTests.Controlled_mixed_workloads_record_connections_blocking_and_empty_SQL_errors`
- `esham.Tests.Phase4HardeningSqlTests.Concurrent_GET_and_completion_return_consistent_before_or_after_projection`
- `esham.Tests.SubmissionSqlServerTests.Lost_commit_finalization_reconciles_one_event`
- `esham.Tests.InstructorInsightsTests.Sql_server_queries_and_serialized_reviews_use_only_explicit_isolated_database`
- `esham.Tests.NotificationSqlServerTests.Concurrent_mark_one_and_all_update_only_owned_unread_rows_without_resetting_read_times`
- `esham.Tests.LessonProgressSqlServerTests.Publication_race_preserves_evidence_or_rejects_stale_write_without_retargeting`
- `esham.Tests.Phase4HardeningSqlTests.Recovery_crosses_fifty_rows_continues_after_poison_and_retries_without_duplicates`
- `esham.Tests.Phase1IsolatedEnvironmentTests.Verify_persisted_browser_purchase_and_failed_attempt_invariants`
- `esham.Tests.SubmissionSqlServerTests.Lost_upload_commit_keeps_committed_file_and_one_link`
- `esham.Tests.SubmissionSqlServerTests.Publication_races_with_draft_creation_and_finalization`
- `esham.Tests.Phase5SqlTests.Queued_profile_request_cannot_refresh_a_cookie_after_session_revocation`
- `esham.Tests.EnrollmentSqlServerTests.Publication_race_preserves_original_purchase_or_rejects_stale_confirmation_without_fee`
- `esham.Tests.SubmissionSqlServerTests.Concurrent_finalization_replays_create_one_notice_and_freeze_payload`
- `esham.Tests.Phase5RecoveryChildTests.Resume`
- `esham.Tests.PlatformModerationSqlTests.Failure_after_warning_save_rolls_back_escalation_warning_notification_and_audit`
- `esham.Tests.Phase5HardeningSqlTests.Metrics_preserve_historical_completion_carried_lessons_and_event_time_queues`
- `esham.Tests.SubmissionSqlServerTests.Superseded_draft_is_read_only_and_historical_pending_stays_assessable`
- `esham.Tests.CourseVersionBackfillSqlTests.Additive_migration_preserves_populated_legacy_data_without_inventing_lineage_or_notifications`
- `esham.Tests.Phase6ACreationAuthorizationSqlTests.Category_selection_wait_rechecks_current_lockout_without_changing_membership_policy`
- `esham.Tests.AdminUserSqlServerTests.Failure_after_identity_saves_rolls_back_memberships_persona_security_stamp_and_audit`
- `esham.Tests.CompletionSqlServerTests.Intermediate_failure_rolls_back_lesson_completion_enrollment_certificate_and_notice`
- `esham.Tests.CompletionSqlServerTests.Publication_race_pins_actual_locked_version_and_preserves_receipts`

Historical command-lock SQL errors, SQL pre-login timeouts, and unexplained slow completion runs (including the previously recorded 27m01s case) remain unresolved. Round3 diagnostics reduce neither those historical events nor establish a causal explanation.

The current working-tree path count is recorded in PHASE6A-GRADUATION-READINESS.md. The reports are documentation-only reconciliation; no application/test/configuration/database changes were made in this follow-up.
