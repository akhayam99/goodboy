# Database migrations

> **Read this when** you need the migration runner's behavior: version
> collisions, the schema gate, checkpoints, the copy taken before a migration,
> a database from a newer build, or a wipe. **Not for** the steps to add one
> ([recipes/migration.md](../recipes/migration.md)) or who writes a table
> ([architecture.md](../architecture.md#who-writes-each-table)). The other
> pages are listed in [architecture.md](../architecture.md).

To add one, follow [recipes/migration.md](../recipes/migration.md). Once a
migration has shipped, never edit it.

## Versions

The runner (`runner.ts`) keeps a list of every version it applied, not only the
highest, and skips any version already in `schema_version`. So if two branches
both add version N, the second to merge never runs on machines that already ran
the first. Nothing warns you, and it never catches up: give it a new number
before you merge. Once the numbers differ, two migrations that touch different
tables can run in any order.

Boot (`shared/lib/dbBoot.ts`) reads the highest `schema_version` row and loads
the migration code only when it differs from `LATEST_MIGRATION_VERSION`. A
database ahead of the build also loads it, so the downgrade guard still runs.
The SQLite `user_version` pragma is not used: the backend blocks it.

## The schema gate

No query reaches a table before the migrations of this build are applied.

1. `main.tsx` closes the gate (`shared/lib/schemaGate.ts`) before the first
   render.
2. `tauriDatabase` waits on it before every statement; the runner and the
   version probe use `migrationDatabase`, which does not.
3. `runDbMigrations` opens it only after the runner returned, so the resolve
   drain, the polls and every slice that starts under the "updating your
   library" splash run on the new schema.

A migration that throws rolls back its part, records no version and leaves the
gate closed. The launch error screen shows the error with Retry, which runs the
migrations again. `wipeDb` closes the gate while it replays the schema.

## Parts and statements

The runner splits each migration into parts at every `PRAGMA foreign_keys`
line. Each part commits on its own and saves a checkpoint in
`schema_migration_segment`, so a migration that stopped halfway resumes at the
next part. Only the last part writes `schema_version` and clears the
checkpoints.

- Up to `ALREADY_EXISTS_TOLERATED_THROUGH_VERSION` (234, the last version
  before the checkpoint), a statement failing with "already exists" or
  "duplicate column name" counts as done, with a warning. A newer version
  fails, so a collision never hides behind a skipped statement.
- Statements split on semicolons, but a `CREATE TRIGGER ... BEGIN ... END`
  stays whole. A trigger without its closing `END` fails the migration.

## The copy before a migration

When a file that holds data has migrations waiting, the runner first asks Rust
for a copy next to it (`db_create_migration_snapshot`, a `VACUUM INTO` on the
managed connection; the window SQL path refuses it). If the copy fails, no
migration runs. An empty file (no version, no table) gets no copy.

- **Name.** `data.db.pre-m<next>-from-m<current>-<timestamp>.bak`: `<next>` is
  the lowest version waiting to run, `<current>` the highest applied. The
  runner also reads the older `data.db.pre-m<current>-<timestamp>.bak`
  (`downgradeGuard.ts`).
- **Retention.** Found by the `data.db.pre-m` prefix and aged by the trailing
  timestamp; the two newest are kept.

These copies are how you roll back a migration that cannot be undone. From m117
on, 0.1.x builds cannot read the schema
([ADR 001](../adr/001-workspace-project-rename.md)). Restore the copy;
installing an older app on top does not work.

## A database from a newer build

A file that holds a migration newer than any this build knows is refused with
`DatabaseFromNewerBuildError`, before any copy or run. The app shows "This
database was upgraded by a newer Goodboy." It cannot name that version, because
`schema_version` does not record it. The screen offers two ways out:

- **Restore** the newest copy this build can read. The current file moves aside
  as `data.db.newer-build-<ms>.bak`, the copy takes its place, and boot starts
  again.
- **Quit.**

## Delete all data

**Settings › Backup and reset › Danger zone › Delete all data** stops every
running turn, summary, planner, script and terminal. Then `db_wipe` empties the
file in one atomic step (`SQLITE_DBCONFIG_RESET_DATABASE` plus `VACUUM`), and
the chain replays from m001. It never drops tables one by one: that leaves
views like `live_agents` behind, and the replay's first `ALTER TABLE ... RENAME`
fails on them ([traps](../traps.md#traps-in-the-toolchain)).

A file an older build wiped that way is healed at launch. `db::open` finishes
the wipe only when a view reads a missing table and one of `schema_version`,
`sessions` or `agents` is missing:

1. It checkpoints the WAL and copies the file (with `-wal` and `-shm`) to
   `data.db.pre-reset-<unix seconds>.bak`. If the copy fails, nothing is reset.
2. It runs the same reset before the migrations.

A broken view on a complete schema, and any other failure, still show the error
screen.

## Tests

- `registry.test.ts` fails when two migrations share a version, a number is
  skipped, or a filename does not match its version. It pins every shipped
  body by SHA-256 in `SHIPPED_MIGRATION_SQL_SHA256`; a new migration fails until
  you paste its SHA, and the failure prints the lines. It also checks that
  upgrading from twelve sampled versions, plus the oldest and newest, ends at
  the schema of a fresh install.
- `dbBoot.test.ts` upgrades databases left at m1, m139, m220, m224 and m243
  (0.39) with the resolve queue asked first, starts the resolve drain before an
  upgrade, and fails a migration then retries it.
- `schema-fixture.test.ts` renders the migrated schema (without the search
  shadow tables) into
  `apps/desktop/src-tauri/src/test_support/migrated_schema.sql` and fails when
  it differs; `GOODBOY_UPDATE_SCHEMA_FIXTURE=1` regenerates it. Rust tests never
  hand-write a table: they load it through
  `test_support::migrated_connection()`.
- `check-parity.test.ts` compares the string `CHECK` lists of the migrated
  schema, column by column, with the constant that owns them.
