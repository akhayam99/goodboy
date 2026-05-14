import type { Database } from '../client';
import { migrations as defaultMigrations, type Migration } from './index';

const ENSURE_VERSION_TABLE = `
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL
);
`;

export interface MigrateResult {
  readonly applied: ReadonlyArray<number>;
  readonly skipped: ReadonlyArray<number>;
  readonly currentVersion: number;
}

export async function migrate(
  db: Database,
  migrations: ReadonlyArray<Migration> = defaultMigrations,
): Promise<MigrateResult> {
  await db.exec(ENSURE_VERSION_TABLE);

  const rows = await db.select<{ version: number }>('SELECT version FROM schema_version');
  const applied = new Set(rows.map((row) => row.version));

  const ordered = [...migrations].sort((a, b) => a.version - b.version);
  const newlyApplied: number[] = [];
  const skipped: number[] = [];

  for (const migration of ordered) {
    if (applied.has(migration.version)) {
      skipped.push(migration.version);
      continue;
    }
    await db.exec(migration.sql);
    // OR IGNORE: under React StrictMode in dev, hydrate() runs twice and two
    // migrate() invocations race for the same version row. The SQL itself is
    // idempotent enough (table-rebuild recipe), but the version INSERT would
    // hit a UNIQUE constraint without OR IGNORE.
    await db.execute('INSERT OR IGNORE INTO schema_version (version, applied_at) VALUES (?, ?)', [
      migration.version,
      Date.now(),
    ]);
    newlyApplied.push(migration.version);
  }

  const currentVersion = ordered.at(-1)?.version ?? 0;
  return { applied: newlyApplied, skipped, currentVersion };
}
