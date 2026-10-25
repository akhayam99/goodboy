# Conventions: @goodboy/db

> **Read this when** you're writing code inside `@goodboy/db` and need the storage and schema rules. **Not for** process rules for the whole repo (`CONVENTIONS.md`) or TypeScript style (`docs/typescript/`).

The SQLite schema, migrations, and queries. At run time every statement goes through the desktop's `rusqlite` connection, behind the `db_exec`, `db_execute`, `db_select` and `db_transaction` Tauri commands (`apps/desktop/src-tauri/src/db.rs`, reached through `tauriDatabase`). Tests run the same `Database` contract on `better-sqlite3` through `@goodboy/db/test-helpers`. Business logic goes to `@goodboy/core`, Tauri bindings to `apps/desktop`.

## Storage rules

Data is stored **only locally**. No data leaves the user's machine.

- The DB file lives at `~/.goodboy/data.db` in a release build and `~/.goodboy/data.dev.db` in a debug build (`pnpm tauri dev`). `GOODBOY_DB_FILE` overrides it: an absolute path is used as given, a relative one sits under `~/.goodboy`. No platform data folder is used.
- API keys are NEVER stored here. Use the OS keyring through the desktop secret store.
- Conversation history is stored locally, so Goodboy owns the conversation across providers. Nothing is sent anywhere.
- The user can wipe the DB by deleting the file. Reset = clean slate.
- Retention runs at boot in `runDatabaseHygiene`, and every limit sits in one table, `DATABASE_RETENTION` in `maintenance/retention.ts`: `permission_audit_log` keeps 30 days and at most 5000 rows, `turn_events` keeps 90 days and at most 200k rows, a finished `provider_runs` row is pruned after 90 days and an in-flight one is cancelled after one day. Each prune deletes in batches of `PRUNE_BATCH_ROWS` (5000) through `pruneInBatches`, so no single statement holds the write lock for the whole backlog. Pruning does not shrink the file: freed pages are reused, and only the `VACUUM` of the storage screen returns space to the disk. A finished `provider_runs` row older than 90 days is deleted only when no `telemetry_records`, `agents` or `file_versions` row points at it. Spend rows are never pruned, and neither are `agent_turn_spans` rows, which hold no content and carry the duration history (see [docs/turns.md](../../docs/turns.md#turn-spans)). It also purges, as a single-agent delete does, the step agents a deleted workflow run left behind, and their children: a live step agent with no `workflow_run_id` whose step's workflow no longer runs in its session. It deletes `github_pr_cache` rows whose branch has no live session, and writes a `pr_merged` session event for every merged `mount_pr_links` row that has none yet, so a detached project keeps its shipped work in Impact ([docs/traps.md](../../docs/traps.md)).
- Deleting an agent and deleting a workflow run purge through the same statements, `agentPurgeStatements` in `queries/agent.ts`: the agent's open questions (returned, then deleted), messages and turn events are deleted, and the row gets `deleted_at` (an earlier tombstone time is kept) and a `NULL` `output_summary`. `purgeAgentForDelete` runs them for one id. A run delete (`detachWorkflowFromSession`, or a reorder that prunes a run) runs them in one transaction for every agent of that run and its `parent_agent_id` descendants, including agents tombstoned earlier, so the result equals deleting each agent by hand (`run-delete-parity.test.ts` pins it per workflow kind). The purge must run before the run row goes: `agents.workflow_run_id` is `ON DELETE SET NULL`, so after the delete the agents no longer name their run. The caller drops the returned question texts from the `open_questions` slot; boot does it per session from `orphanedWorkflowQuestions`.
- Workspace chats (`chats`, `chat_messages`, `chat_message_attachments`) belong to a workspace and go with it. An image row goes with its message and its chat; the image file lives in the app's `chat-attachments` folder and is removed by the chat delete, and by `chat_attachments_prune` for chats dropped in bulk (workspace delete or merge, wipe, boot). Hygiene never prunes them and nothing archives them on its own: idle is derived from `last_activity_at`, and `archived_at` is set only by the user. [docs/turns.md](../../docs/turns.md#workspace-chat-turns) owns the chat pipeline.
- Search (sessions, messages, agents, artifacts, decisions, questions, issues, pull requests, branches, workflows and diff comments) reads one local FTS5 table, `search_index`, with its filter columns in `search_docs`. Triggers on the source tables keep it current; `maintenance/searchBackfill.ts` fills rows written before m211 at idle. Tool output (`turn_events`), system messages, settings and credentials are never indexed. [docs/search.md](../../docs/search.md) owns the index.

## Schema rules

- Snake_case for table and column names.
- A new table has `id TEXT PRIMARY KEY` (UUIDs as strings), `created_at INTEGER NOT NULL` (unix ms) and `updated_at INTEGER NOT NULL`. Tables that predate the rule, or that are keyed by a parent id or a natural key (`settings`, `schema_version`, join and history rows), are listed with the columns they lack in `EXEMPT_FROM_BASE_COLUMNS` in `migrations/schema-rules.test.ts`. The list only falls: a new table that lacks one of the three fails the test, and a fixed table must be removed from the list.
- Foreign keys: named `<entity>_id`, with an explicit `ON DELETE` behavior (CASCADE or RESTRICT, never the default). `SET NULL` is allowed for a history link that must outlive the row it points at, and a pointer column that can name nothing (`auto_trees.primary_mount_id`, `auto_delegations.retry_of`) carries it. `schema-rules.test.ts` fails on a foreign key with no explicit `ON DELETE`.
- No `BOOLEAN`. Use `INTEGER` (0/1) with `is_`/`has_` naming.
- Indexes on every foreign key and on columns used in `WHERE`/`ORDER BY`.
- `CHECK` constraints for closed enums: `status TEXT NOT NULL CHECK (status IN (...))`. A column whose values come from a provider catalog (`m126-unconstrain-provider-columns.ts`) has no `CHECK`: the catalog grows without a migration. A closed enum has one constant in `@goodboy/types` or `src/queries/`, and `migrations/check-parity.test.ts` maps `table.column` to it and fails when the two lists differ. A new string `CHECK` list needs its line in `CHECKED_CONSTANTS`; the `UNLINKED_CHECKS` list of columns still without a constant only falls. Rust and TypeScript constants that spell the same value (a settings key, a schema version, a state list) are tied by `apps/desktop/src/__tests__/regressions/rust-twin-constants.test.ts`.

## Migrations

[docs/architecture.md](../../docs/architecture.md) → Database migrations owns the renumbering trap and how the runner works.

- SQL is exported as a template-literal string. That way the same source runs through the `rusqlite` bridge at run time and through `better-sqlite3` in tests.
- Migrations are not replayed. The runner applies each version once and resumes an interrupted one from its segment checkpoint, see [docs/architecture.md](../../docs/architecture.md) → Database migrations.
- Never edit a migration after it has shipped. Add a new one.

## Query patterns

- Typed query functions, one per use case. No generic ORM.
- Parameterized queries only. Never string concatenation.
- Return domain types from `@goodboy/types`, not raw rows. The mapping happens here.
- No N+1 queries. Use joins or batched fetches.
- A stored JSON column is read through `parseJsonColumn` in `src/shared/parseJsonColumn.ts`, with a type guard and a fallback. One malformed row then falls back or is skipped, instead of failing the whole list. A column that must not fall back (artifact metadata, routing JSON) goes through `parseJsonStrict` in the same file, which throws `Invalid <label>`. A list read skips a row that fails to map and logs its id (`listArtifactsForSession`, `listArtifactMirrorPage`); a single read of that row still throws. No file under `src/queries/` calls `JSON.parse(` itself: `jsonParse.test.ts` counts it per file against a baseline that is empty today.
- A write with more than one statement goes through `db.transaction` with guards. Never `exec('BEGIN')`. When a write depends on a read: read, plan, then write. `transactions.test.ts` fails on a hand-written `BEGIN`, `COMMIT` or `ROLLBACK` outside the migration runner.

## Error handling

- Map SQLite errors and guard aborts to the typed errors in `src/shared/errors.ts` (`UniqueViolationError`, `NotFoundError`), or to the `false` that a guarded write already returns. There is no foreign key error class. A violated foreign key shows up as the SQLite error.
- Never show raw SQLite error strings in the UI.
