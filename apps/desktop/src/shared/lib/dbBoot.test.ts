// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { migrations } from '@goodboy/db/migrations';
import { makeTestDatabase } from '@goodboy/db/test-helpers';
import type { Database } from '@goodboy/db';

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

beforeEach(() => {
  invokeMock.mockReset();
});

describe('database boot', () => {
  it('migrates a fresh database to the latest version and cleans orphan attachments', async () => {
    const db = makeTestDatabase();
    invokeMock.mockImplementation(backendFor({ db }));
    const { runDbMigrations } = await loadBoot();

    await runDbMigrations();

    expect(await highestApplied(db)).toBe(LATEST_VERSION);
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

  it('wipes through the backend, then migrates the empty database again', async () => {
    const db = makeTestDatabase();
    invokeMock.mockImplementation(backendFor({ db }));
    const { wipeDb } = await loadBoot();

    await wipeDb();

    expect(invokeMock).toHaveBeenCalledWith('db_wipe', {});
    expect(await highestApplied(db)).toBe(LATEST_VERSION);
  });
});
