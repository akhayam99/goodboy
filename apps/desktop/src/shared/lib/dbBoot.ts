import { removeSessionQuestionsFromSlots, seedMissingBuiltinWorkflows } from '@goodboy/core';
import {
  DatabaseFromNewerBuildError,
  pickRestorableSnapshot,
  runDatabaseHygiene,
} from '@goodboy/db';
import {
  migrate as runMigrations,
  runRuntimeMigrations,
  type MigrateResult,
  type MigrationSnapshotStorage,
} from '@goodboy/db/migrations';
import { invokeDb, tauriDatabase } from './db';
import { NewerDatabaseError } from './newerDatabase';

const migrationSnapshotStorage: MigrationSnapshotStorage = {
  list: async () => invokeDb<ReadonlyArray<string>>('db_list_migration_snapshots', {}),
  remove: async ({ path }) => invokeDb('db_remove_migration_snapshot', { path }),
};

type RunGuardedMigrationsParams = {
  readonly databasePath: string;
};

const runGuardedMigrations = async ({
  databasePath,
}: RunGuardedMigrationsParams): Promise<MigrateResult> => {
  try {
    return await runRuntimeMigrations({
      databasePath,
      db: tauriDatabase,
      storage: migrationSnapshotStorage,
    });
  } catch (error) {
    if (!(error instanceof DatabaseFromNewerBuildError)) {
      throw error;
    }
    const restorableSnapshot = pickRestorableSnapshot({
      paths: await migrationSnapshotStorage.list(),
      highestKnownVersion: error.highestKnownVersion,
    });
    throw new NewerDatabaseError({ message: error.message, restorableSnapshot });
  }
};

type RestoreMigrationSnapshotParams = {
  readonly path: string;
};

export const restoreMigrationSnapshot = async ({
  path,
}: RestoreMigrationSnapshotParams): Promise<string> =>
  invokeDb<string>('db_restore_migration_snapshot', { path });

export const runDbMigrations = async (): Promise<MigrateResult> => {
  const databasePath = await invokeDb<string>('db_path', {});
  const result = await runGuardedMigrations({ databasePath });
  const hygiene = await runDatabaseHygiene({ db: tauriDatabase, now: Date.now() });
  await removeSessionQuestionsFromSlots({
    db: tauriDatabase,
    questions: hygiene.orphanedWorkflowQuestions,
  }).catch(() => undefined);
  await seedMissingBuiltinWorkflows({ db: tauriDatabase }).catch(() => undefined);
  await invokeDb('attachment_cleanup_orphans', {});
  return result;
};

export const wipeDb = async (): Promise<MigrateResult> => {
  await invokeDb('db_wipe', {});
  return runMigrations(tauriDatabase);
};
