# Conventions - @goodboy/db

SQLite schema, migrations, and queries for Goodboy. Runs locally on the user's machine via `tauri-plugin-sql`.

## Scope

- Schema definitions (DDL).
- Idempotent migrations.
- Query builders / typed query functions.
- Row-shape types (mirroring `@goodboy/types` domain types where relevant).

## What does NOT belong here

- Business logic → `@goodboy/core`.
- Tauri command bindings → `apps/desktop`.
- React components.

## Storage rules

This is **local-only** persistence. No data leaves the user's machine.

- DB file lives at `~/.goodboy/data.db` (or platform-equivalent app data dir).
- API keys NEVER stored here - use OS keyring via the desktop secret store.
- Conversation history (messages, slots, runs, telemetry) is stored locally so Goodboy owns the conversation across providers. Nothing transmitted.
- User can wipe the DB by deleting the file. Reset = clean slate.

## Schema rules

- Snake_case for table and column names (`workspace_sessions`, `created_at`).
- Every table has `id TEXT PRIMARY KEY` (UUIDs as strings).
- Every table has `created_at INTEGER NOT NULL` (unix ms) and `updated_at INTEGER NOT NULL`.
- Foreign keys: `<entity>_id` naming, with `ON DELETE` behavior explicit (CASCADE or RESTRICT - never default).
- No `BOOLEAN` - SQLite has no native boolean. Use `INTEGER` (0/1) with a clear naming convention (`is_active`, `has_completed`).
- Indexes on every foreign key and on columns used in `WHERE`/`ORDER BY`.
- Use `CHECK` constraints for enums: `status TEXT NOT NULL CHECK (status IN ('todo', 'in_progress', 'done'))`.

## Migrations

- Sequential, numbered: `m001-initial.ts`, `m002-...ts`, etc. SQL is exported as a template-literal string so the same source ships through `tauri-plugin-sql` at runtime and through `better-sqlite3` in tests.
- Each migration is idempotent (`CREATE TABLE IF NOT EXISTS`, conditional column adds).
- Never edit a migration after it has shipped - add a new one.
- The runner records applied versions in `schema_version` and skips them on re-run.

## Query patterns

- Typed query functions, one per use case. No generic ORM.
  ```ts
  export async function getWorkspaceById(
    db: Database,
    id: WorkspaceId,
  ): Promise<Workspace | null> { ... }
  ```
- Parameterized queries only. Never string concatenation.
- Return domain types from `@goodboy/types`, not raw rows. Mapping happens here.
- No N+1 queries. Use joins or batched fetches.
- Transactions for multi-statement writes.

## Error handling

- Map SQLite errors to typed domain errors (`UniqueViolation`, `ForeignKeyViolation`, `NotFound`).
- Never expose raw SQLite error strings to the UI.

## Folder structure

```
src/
├── index.ts              # public API (re-exports)
├── client.ts             # Database interface
├── migrations/
│   ├── index.ts          # ordered list
│   ├── m001-initial.ts   # SQL as exported string
│   ├── runner.ts         # migrate(db, migrations?) → MigrateResult
│   └── runner.test.ts
├── queries/
│   ├── workspace.ts
│   ├── session.ts
│   ├── message.ts
│   ├── context-slot.ts
│   ├── provider-run.ts
│   ├── telemetry.ts
│   └── settings.ts
├── shared/
│   └── errors.ts
└── test-helpers/
    └── test-db.ts        # better-sqlite3 adapter (devDep, tests only)
```
