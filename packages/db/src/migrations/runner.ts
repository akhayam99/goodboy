import type { Database } from '../client';
import { migrations as defaultMigrations, type Migration } from './index';

const ENSURE_MIGRATION_TABLES = `
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS schema_migration_segment (
  version INTEGER NOT NULL,
  segment INTEGER NOT NULL,
  applied_at INTEGER NOT NULL,
  PRIMARY KEY (version, segment)
);
`;

const FOREIGN_KEYS_PRAGMA = /^[\t ]*PRAGMA[\t ]+foreign_keys[\t ]*=[\t ]*(ON|OFF)[\t ]*$/im;

type MigrationPart =
  | {
      readonly kind: 'pragma';
      readonly statement: string;
    }
  | {
      readonly kind: 'segment';
      readonly index: number;
      readonly statements: ReadonlyArray<string>;
    };

type SegmentRow = {
  readonly segment: number;
};

type ApplyMigrationInput = {
  readonly db: Database;
  readonly migration: Migration;
};

type ExecuteStatementInput = {
  readonly db: Database;
  readonly statement: string;
  readonly version: number;
};

type RestoreAfterFailureInput = {
  readonly db: Database;
  readonly isTransactionOwned: boolean;
};

type SplitMigrationInput = {
  readonly sql: string;
};

export type MigrateResult = {
  readonly applied: ReadonlyArray<number>;
  readonly skipped: ReadonlyArray<number>;
  readonly currentVersion: number;
};

export const migrate = async (
  db: Database,
  migrations: ReadonlyArray<Migration> = defaultMigrations,
): Promise<MigrateResult> => {
  await db.exec(ENSURE_MIGRATION_TABLES);

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
    await applyMigrationSql({ db, migration });
    newlyApplied.push(migration.version);
  }

  const currentVersion = ordered.at(-1)?.version ?? 0;
  return { applied: newlyApplied, skipped, currentVersion };
};

const splitMigration = ({ sql }: SplitMigrationInput): ReadonlyArray<MigrationPart> => {
  const statements = sql
    .split(';')
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
  const parts: MigrationPart[] = [];
  let segmentStatements: string[] = [];
  let segmentIndex = 0;

  for (const statement of statements) {
    const pragmaMatch = statement.match(FOREIGN_KEYS_PRAGMA);
    if (pragmaMatch == null) {
      segmentStatements.push(statement);
      continue;
    }
    if (segmentStatements.length > 0) {
      parts.push({ kind: 'segment', index: segmentIndex, statements: segmentStatements });
      segmentStatements = [];
      segmentIndex += 1;
    }
    parts.push({ kind: 'pragma', statement: pragmaMatch[0].trim() });
  }

  if (segmentStatements.length > 0) {
    parts.push({ kind: 'segment', index: segmentIndex, statements: segmentStatements });
  }

  return parts;
};

const applyMigrationSql = async ({ db, migration }: ApplyMigrationInput): Promise<void> => {
  const parts = splitMigration({ sql: migration.sql });
  const segmentCount = parts.filter((part) => part.kind === 'segment').length;
  let isTransactionOwned = false;

  try {
    const rows = await db.select<SegmentRow>(
      'SELECT segment FROM schema_migration_segment WHERE version = ?',
      [migration.version],
    );
    const appliedSegments = new Set(rows.map((row) => row.segment));

    for (const part of parts) {
      if (part.kind === 'pragma') {
        await db.exec(part.statement);
        continue;
      }
      if (appliedSegments.has(part.index)) {
        continue;
      }

      await db.exec('BEGIN IMMEDIATE');
      isTransactionOwned = true;
      for (const statement of part.statements) {
        await executeStatement({ db, statement, version: migration.version });
      }

      const isFinalSegment = part.index === segmentCount - 1;
      if (isFinalSegment) {
        await db.execute(
          'INSERT OR IGNORE INTO schema_version (version, applied_at) VALUES (?, ?)',
          [migration.version, Date.now()],
        );
        await db.execute('DELETE FROM schema_migration_segment WHERE version = ?', [
          migration.version,
        ]);
      }
      if (!isFinalSegment) {
        await db.execute(
          'INSERT OR IGNORE INTO schema_migration_segment (version, segment, applied_at) VALUES (?, ?, ?)',
          [migration.version, part.index, Date.now()],
        );
      }
      await db.exec('COMMIT');
      isTransactionOwned = false;
    }

    if (segmentCount === 0) {
      await db.execute('INSERT OR IGNORE INTO schema_version (version, applied_at) VALUES (?, ?)', [
        migration.version,
        Date.now(),
      ]);
    }
  } catch (error) {
    await restoreAfterFailure({ db, isTransactionOwned });
    throw error;
  }
};

const executeStatement = async ({
  db,
  statement,
  version,
}: ExecuteStatementInput): Promise<void> => {
  try {
    await db.exec(statement);
  } catch (error) {
    if (isAlreadyExistsError({ error })) {
      console.warn(
        `[migrations] v${version}: skipping idempotent statement (already applied): ${truncate({ value: statement })}`,
      );
      return;
    }
    throw error;
  }
};

const restoreAfterFailure = async ({
  db,
  isTransactionOwned,
}: RestoreAfterFailureInput): Promise<void> => {
  if (isTransactionOwned) {
    try {
      await db.exec('ROLLBACK');
    } catch {}
  }
  try {
    await db.exec('PRAGMA foreign_keys = ON');
  } catch {}
};

type ErrorMessageInput = {
  readonly error: unknown;
};

const errorMessage = ({ error }: ErrorMessageInput): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String(error.message);
  }
  return String(error);
};

const isAlreadyExistsError = ({ error }: ErrorMessageInput): boolean => {
  const message = errorMessage({ error }).toLowerCase();
  return message.includes('duplicate column name') || message.includes('already exists');
};

type TruncateInput = {
  readonly value: string;
};

const truncate = ({ value }: TruncateInput): string =>
  value.length > 80 ? `${value.slice(0, 77)}...` : value;
