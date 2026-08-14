# Conventions: @goodboy/db

> **Read this when** you're writing code inside `@goodboy/db` and need storage and schema rules. **Not for** repo-wide process rules (`CONVENTIONS.md`) or TypeScript style (`docs/typescript/`).

SQLite schema, migrations, and queries. Runs locally on the user's machine via `tauri-plugin-sql`. Business logic goes to `@goodboy/core`, Tauri bindings to `apps/desktop`.

## Storage rules

**Local-only** persistence. No data leaves the user's machine.

- DB file lives at `~/.goodboy/data.db` (or platform-equivalent app data dir).
- API keys NEVER stored here. Use the OS keyring via the desktop secret store.
- Conversation history is stored locally so Goodboy owns the conversation across providers. Nothing transmitted.
- User can wipe the DB by deleting the file. Reset = clean slate.

## Schema rules

- Snake_case for table and column names.
- Every table has `id TEXT PRIMARY KEY` (UUIDs as strings), `created_at INTEGER NOT NULL` (unix ms) and `updated_at INTEGER NOT NULL`.
- Foreign keys: `<entity>_id` naming, `ON DELETE` behavior explicit (CASCADE or RESTRICT, never default).
- No `BOOLEAN`: use `INTEGER` (0/1) with `is_`/`has_` naming.
- Indexes on every foreign key and on columns used in `WHERE`/`ORDER BY`.
- `CHECK` constraints for enums: `status TEXT NOT NULL CHECK (status IN (...))`.

## Migrations

Renumbering trap and runner mechanics owned by [docs/architecture.md](../../docs/architecture.md) → Database migrations.

- SQL is exported as a template-literal string so the same source ships through `tauri-plugin-sql` at runtime and through `better-sqlite3` in tests.
- Each migration is idempotent (`CREATE TABLE IF NOT EXISTS`, conditional column adds).
- Never edit a migration after it has shipped. Add a new one.

## Query patterns

- Typed query functions, one per use case. No generic ORM.
- Parameterized queries only. Never string concatenation.
- Return domain types from `@goodboy/types`, not raw rows. Mapping happens here.
- No N+1 queries. Use joins or batched fetches.
- Transactions for multi-statement writes.

## Error handling

- Map SQLite errors to typed domain errors (`UniqueViolation`, `ForeignKeyViolation`, `NotFound`).
- Never expose raw SQLite error strings to the UI.
