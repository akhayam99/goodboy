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
  await abandonOpenTransaction(db);
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
    await applyMigration(db, migration);
    newlyApplied.push(migration.version);
  }

  const currentVersion = ordered.at(-1)?.version ?? 0;
  return { applied: newlyApplied, skipped, currentVersion };
};

type MigrationStep =
  | { kind: 'pragma'; sql: string }
  | { kind: 'transaction'; statements: ReadonlyArray<string> };

async function applyMigration(db: Database, migration: Migration): Promise<void> {
  const steps = planSteps(migration.sql);
  const lastTransaction = steps.reduce(
    (last, step, index) => (step.kind === 'transaction' ? index : last),
    -1,
  );
  let versionRecorded = false;

  for (const [index, step] of steps.entries()) {
    if (step.kind === 'pragma') {
      await db.exec(step.sql);
      continue;
    }
    await db.exec('BEGIN IMMEDIATE');
    try {
      for (const stmt of step.statements) {
        await execSkippingApplied(db, migration, stmt);
      }
      if (index === lastTransaction) {
        await recordVersion(db, migration);
        versionRecorded = true;
      }
      await db.exec('COMMIT');
    } catch (err) {
      await abandonOpenTransaction(db);
      throw err;
    }
  }

  if (!versionRecorded) {
    await recordVersion(db, migration);
  }
}

function planSteps(sql: string): ReadonlyArray<MigrationStep> {
  const statements = sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const steps: MigrationStep[] = [];
  let pending: string[] = [];

  const flushPending = () => {
    if (pending.length === 0) {
      return;
    }
    steps.push({ kind: 'transaction', statements: pending });
    pending = [];
  };

  for (const stmt of statements) {
    if (isPragma(stmt)) {
      flushPending();
      steps.push({ kind: 'pragma', sql: stmt });
      continue;
    }
    pending.push(stmt);
  }
  flushPending();

  return steps;
}

function isPragma(stmt: string): boolean {
  return /^pragma\b/i.test(stmt);
}

async function execSkippingApplied(
  db: Database,
  migration: Migration,
  stmt: string,
): Promise<void> {
  try {
    await db.exec(stmt);
  } catch (err) {
    if (!isAlreadyExistsError(err)) {
      throw err;
    }
    // eslint-disable-next-line no-console
    console.warn(
      `[migrations] v${migration.version}: skipping idempotent statement (already applied): ${truncate(stmt)}`,
    );
  }
}

async function recordVersion(db: Database, migration: Migration): Promise<void> {
  await db.execute('INSERT OR IGNORE INTO schema_version (version, applied_at) VALUES (?, ?)', [
    migration.version,
    Date.now(),
  ]);
}

async function abandonOpenTransaction(db: Database): Promise<void> {
  try {
    await db.exec('ROLLBACK');
  } catch {
    return;
  }
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
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
