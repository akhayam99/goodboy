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

const visitRow = ({ overrides }: RowParams) => ({
  id: 'v1',
  session_id: 's1',
  url: 'http://localhost:5173/checkout/confirm',
  title: 'Confirm order',
  created_at: 1,
  updated_at: 1,
  ...overrides,
});

describe('m241 browser visits', () => {
  it('adds an empty table that keeps a url and a title per session', async () => {
    const db = await makeMigratedTestDatabase({ throughVersion: 240 });

    const result = await migrateThrough({ db, version: 241 });

    expect(result.applied).toEqual([241]);
    expect(await db.select('SELECT id FROM browser_visits')).toEqual([]);
    const columns = await db.select<{ name: string }>('PRAGMA table_info(browser_visits)');
    expect(columns.map((column) => column.name)).toEqual([
      'id',
      'session_id',
      'url',
      'title',
      'created_at',
      'updated_at',
    ]);
  });

  it('keeps one row per address of a session', async () => {
    const db = await makeMigratedTestDatabase();
    await seedSession({ db });
    await insertRow({ db, table: 'browser_visits', row: visitRow({ overrides: {} }) });

    await expect(
      insertRow({ db, table: 'browser_visits', row: visitRow({ overrides: { id: 'v2' } }) }),
    ).rejects.toThrow();
  });

  it('drops the visits of a session when the session goes away', async () => {
    const db = await makeMigratedTestDatabase();
    await seedSession({ db });
    await insertRow({ db, table: 'browser_visits', row: visitRow({ overrides: {} }) });

    await db.execute("DELETE FROM sessions WHERE id = 's1'");

    expect(await db.select('SELECT id FROM browser_visits')).toEqual([]);
  });
});
