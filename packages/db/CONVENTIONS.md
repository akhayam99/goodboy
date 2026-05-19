# Conventions — @kay-am/db

SQLite schema, migrations, and queries for kAY.am. Runs locally on the user's machine via `tauri-plugin-sql` in production and `better-sqlite3` in tests.

See [ADR-0006](../../docs/adr/0006-db-schema-hygiene.md) for the schema hygiene rationale.

## Scope

- Schema definitions (DDL).
- Idempotent migrations.
- Typed query functions.
- Row → domain mapping at the query boundary.

## What does NOT belong here

- Business logic → `@kay-am/core`.
- Tauri command bindings → `apps/desktop`.
- React components → `apps/desktop` / `@kay-am/ui`.
- Domain types: defined in `@kay-am/types`, mapped here.

## Dependency direction

`@kay-am/db` may only import from `@kay-am/types`. It **must not** import from `@kay-am/core`, `@kay-am/ui`, or any app code. Test fixtures inline rather than reach upward.

## Storage model

This is **local-only** persistence. No data leaves the user's machine.

- DB file at `~/.kay-am/data.db` (or platform-equivalent app-data dir).
- API keys NEVER stored here — use the OS keyring.
- Conversation history, telemetry, etc. live locally so kAY.am owns the conversation across providers.
- User can wipe the DB by deleting the file; reset = clean slate. The `db_wipe` Tauri command does the same in-place.

## Schema rules

- snake_case for tables and columns.
- Every table: `id TEXT PRIMARY KEY` (UUID v4).
- Every table: `created_at INTEGER NOT NULL`, `updated_at INTEGER NOT NULL` (ms epoch). No `TEXT` ISO timestamps in DB columns — store the integer, convert at the mapper.
- Every FK: `<entity>_id` naming, explicit `ON DELETE` (`CASCADE` or `RESTRICT`).
- Every enum column: `CHECK (col IN ('a', 'b', 'c'))`.
- No `BOOLEAN`. `INTEGER` 0/1 named `is_*` / `has_*` / similar.
- Indexes on every FK and on every column used in `WHERE` / `ORDER BY` (small tables exempted).

## Migrations

- Sequential, numbered: `m001-initial.ts`, `m002-...ts`, ..., `mNNN-<slug>.ts`.
- SQL exported as a template-literal string so the same source ships via `tauri-plugin-sql` at runtime and through `better-sqlite3` in tests.
- Each migration is **idempotent** (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, conditional column adds). The runner gates re-runs by `schema_version`, but migrations must remain re-runnable in isolation.
- **Never edit a shipped migration.** Bug fixes land as new migrations.
- The runner records applied versions in `schema_version` and skips them on subsequent boots.

## Query patterns

- One typed function per use case. No generic ORM.

  ```ts
  export async function getWorkspaceById(
    db: Database,
    id: WorkspaceId,
  ): Promise<Workspace | null> { ... }
  ```

- **Parameterised queries only.** Never string-interpolate user values.
- **Return domain types from `@kay-am/types`.** Raw `*Row` interfaces stay private to the query file. Mapping happens here; rows never escape.
- No N+1. Use joins or batched fetches.
- Transactions for multi-statement writes.

## Error handling

- Map SQLite errors to typed domain errors (`UniqueViolation`, `ForeignKeyViolation`, `NotFound` — see `shared/errors.ts`).
- Never expose raw SQLite error strings to the UI.

## Folder structure

```
src/
├── index.ts              # public API (re-exports)
├── client.ts             # Database interface
├── migrations/
│   ├── index.ts          # ordered list
│   ├── m001-initial.ts
│   ├── ...
│   ├── runner.ts         # migrate(db, migrations?) → MigrateResult
│   └── runner.test.ts
├── queries/
│   ├── workspace.ts
│   ├── session.ts
│   ├── notification.ts
│   └── ...
├── shared/
│   └── errors.ts
└── test-helpers/
    └── test-db.ts        # better-sqlite3 adapter (devDep, tests only)
```

## Testing

- Colocated `*.test.ts` per query file.
- The migration runner test runs the full chain against an in-memory DB.
- Each new query function should ship with at least one smoke test that exercises insert + read-back.
