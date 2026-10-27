# Recipe: a database migration

> **Read this when** a table or a column changes. **Not for** the runner's
> behavior ([architecture.md](../architecture.md) → Database migrations).

## Steps

1. Take the next free number in `packages/db/src/migrations/`. A version is never reused and never skipped; ask the owner when two units want one.
2. Create `mNNN-kebab-name.ts` exporting one SQL string named `mNNNName`, and register it in `packages/db/src/migrations/index.ts` with the number from its filename.
3. Never edit a shipped migration; write a new one.
4. Run `registry.test.ts`. It fails and prints the new version's SHA-256 line; paste it into `SHIPPED_MIGRATION_SQL_SHA256` in that file, above the manifest head. A pinned body never changes again.
5. Add or change the queries in `packages/db/src/queries/` and the types in `packages/types`.
6. Regenerate the Rust schema fixture: `GOODBOY_UPDATE_SCHEMA_FIXTURE=1 pnpm --filter @goodboy/db exec vitest run src/migrations/schema-fixture.test.ts`, then commit `apps/desktop/src-tauri/src/test_support/migrated_schema.sql`. Rust tests load it with `crate::test_support::migrated_connection()`; never write a `CREATE TABLE` of a real table by hand in a Rust test. A new string `CHECK` list needs its constant in `check-parity.test.ts`.
7. Squash migrations of the same feature before their first release: one migration per shipped change, not one per commit. A rebuild of a table that an earlier migration of the same unreleased feature rebuilt is one migration.
8. If the change moves state that lives outside SQLite, follow [versioning.md](../versioning.md) → State outside SQLite.

## Label and release

A pull request that adds a file `mNNN-*.ts` gets the `db-migration` label from the `db-migration label` workflow, with nothing to do by hand, and waits for the next minor release ([versioning.md](../versioning.md)). A version above `ALREADY_EXISTS_TOLERATED_THROUGH_VERSION` in `runner.ts` fails on "already exists" instead of skipping the statement, so a new migration cannot lean on that tolerance.

## Test

A test that migrates a database to your own version and checks the result, and `registry.test.ts`, which pins every shipped body by SHA-256 and compares an upgrade from twelve sampled older versions, plus the oldest and the newest, with a fresh install. The other versions are covered by the pin, not by a run.

## Docs that move

[architecture.md](../architecture.md) when a table gets a new writer, and [traps.md](../traps.md) for a trap.

## Failure-mode rows that apply

Resume after a half run, second window, the rollback copy.

## Guards

`registry.test.ts` (duplicate, gap, filename, SHA pin, sampled convergence), `schema-fixture.test.ts` (the generated Rust fixture is current), `check-parity.test.ts` (CHECK lists against their constants), the Rust schema tests, `pnpm run check:baselines`.
