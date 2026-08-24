import type { Database } from '../client';
import { migrations as defaultMigrations, type Migration } from './index';
import { migrate, type MigrateResult } from './runner';

const SNAPSHOT_RETENTION = 2;

export type MigrationSnapshotStorage = {
  readonly list: () => Promise<ReadonlyArray<string>>;
  readonly remove: (params: RemoveSnapshotParams) => Promise<void>;
};

type RemoveSnapshotParams = {
  readonly path: string;
};

type Params = {
  readonly databasePath: string | null;
  readonly db: Database;
  readonly migrations?: ReadonlyArray<Migration>;
  readonly now?: () => Date;
  readonly storage: MigrationSnapshotStorage;
};

type VersionRow = {
  readonly version: number;
};

type SnapshotTimestampParams = {
  readonly date: Date;
};

type EscapeSqlStringParams = {
  readonly value: string;
};

type CreateSnapshotParams = {
  readonly currentVersion: number;
  readonly databasePath: string;
  readonly db: Database;
  readonly now: () => Date;
  readonly storage: MigrationSnapshotStorage;
};

type SnapshotAgeKeyParams = {
  readonly path: string;
};

type ErrorDetailParams = {
  readonly error: unknown;
};

const snapshotTimestamp = ({ date }: SnapshotTimestampParams): string =>
  date.toISOString().replaceAll(/[-:.]/g, '');

const escapeSqlString = ({ value }: EscapeSqlStringParams): string => value.replaceAll("'", "''");

const snapshotAgeKey = ({ path }: SnapshotAgeKeyParams): string =>
  path.match(/-(\d{8}T\d{9}Z)\.bak$/)?.[1] ?? '';

const errorDetail = ({ error }: ErrorDetailParams): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String(error.message);
  }
  return String(error);
};

const createSnapshot = async ({
  currentVersion,
  databasePath,
  db,
  now,
  storage,
}: CreateSnapshotParams): Promise<void> => {
  const snapshotPath = `${databasePath}.pre-m${currentVersion}-${snapshotTimestamp({ date: now() })}.bak`;

  try {
    await db.exec(`VACUUM INTO '${escapeSqlString({ value: snapshotPath })}'`);
    const snapshots = [...(await storage.list())].sort((left, right) =>
      snapshotAgeKey({ path: left }).localeCompare(snapshotAgeKey({ path: right })),
    );
    const expired = snapshots.slice(0, Math.max(0, snapshots.length - SNAPSHOT_RETENTION));
    for (const path of expired) {
      await storage.remove({ path });
    }
  } catch (error) {
    throw new Error(
      `Database migration snapshot failed; migrations were not started: ${errorDetail({ error })}`,
    );
  }
};

export const runRuntimeMigrations = async ({
  databasePath,
  db,
  migrations = defaultMigrations,
  now = () => new Date(),
  storage,
}: Params): Promise<MigrateResult> => {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at INTEGER NOT NULL
    );
  `);
  const rows = await db.select<VersionRow>('SELECT version FROM schema_version');
  const applied = new Set(rows.map((row) => row.version));
  const pending = migrations.filter((migration) => !applied.has(migration.version));
  const isFileDatabase =
    databasePath != null && databasePath.length > 0 && databasePath !== ':memory:';

  if (pending.length > 0 && isFileDatabase) {
    const currentVersion = rows.reduce((highest, row) => Math.max(highest, row.version), 0);
    await createSnapshot({ currentVersion, databasePath, db, now, storage });
  }

  return migrate(db, migrations);
};
