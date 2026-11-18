// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { migrate, migrations } from '@goodboy/db/migrations';
import { makeTestDatabase } from '@goodboy/db/test-helpers';
import { listActiveResolveAttempts, type Database } from '@goodboy/db';
import { LATEST_MIGRATION_VERSION } from './latestMigrationVersion';
import { schemaGate } from './schemaGate';

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));

vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }));

type DbBoot = typeof import('./dbBoot');
type NewerDatabase = typeof import('./newerDatabase');

type BackendParams = {
  readonly db: Database;
  readonly snapshots?: ReadonlyArray<string>;
};

const LATEST_VERSION = Math.max(...migrations.map((migration) => migration.version));

const backendFor = ({ db, snapshots = [] }: BackendParams) =>
  vi.fn(async (command: string, args: Record<string, unknown>) => {
    switch (command) {
      case 'db_path':
        return ':memory:';
      case 'db_exec':
        return db.exec(String(args.sql));
      case 'db_execute':
        return db.execute(String(args.sql), args.params as ReadonlyArray<unknown>);
      case 'db_select':
        return db.select(String(args.sql), args.params as ReadonlyArray<unknown>);
      case 'db_transaction':
        return db.transaction({
          statements: args.statements as Parameters<Database['transaction']>[0]['statements'],
        });
      case 'db_list_migration_snapshots':
        return snapshots;
      case 'db_wipe':
      case 'attachment_cleanup_orphans':
        return undefined;
      default:
        throw new Error(`unexpected command ${command}`);
    }
  });

const loadBoot = async (): Promise<DbBoot> => vi.importActual<DbBoot>('./dbBoot');

const loadNewerDatabase = async (): Promise<NewerDatabase> =>
  vi.importActual<NewerDatabase>('./newerDatabase');

const highestApplied = async (db: Database): Promise<number> => {
  const rows = await db.select<{ readonly version: number }>(
    'SELECT MAX(version) AS version FROM schema_version',
  );
  return rows[0]?.version ?? 0;
};

type DatabaseAtParams = {
  readonly version: number;
};

const databaseAt = async ({ version }: DatabaseAtParams): Promise<Database> => {
  const db = makeTestDatabase();
  await migrate(
    db,
    migrations.filter((migration) => migration.version <= version),
  );
  return db;
};

const RESOLVE_QUEUE_QUERY = "FROM resolve_attempts WHERE phase IN ('queued', 'running')";

type CallParams = {
  readonly call: ReadonlyArray<unknown>;
};

type CallIndexParams = {
  readonly isMatch: (params: CallParams) => boolean;
};

const callIndex = ({ isMatch }: CallIndexParams): number =>
  invokeMock.mock.calls.findIndex((call) => isMatch({ call }));

const isResolveQueueQuery = ({ call }: CallParams): boolean =>
  call[0] === 'db_select' && JSON.stringify(call[1]).includes(RESOLVE_QUEUE_QUERY);

const isLatestVersionRecord = ({ call }: CallParams): boolean =>
  call[0] === 'db_execute' &&
  JSON.stringify(call[1]).includes('INSERT OR IGNORE INTO schema_version') &&
  JSON.stringify(call[1]).includes(`[${LATEST_MIGRATION_VERSION},`);

const flushQueries = async (): Promise<void> => {
  for (let tick = 0; tick < 10; tick += 1) {
    await Promise.resolve();
  }
};

beforeEach(() => {
  invokeMock.mockReset();
});

afterEach(() => {
  schemaGate.open();
});

describe('database boot', () => {
  it('migrates a fresh database to the latest version and leaves the cleanup to idle', async () => {
    const db = makeTestDatabase();
    invokeMock.mockImplementation(backendFor({ db }));
    const { runDbMigrations } = await loadBoot();

    await runDbMigrations();

    expect(await highestApplied(db)).toBe(LATEST_VERSION);
    expect(invokeMock).not.toHaveBeenCalledWith('attachment_cleanup_orphans', {});
  });

  it('prunes the database and cleans orphan attachments in the idle hygiene', async () => {
    const db = makeTestDatabase();
    invokeMock.mockImplementation(backendFor({ db }));
    const { runDbHygiene, runDbMigrations } = await loadBoot();
    await runDbMigrations();

    await runDbHygiene();

    expect(invokeMock).toHaveBeenCalledWith('attachment_cleanup_orphans', {});
  });

  it('boots a second time on an already migrated database without applying anything', async () => {
    const db = makeTestDatabase();
    invokeMock.mockImplementation(backendFor({ db }));
    const { runDbMigrations } = await loadBoot();
    await runDbMigrations();

    const second = await runDbMigrations();

    expect(second.applied).toEqual([]);
    expect(await highestApplied(db)).toBe(LATEST_VERSION);
  });

  it('pins the latest known version to the migration registry', () => {
    expect(LATEST_MIGRATION_VERSION).toBe(LATEST_VERSION);
  });

  it('skips the migration run when the database is already at the latest version', async () => {
    const db = makeTestDatabase();
    invokeMock.mockImplementation(backendFor({ db }));
    const { runDbMigrations } = await loadBoot();
    await runDbMigrations();
    invokeMock.mockClear();

    const second = await runDbMigrations();

    const schemaWrites = invokeMock.mock.calls.filter(
      ([command, args]) => command === 'db_exec' && JSON.stringify(args).includes('schema_version'),
    );
    expect(schemaWrites).toEqual([]);
    expect(second).toEqual({ applied: [], skipped: [], currentVersion: LATEST_VERSION });
  });

  it('refuses a database upgraded by a newer build and offers the newest safe snapshot', async () => {
    const db = makeTestDatabase();
    const safe = `/data/goodboy.db.pre-m${LATEST_VERSION}-from-m${LATEST_VERSION - 1}-20260901T120000000Z.bak`;
    const tooNew = `/data/goodboy.db.pre-m${LATEST_VERSION + 6}-from-m${LATEST_VERSION + 5}-20260902T120000000Z.bak`;
    invokeMock.mockImplementation(backendFor({ db, snapshots: [tooNew, safe] }));
    const { runDbMigrations } = await loadBoot();
    await runDbMigrations();
    await db.execute('INSERT INTO schema_version (version, applied_at) VALUES (?, ?)', [
      LATEST_VERSION + 6,
      0,
    ]);
    const { NewerDatabaseError } = await loadNewerDatabase();

    const failure = await runDbMigrations().catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(NewerDatabaseError);
    expect(failure).toMatchObject({ restorableSnapshot: safe });
  });

  it.each([1, 139, 220, 224, 243])(
    'upgrades a database left at m%i while the resolve queue is already asked for',
    async (version) => {
      const db = await databaseAt({ version });
      invokeMock.mockImplementation(backendFor({ db }));
      schemaGate.close();
      const { tauriDatabase } = await vi.importActual<typeof import('./db')>('./db');
      const early = listActiveResolveAttempts({ db: tauriDatabase });
      await flushQueries();

      expect(callIndex({ isMatch: isResolveQueueQuery })).toBe(-1);

      const { runDbMigrations } = await loadBoot();
      await runDbMigrations();

      await expect(early).resolves.toEqual([]);
      expect(await highestApplied(db)).toBe(LATEST_VERSION);
      expect(callIndex({ isMatch: isResolveQueueQuery })).toBeGreaterThan(
        callIndex({ isMatch: isLatestVersionRecord }),
      );
    },
  );

  it('starts the resolve drain before the upgrade and reads the queue only after it', async () => {
    const db = await databaseAt({ version: 220 });
    invokeMock.mockImplementation(backendFor({ db }));
    schemaGate.close();
    const runInSession = vi.fn(async () => undefined);
    const { reconcileResolveDrains } =
      await import('../../store/slices/resolve/reconcileResolveDrains');

    const draining = reconcileResolveDrains({
      set: () => undefined,
      get: () => {
        throw new Error('the empty queue reads no store state');
      },
      runInSession,
    });
    await flushQueries();

    expect(callIndex({ isMatch: isResolveQueueQuery })).toBe(-1);

    const { runDbMigrations } = await loadBoot();
    await runDbMigrations();

    await expect(draining).resolves.toBeUndefined();
    expect(callIndex({ isMatch: isResolveQueueQuery })).toBeGreaterThan(
      callIndex({ isMatch: isLatestVersionRecord }),
    );
    expect(runInSession).not.toHaveBeenCalled();
  });

  it('keeps queries waiting and records nothing when a migration throws, then retries', async () => {
    const db = await databaseAt({ version: LATEST_VERSION - 1 });
    const backend = backendFor({ db });
    const failure = { isOn: true };
    invokeMock.mockImplementation(async (command: string, args: Record<string, unknown>) => {
      if (failure.isOn && command === 'db_exec' && String(args.sql).includes('CREATE TABLE')) {
        throw new Error('sqlite error: disk I/O error');
      }
      return backend(command, args);
    });
    schemaGate.close();
    const { tauriDatabase } = await vi.importActual<typeof import('./db')>('./db');
    const answered = { isDone: false };
    const early = listActiveResolveAttempts({ db: tauriDatabase }).then((rows) => {
      answered.isDone = true;
      return rows;
    });
    const { runDbMigrations } = await loadBoot();

    await expect(runDbMigrations()).rejects.toThrow('disk I/O error');
    await flushQueries();

    expect(await highestApplied(db)).toBe(LATEST_VERSION - 1);
    expect(schemaGate.isOpen()).toBe(false);
    expect(answered.isDone).toBe(false);
    expect(callIndex({ isMatch: isResolveQueueQuery })).toBe(-1);

    failure.isOn = false;
    await runDbMigrations();

    await expect(early).resolves.toEqual([]);
    expect(await highestApplied(db)).toBe(LATEST_VERSION);
  });

  it('holds queries while a wipe replays the schema', async () => {
    const db = makeTestDatabase();
    invokeMock.mockImplementation(backendFor({ db }));
    const { wipeDb } = await loadBoot();
    const { tauriDatabase } = await vi.importActual<typeof import('./db')>('./db');

    const wiping = wipeDb();
    const early = listActiveResolveAttempts({ db: tauriDatabase });
    await wiping;

    await expect(early).resolves.toEqual([]);
    expect(callIndex({ isMatch: isResolveQueueQuery })).toBeGreaterThan(
      callIndex({ isMatch: isLatestVersionRecord }),
    );
  });

  it('wipes through the backend, then migrates the empty database again', async () => {
    const db = makeTestDatabase();
    invokeMock.mockImplementation(backendFor({ db }));
    const { wipeDb } = await loadBoot();

    await wipeDb();

    expect(invokeMock).toHaveBeenCalledWith('db_wipe', {});
    expect(await highestApplied(db)).toBe(LATEST_VERSION);
  });
});
