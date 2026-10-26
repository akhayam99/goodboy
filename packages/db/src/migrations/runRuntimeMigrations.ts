import type { Database } from '../client';
import { migrations as defaultMigrations, type Migration } from './index';
import { migrate, type MigrateResult } from './runner';
import { assertKnownMigrations } from './downgradeGuard';

const SNAPSHOT_RETENTION = 2;

export type MigrationSnapshotStorage = {
  readonly list: () => Promise<ReadonlyArray<string>>;
  readonly remove: (params: RemoveSnapshotParams) => Promise<void>;
  readonly secure: () => Promise<void>;
  readonly snapshot: (params: CreateSnapshotStorageParams) => Promise<void>;
};

type CreateSnapshotStorageParams = {
  readonly currentVersion: number;
  readonly nextVersion: number;
  readonly stamp: string;
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

type TableCountRow = {
  readonly count: number;
};

type HasUserTablesParams = {
  readonly db: Database;
};

type SnapshotTimestampParams = {
  readonly date: Date;
};

type CreateSnapshotParams = {
  readonly currentVersion: number;
  readonly nextVersion: number;
  readonly now: () => Date;
  readonly storage: MigrationSnapshotStorage;
};

type SnapshotAgeKeyParams = {
  readonly path: string;
};

type ErrorDetailParams = {
  readonly error: unknown;
};

const hasUserTables = async ({ db }: HasUserTablesParams): Promise<boolean> => {
  const rows = await db.select<TableCountRow>(
    `SELECT COUNT(*) AS count FROM sqlite_master
     WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
       AND name NOT IN ('schema_version', 'schema_migration_segment')`,
  );
  return (rows[0]?.count ?? 0) > 0;
};

const snapshotTimestamp = ({ date }: SnapshotTimestampParams): string =>
  date.toISOString().replaceAll(/[-:.]/g, '');

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
  nextVersion,
  now,
  storage,
}: CreateSnapshotParams): Promise<void> => {
  try {
    await storage.snapshot({
      currentVersion,
      nextVersion,
      stamp: snapshotTimestamp({ date: now() }),
    });
    await storage.secure();
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
  assertKnownMigrations({ appliedVersions: [...applied], migrations });
  const pending = migrations.filter((migration) => !applied.has(migration.version));
  const isFileDatabase =
    databasePath != null && databasePath.length > 0 && databasePath !== ':memory:';

  const currentVersion = rows.reduce((highest, row) => Math.max(highest, row.version), 0);
  const hasHistory = currentVersion > 0 || (await hasUserTables({ db }));

  if (pending.length > 0 && isFileDatabase && hasHistory) {
    const nextVersion = Math.min(...pending.map((migration) => migration.version));
    await createSnapshot({ currentVersion, nextVersion, now, storage });
  }

  return migrate(db, migrations);
};
