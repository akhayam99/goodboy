import { describe, expect, it } from 'vitest';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { insertRow, migrateThrough } from '../test-helpers/migration-rows';

type Database = Awaited<ReturnType<typeof makeMigratedTestDatabase>>;

const seedOwners = async ({ db }: { readonly db: Database }): Promise<void> => {
  await insertRow({
    db,
    table: 'workspaces',
    row: { id: 'w1', slug: '/tmp/harborline', name: 'Harborline', created_at: 1, updated_at: 1 },
  });
  await db.execute(
    "INSERT INTO projects (id, workspace_id, name, root_path, kind, created_at, updated_at) VALUES ('p1', 'w1', 'payments-api', '/repo/payments-api', 'folder', 1, 1)",
  );
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

const tabRow = (overrides: Readonly<Record<string, unknown>>) => ({
  id: 't1',
  session_id: 's1',
  project_id: null,
  url: 'https://staging.harborline.example/',
  title: 'Staging',
  position: 0,
  created_at: 1,
  updated_at: 1,
  ...overrides,
});

describe('m240 browser tabs', () => {
  it('adds an empty table that keeps a url and a title and nothing about the page', async () => {
    const db = await makeMigratedTestDatabase({ throughVersion: 239 });

    const result = await migrateThrough({ db, version: 240 });

    expect(result.applied).toEqual([240]);
    expect(await db.select('SELECT id FROM browser_tabs')).toEqual([]);
    const columns = await db.select<{ name: string }>('PRAGMA table_info(browser_tabs)');
    expect(columns.map((column) => column.name)).toEqual([
      'id',
      'session_id',
      'project_id',
      'url',
      'title',
      'position',
      'created_at',
      'updated_at',
    ]);
  });

  it('refuses a row with no owner and a row with two owners', async () => {
    const db = await makeMigratedTestDatabase();
    await seedOwners({ db });

    await expect(
      insertRow({ db, table: 'browser_tabs', row: tabRow({ session_id: null }) }),
    ).rejects.toThrow();
    await expect(
      insertRow({ db, table: 'browser_tabs', row: tabRow({ project_id: 'p1' }) }),
    ).rejects.toThrow();
  });

  it('keeps a pin when a session goes away and drops the tabs of that session', async () => {
    const db = await makeMigratedTestDatabase();
    await seedOwners({ db });
    await insertRow({ db, table: 'browser_tabs', row: tabRow({ id: 't1' }) });
    await insertRow({
      db,
      table: 'browser_tabs',
      row: tabRow({ id: 't2', session_id: null, project_id: 'p1' }),
    });

    await db.execute("DELETE FROM sessions WHERE id = 's1'");

    const rows = await db.select<{ id: string }>('SELECT id FROM browser_tabs ORDER BY id');
    expect(rows.map((row) => row.id)).toEqual(['t2']);
  });

  it('drops the pins of a project when the project goes away', async () => {
    const db = await makeMigratedTestDatabase();
    await seedOwners({ db });
    await insertRow({
      db,
      table: 'browser_tabs',
      row: tabRow({ id: 't2', session_id: null, project_id: 'p1' }),
    });

    await db.execute("DELETE FROM projects WHERE id = 'p1'");

    expect(await db.select('SELECT id FROM browser_tabs')).toEqual([]);
  });
});
