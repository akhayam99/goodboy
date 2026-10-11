# Recipe: a database migration

> **Read this when** a table or a column changes. **Not for** the runner's
> behavior ([architecture.md](../architecture.md) → Database migrations).

## Steps

1. Take the next free number in `packages/db/src/migrations/`. A version is never reused and never skipped; ask the owner when two units want one.
2. Create `mNNN-kebab-name.ts` exporting one SQL string named `mNNNName`, and register it in `packages/db/src/migrations/index.ts` with the number from its filename.
3. Never edit a shipped migration; write a new one.
4. Add or change the queries in `packages/db/src/queries/` and the types in `packages/types`.
5. If Rust reads or writes the table, update its schema fixtures under `apps/desktop/src-tauri/src` (the schema tests).

## Test

A test that migrates a database to your own version and checks the result, and `registry.test.ts`, which compares an upgrade from every older version with a fresh install.

## Docs that move

[architecture.md](../architecture.md) when a table gets a new writer, and [traps.md](../traps.md) for a trap.

## Failure-mode rows that apply

Resume after a half run, second window, the rollback copy.

## Guards

`registry.test.ts` (duplicate, gap, filename), the Rust schema tests, `pnpm run check:baselines`.
