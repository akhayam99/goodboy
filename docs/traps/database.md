# Traps in SQLite, migrations and Impact reads

> **Read this when** you write a migration, rebuild a table, touch the search
> index, the webview SQL authorizer or an Impact query. **Not for** the
> migration steps ([../recipes/migration.md](../recipes/migration.md)) or
> the runner ([../architecture.md](../architecture.md) → Database migrations).

## Schema and migrations

### Migration versions form one contiguous range

`registry.test.ts` requires versions contiguous from 1. Two open pull requests that each add a migration merge in numeric order; the higher one first leaves a gap and turns `main` red. Renumbering is in [architecture.md](../architecture.md) → Database migrations.

### A shipped migration's SQL is pinned by hash

m230's sql is pinned by hash in `registry.test.ts`. Before the release ships, a change needs the new hash pasted there; after, it is immutable.

### `DROP TABLE` keeps the views that read the table

SQLite drops a table a view reads and keeps the view; the next `ALTER TABLE ... RENAME`, on any table, then fails with `error in view <name>: no such table`. A reset that drops tables one by one strands `live_agents` (m156), and the replay dies at m015's rebuild. Reset with `reset_database` in `db.rs`, never a `DROP TABLE` loop. The launch check that heals such a file also needs a missing core table, because a broken view alone is no proof of a wipe and resetting would erase a live database.

### A table rebuild drops its search triggers

The search index (m211) is fed by triggers on fourteen source tables, listed in m211 and its test. A rebuild (`CREATE ..._new`, `DROP`, `RENAME`) drops the dropped table's triggers, so the migration recreates them; `m211-search-index.test.ts` fails on a missing one. A trigger body reads only its own row and the `search_*` tables: naming another source table breaks that table's next rebuild rename, like a view.

### An `auto_*` rebuild turns foreign keys off

m232 rebuilds `auto_delegations` inside `PRAGMA foreign_keys = OFF`, or the drop cascades into `auto_attempts`. Every later `auto_*` rebuild does the same, and its test counts the child rows before and after.

### The webview SQL authorizer sees what SQLite runs inside a statement

A write to a searchable table fires the triggers, and the full text index reads `PRAGMA data_version` inside the statement. The authorizer in `db.rs` sees a window pragma there, so a pragma missing from `ALLOWED_PRAGMAS` fails a plain `DELETE` ("authorization denied"), and the boot hygiene `DELETE` on `github_pr_cache` fails every launch. SQLite also runs `PRAGMA quick_check` inside `ALTER TABLE ... DROP COLUMN`, which older migrations use on a fresh install's first boot.

A new window pragma or indexed table needs a `db.rs` test that writes through `run_webview_sql` on the migrated schema. `webview_sql_runs_every_migration_from_an_empty_database` replays `test_support/migrations.json` under the authorizer, and `packages/db/src/migrations/migrations-fixture.test.ts` fails when that file falls behind.

## Impact reads

### Impact counts deleted sessions on purpose

A session delete is soft: `purgeSessionForDelete` frees the transcript, file versions, slots, decisions and images and keeps the row with `deleted_at`. Never add `s.deleted_at IS NULL` to `packages/db/src/queries/impact.ts` or `impact-pull-requests.ts` (`impact-lifecycle.test.ts` fails); the `a.deleted_at` filters stay, as they mean agents removed from a workflow. Windows and durations read `COALESCE(last_activity_at, updated_at)`, and the purge keeps `updated_at`, so a session deleted today stays in its last activity's window.

### Impact never reads `github_pr_cache`

Boot hygiene (`runDatabaseHygiene`) deletes cache rows whose branch has no live session, which is exactly the shipped work. Merged pull requests come from `mount_pr_links` and `pr_merged` session events, keyed by host, repository and number. A detached project deletes its mount and links, so the same cleanup writes a `pr_merged` event for each merged link without one (`backfillMergedPullRequestEvents`). A merge done in Goodboy carries host and repository (`mountPrEventPayload`), so it and the observed transition dedupe to one event.

### Impact settles a live mount only through the sweep

Only `sweepRequests` settles a live attached mount, never a link write. `refreshDormantPullRequests` writes links straight to the database and the sweep compares against the stored link, so a link it settled first would skip a live worktree's merge cleanup proposal. `listDormantOpenPullRequests` keeps to archived or deleted sessions and detached mounts.
