# Conventions: @goodboy/db

> **Read this when** you're writing code inside `@goodboy/db` and need the storage and schema rules. **Not for** process rules for the whole repo (`CONVENTIONS.md`) or TypeScript style (`docs/typescript/`).

The SQLite schema, migrations, and queries. They run locally on the user's machine through `tauri-plugin-sql`. Business logic goes to `@goodboy/core`, Tauri bindings to `apps/desktop`.

## Storage rules

Data is stored **only locally**. No data leaves the user's machine.

- The DB file lives at `~/.goodboy/data.db` (or the app data folder that matches the platform).
- API keys are NEVER stored here. Use the OS keyring through the desktop secret store.
- Conversation history is stored locally, so Goodboy owns the conversation across providers. Nothing is sent anywhere.
- The user can wipe the DB by deleting the file. Reset = clean slate.

## Schema rules

- Snake_case for table and column names.
- Every table has `id TEXT PRIMARY KEY` (UUIDs as strings), `created_at INTEGER NOT NULL` (unix ms) and `updated_at INTEGER NOT NULL`.
- Foreign keys: named `<entity>_id`, with an explicit `ON DELETE` behavior (CASCADE or RESTRICT, never the default).
- No `BOOLEAN`. Use `INTEGER` (0/1) with `is_`/`has_` naming.
- Indexes on every foreign key and on columns used in `WHERE`/`ORDER BY`.
- `CHECK` constraints for enums: `status TEXT NOT NULL CHECK (status IN (...))`.

## Migrations

[docs/architecture.md](../../docs/architecture.md) → Database migrations owns the renumbering trap and how the runner works.

- SQL is exported as a template-literal string. That way the same source ships through `tauri-plugin-sql` at runtime and through `better-sqlite3` in tests.
- Each migration is idempotent, so running it twice is safe (`CREATE TABLE IF NOT EXISTS`, conditional column adds).
- Never edit a migration after it has shipped. Add a new one.

## Query patterns

- Typed query functions, one per use case. No generic ORM.
- Parameterized queries only. Never string concatenation.
- Return domain types from `@goodboy/types`, not raw rows. The mapping happens here.
- No N+1 queries. Use joins or batched fetches.
- A write with more than one statement goes through `db.transaction` with guards. Never `exec('BEGIN')`. When a write depends on a read: read, plan, then write. `transactions.test.ts` fails on a hand-written `BEGIN`, `COMMIT` or `ROLLBACK` outside the migration runner.

## Error handling

- Map SQLite errors to typed domain errors (`UniqueViolation`, `ForeignKeyViolation`, `NotFound`).
- Never show raw SQLite error strings in the UI.
