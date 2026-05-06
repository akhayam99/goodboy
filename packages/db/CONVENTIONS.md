# Conventions — @kay-am/db

SQLite schema, migrations, and queries for kAY.am. Runs locally on the user's machine via `tauri-plugin-sql`.

## Scope

- Schema definitions (DDL).
- Idempotent migrations.
- Query builders / typed query functions.
- Row-shape types (mirroring `@kay-am/types` domain types where relevant).

## What does NOT belong here

- Business logic → `@kay-am/core`.
- Tauri command bindings → `apps/desktop`.
- React components.

## Storage rules

This is **local-only** persistence. No data leaves the user's machine.

- DB file lives at `~/.kay-am/data.db` (or platform-equivalent app data dir).
- API keys NEVER stored here — use OS keyring via Tauri keyring plugin.
- No conversation content stored. Sessions store metadata only (titles, status, timestamps, provider used, cost summary).
- User can wipe the DB by deleting the file. Reset = clean slate.

## Schema rules

- Snake_case for table and column names (`workspace_sessions`, `created_at`).
- Every table has `id TEXT PRIMARY KEY` (UUIDs as strings).
- Every table has `created_at INTEGER NOT NULL` (unix ms) and `updated_at INTEGER NOT NULL`.
- Foreign keys: `<entity>_id` naming, with `ON DELETE` behavior explicit (CASCADE or RESTRICT — never default).
- No `BOOLEAN` — SQLite has no native boolean. Use `INTEGER` (0/1) with a clear naming convention (`is_active`, `has_completed`).
- Indexes on every foreign key and on columns used in `WHERE`/`ORDER BY`.
- Use `CHECK` constraints for enums: `status TEXT NOT NULL CHECK (status IN ('todo', 'in_progress', 'done'))`.

## Migrations

- Sequential, numbered: `001_initial.sql`, `002_add_provider_usage.sql`, etc.
- Each migration is idempotent (`CREATE TABLE IF NOT EXISTS`, conditional column adds).
- Never edit a migration after it has shipped — add a new one.
- Migration runner verifies version against schema_version table; refuses to start on mismatch.

## Query patterns

- Typed query functions, one per use case. No generic ORM.
  ```ts
  export async function getWorkspaceById(
    db: Database,
    id: WorkspaceId,
  ): Promise<Workspace | null> { ... }
  ```
- Parameterized queries only. Never string concatenation.
- Return domain types from `@kay-am/types`, not raw rows. Mapping happens here.
- No N+1 queries. Use joins or batched fetches.
- Transactions for multi-statement writes.

## Error handling

- Map SQLite errors to typed domain errors (`UniqueViolation`, `ForeignKeyViolation`, `NotFound`).
- Never expose raw SQLite error strings to the UI.

## Folder structure

```
src/
├── index.ts              # public API
├── client.ts             # database client wrapper
├── migrations/
│   ├── 001_initial.sql
│   ├── 002_*.sql
│   └── runner.ts
├── queries/
│   ├── workspace.ts
│   ├── task.ts
│   ├── provider.ts
│   └── usage.ts
└── shared/
    └── errors.ts
```
