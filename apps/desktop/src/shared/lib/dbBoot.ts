import { removeSessionQuestionsFromSlots } from '@goodboy/core/context';
import { seedMissingBuiltinWorkflows } from '@goodboy/core/workflows';
import {
  DatabaseFromNewerBuildError,
  deleteOrphanedWorkflowAgents,
  pickRestorableSnapshot,
  runDatabaseHygiene,
} from '@goodboy/db';
import type { MigrateResult, MigrationSnapshotStorage } from '@goodboy/db/migrations';
import { invokeDb, tauriDatabase } from './db';
import { LATEST_MIGRATION_VERSION } from './latestMigrationVersion';
import { NewerDatabaseError } from './newerDatabase';

const migrationSnapshotStorage: MigrationSnapshotStorage = {
  list: async () => invokeDb<ReadonlyArray<string>>('db_list_migration_snapshots', {}),
  remove: async ({ path }) => invokeDb('db_remove_migration_snapshot', { path }),
  secure: async () => invokeDb('db_secure_files', {}),
  snapshot: async ({ currentVersion, nextVersion, stamp }) => {
    await invokeDb('db_create_migration_snapshot', {
      request: { currentVersion, nextVersion, stamp },
    });
  },
};

type VersionRow = {
  readonly version: number | null;
};

const loadMigrations = () => import('@goodboy/db/migrations');

const readAppliedVersion = async (): Promise<number> => {
  const rows = await tauriDatabase
    .select<VersionRow>('SELECT MAX(version) AS version FROM schema_version')
    .catch(() => []);
  return rows[0]?.version ?? 0;
};

type RunGuardedMigrationsParams = {
  readonly databasePath: string;
};

const runGuardedMigrations = async ({
  databasePath,
}: RunGuardedMigrationsParams): Promise<MigrateResult> => {
  const appliedVersion = await readAppliedVersion();
  if (appliedVersion === LATEST_MIGRATION_VERSION) {
    return { applied: [], skipped: [], currentVersion: appliedVersion };
  }
  const { runRuntimeMigrations } = await loadMigrations();
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
  const orphaned = await deleteOrphanedWorkflowAgents({ db: tauriDatabase, now: Date.now() });
  await removeSessionQuestionsFromSlots({
    db: tauriDatabase,
    questions: orphaned.removedQuestions,
  }).catch(() => undefined);
  await seedMissingBuiltinWorkflows({ db: tauriDatabase }).catch(() => undefined);
  return result;
};

export const runDbHygiene = async (): Promise<void> => {
  const hygiene = await runDatabaseHygiene({ db: tauriDatabase, now: Date.now() });
  await removeSessionQuestionsFromSlots({
    db: tauriDatabase,
    questions: hygiene.orphanedWorkflowQuestions,
  });
  await invokeDb('attachment_cleanup_orphans', {});
  await invokeDb('chat_attachments_prune', {}).catch(() => undefined);
};

export const wipeDb = async (): Promise<MigrateResult> => {
  await invokeDb('db_wipe', {});
  const { migrate } = await loadMigrations();
  const result = await migrate(tauriDatabase);
  await invokeDb('chat_attachments_prune', {}).catch(() => undefined);
  return result;
};
