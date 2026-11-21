import { describe, expect, it } from 'vitest';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { insertRow, migrateThrough } from '../test-helpers/migration-rows';

type Database = Awaited<ReturnType<typeof makeMigratedTestDatabase>>;

type SeedParams = {
  readonly db: Database;
};

type RowParams = {
  readonly overrides: Readonly<Record<string, unknown>>;
};

const seedSession = async ({ db }: SeedParams): Promise<void> => {
  await insertRow({
    db,
    table: 'workspaces',
    row: { id: 'w1', slug: '/tmp/harborline', name: 'Harborline', created_at: 1, updated_at: 1 },
  });
  await insertRow({
    db,
    table: 'sessions',
    row: {
      id: 's1',
      workspace_id: 'w1',
      goal: 'Northwind',
      state_kind: 'idle',
      created_at: 1,
      updated_at: 1,
    },
  });
};

const eventRow = ({ overrides }: RowParams) => ({
  id: 'e1',
  run_id: 'run-1',
  session_id: 's1',
  mount_id: 'm1',
  kind: 'script',
  started_at: 10,
  payload_json: '{"scriptId":"test:integration"}',
  created_at: 10,
  updated_at: 10,
  ...overrides,
});

describe('m245 work events', () => {
  it('adds an empty table with mount and agent as columns', async () => {
    const db = await makeMigratedTestDatabase({ throughVersion: 244 });

    const result = await migrateThrough({ db, version: 245 });

    expect(result.applied).toEqual([245]);
    expect(await db.select('SELECT id FROM work_events')).toEqual([]);
    const columns = await db.select<{ name: string }>('PRAGMA table_info(work_events)');
    expect(columns.map((column) => column.name)).toEqual([
      'id',
      'run_id',
      'session_id',
      'mount_id',
      'agent_id',
      'kind',
      'started_at',
      'ended_at',
      'exit_code',
      'payload_json',
      'created_at',
      'updated_at',
    ]);
  });

  it('upgrades a copy saved at 244 and keeps its sessions', async () => {
    const db = await makeMigratedTestDatabase({ throughVersion: 244 });
    await seedSession({ db });

    await migrateThrough({ db, version: 245 });

    expect(await db.select('SELECT id, goal FROM sessions')).toEqual([
      { id: 's1', goal: 'Northwind' },
    ]);
    await insertRow({ db, table: 'work_events', row: eventRow({ overrides: {} }) });
    expect(await db.select('SELECT run_id FROM work_events')).toEqual([{ run_id: 'run-1' }]);
  });

  it('keeps one row per run', async () => {
    const db = await makeMigratedTestDatabase();
    await seedSession({ db });
    await insertRow({ db, table: 'work_events', row: eventRow({ overrides: {} }) });

    await expect(
      insertRow({ db, table: 'work_events', row: eventRow({ overrides: { id: 'e2' } }) }),
    ).rejects.toThrow();
  });

  it('takes a kind it has never seen without a rebuild', async () => {
    const db = await makeMigratedTestDatabase();
    await seedSession({ db });

    await insertRow({
      db,
      table: 'work_events',
      row: eventRow({ overrides: { kind: 'port-opened' } }),
    });

    expect(await db.select('SELECT kind FROM work_events')).toEqual([{ kind: 'port-opened' }]);
  });

  it('drops the rows of a session when the session goes away', async () => {
    const db = await makeMigratedTestDatabase();
    await seedSession({ db });
    await insertRow({ db, table: 'work_events', row: eventRow({ overrides: {} }) });

    await db.execute("DELETE FROM sessions WHERE id = 's1'");

    expect(await db.select('SELECT id FROM work_events')).toEqual([]);
  });
});
