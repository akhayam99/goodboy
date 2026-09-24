# Conventions: @goodboy/db

> **Read this when** you're writing code inside `@goodboy/db` and need the storage and schema rules. **Not for** process rules for the whole repo (`CONVENTIONS.md`) or TypeScript style (`docs/typescript/`).

The SQLite schema, migrations, and queries. At run time every statement goes through the desktop's `rusqlite` connection, behind the `db_exec`, `db_execute`, `db_select` and `db_transaction` Tauri commands (`apps/desktop/src-tauri/src/db.rs`, reached through `tauriDatabase`). Tests run the same `Database` contract on `better-sqlite3` through `@goodboy/db/test-helpers`. Business logic goes to `@goodboy/core`, Tauri bindings to `apps/desktop`.

## Storage rules

Data is stored **only locally**. No data leaves the user's machine.

- The DB file lives at `~/.goodboy/data.db` (or the app data folder that matches the platform).
- API keys are NEVER stored here. Use the OS keyring through the desktop secret store.
- Conversation history is stored locally, so Goodboy owns the conversation across providers. Nothing is sent anywhere.
- The user can wipe the DB by deleting the file. Reset = clean slate.
- Retention runs at boot in `runDatabaseHygiene`. `permission_audit_log` keeps 30 days and at most 5000 rows. `turn_events` keeps 90 days and at most 200k rows. A finished `provider_runs` row older than 90 days is deleted only when no `telemetry_records`, `agents` or `file_versions` row points at it. Spend rows are never pruned.

## Schema rules

- Snake_case for table and column names.
- Every table has `id TEXT PRIMARY KEY` (UUIDs as strings), `created_at INTEGER NOT NULL` (unix ms) and `updated_at INTEGER NOT NULL`.
- Foreign keys: named `<entity>_id`, with an explicit `ON DELETE` behavior (CASCADE or RESTRICT, never the default). `SET NULL` is allowed for a history link that must outlive the row it points at.
- No `BOOLEAN`. Use `INTEGER` (0/1) with `is_`/`has_` naming.
- Indexes on every foreign key and on columns used in `WHERE`/`ORDER BY`.
- `CHECK` constraints for enums: `status TEXT NOT NULL CHECK (status IN (...))`.

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
- A stored JSON column is read through `parseJsonColumn` in `src/shared/parseJsonColumn.ts`, with a type guard and a fallback. One malformed row then falls back or is skipped, instead of failing the whole list.
- A write with more than one statement goes through `db.transaction` with guards. Never `exec('BEGIN')`. When a write depends on a read: read, plan, then write. `transactions.test.ts` fails on a hand-written `BEGIN`, `COMMIT` or `ROLLBACK` outside the migration runner.

## Error handling

- Map SQLite errors and guard aborts to the typed errors in `src/shared/errors.ts` (`UniqueViolationError`, `NotFoundError`), or to the `false` that a guarded write already returns. There is no foreign key error class. A violated foreign key shows up as the SQLite error.
- Never show raw SQLite error strings in the UI.
