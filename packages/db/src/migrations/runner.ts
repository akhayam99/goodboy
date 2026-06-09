import type { Database } from '../client';
import { migrations as defaultMigrations, type Migration } from './index';

const ENSURE_VERSION_TABLE = `
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL
);
`;

export type MigrateResult = {
  readonly applied: ReadonlyArray<number>;
  readonly skipped: ReadonlyArray<number>;
  readonly currentVersion: number;
};

export const migrate = async (
  db: Database,
  migrations: ReadonlyArray<Migration> = defaultMigrations,
): Promise<MigrateResult> => {
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
    await applyMigrationSql(db, migration);
    await db.execute('INSERT OR IGNORE INTO schema_version (version, applied_at) VALUES (?, ?)', [
      migration.version,
      Date.now(),
    ]);
    newlyApplied.push(migration.version);
  }

  const currentVersion = ordered.at(-1)?.version ?? 0;
  return { applied: newlyApplied, skipped, currentVersion };
};

async function applyMigrationSql(db: Database, migration: Migration): Promise<void> {
  const statements = migration.sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const stmt of statements) {
    try {
      await db.exec(stmt);
    } catch (err) {
      if (isAlreadyExistsError(err)) {
        // eslint-disable-next-line no-console
        console.warn(
          `[migrations] v${migration.version}: skipping idempotent statement (already applied): ${truncate(stmt)}`,
        );
        continue;
      }
      throw err;
    }
  }
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err !== null && 'message' in err) {
    return String((err as { message: unknown }).message);
  }
  return String(err);
}

function isAlreadyExistsError(err: unknown): boolean {
  const msg = errorMessage(err).toLowerCase();
  return msg.includes('duplicate column name') || msg.includes('already exists');
}

function truncate(s: string): string {
  return s.length > 80 ? `${s.slice(0, 77)}...` : s;
}
