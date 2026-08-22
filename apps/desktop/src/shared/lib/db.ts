import { invoke } from '@tauri-apps/api/core';
import {
  migrate as runMigrations,
  runDatabaseHygiene,
  runRuntimeMigrations,
  type Database,
  type MigrationSnapshotStorage,
  type MigrateResult,
} from '@goodboy/db';

const UNMANAGED_STATE_MARKER = 'state not managed';

export const DATABASE_FILE_HINT = '~/.goodboy/data.db';

export const DATABASE_UNAVAILABLE_MESSAGE = `Goodboy could not open its database, so it started with nothing loaded. It cannot run until ${DATABASE_FILE_HINT} is moved aside; a fresh one is created on the next launch.`;

export class DatabaseUnavailableError extends Error {
  constructor() {
    super(DATABASE_UNAVAILABLE_MESSAGE);
    this.name = 'DatabaseUnavailableError';
  }
}

export const isDatabaseUnavailable = (error: unknown): boolean =>
  error instanceof DatabaseUnavailableError;

const describeRejection = (rejection: unknown): string => {
  if (typeof rejection === 'string') {
    return rejection;
  }

  return rejection instanceof Error ? rejection.message : '';
};

const invokeDb = async <T>(command: string, args: Record<string, unknown>): Promise<T> => {
  try {
    return await invoke<T>(command, args);
  } catch (rejection) {
    if (describeRejection(rejection).includes(UNMANAGED_STATE_MARKER)) {
      throw new DatabaseUnavailableError();
    }

    throw rejection;
  }
};

export const tauriDatabase: Database = {
  async exec(sql) {
    await invokeDb('db_exec', { sql });
  },
  async execute(sql, params = []) {
    return invokeDb<{ rowsAffected: number }>('db_execute', {
      sql,
      params: [...params],
    });
  },
  async select<T>(sql: string, params: ReadonlyArray<unknown> = []) {
    return invokeDb('db_select', {
      sql,
      params: [...params],
    }) as Promise<ReadonlyArray<T>>;
  },
};

const migrationSnapshotStorage: MigrationSnapshotStorage = {
  list: async () => invokeDb<ReadonlyArray<string>>('db_list_migration_snapshots', {}),
  remove: async ({ path }) => invokeDb('db_remove_migration_snapshot', { path }),
};

export const runDbMigrations = async (): Promise<MigrateResult> => {
  const databasePath = await invokeDb<string>('db_path', {});
  const result = await runRuntimeMigrations({
    databasePath,
    db: tauriDatabase,
    storage: migrationSnapshotStorage,
  });
  await runDatabaseHygiene({ db: tauriDatabase, now: Date.now() });
  await invokeDb('attachment_cleanup_orphans', {});
  return result;
};

export const wipeDb = async (): Promise<MigrateResult> => {
  await invokeDb('db_wipe', {});
  return runMigrations(tauriDatabase);
};
