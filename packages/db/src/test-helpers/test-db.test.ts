import { describe, expect, it } from 'vitest';
import { migrations } from '../migrations/index';
import { makeMigratedTestDatabase, makeTestDatabase } from './test-db';

const LATEST_VERSION = Math.max(...migrations.map((migration) => migration.version));

const maxSchemaVersion = async ({
  db,
}: {
  db: Awaited<ReturnType<typeof makeMigratedTestDatabase>>;
}) => {
  const rows = await db.select<{ version: number }>(
    'SELECT MAX(version) AS version FROM schema_version',
  );
  return rows[0]?.version;
};

describe('makeMigratedTestDatabase', () => {
  it('migrates to the latest version by default', async () => {
    const db = await makeMigratedTestDatabase();
    expect(await maxSchemaVersion({ db })).toBe(LATEST_VERSION);
  });

  it('stops at throughVersion', async () => {
    const db = await makeMigratedTestDatabase({ throughVersion: 120 });
    expect(await maxSchemaVersion({ db })).toBe(120);
  });

  it('returns independent clones of the template', async () => {
    const first = await makeMigratedTestDatabase();
    await first.execute(
      "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace', 'Workspace', 'workspace', 1, 1)",
    );
    const second = await makeMigratedTestDatabase();
    const rows = await second.select<{ id: string }>('SELECT id FROM workspaces');
    expect(rows).toEqual([]);
  });

  it('enforces foreign keys on every clone', async () => {
    const db = await makeMigratedTestDatabase();
    const rows = await db.select<{ foreign_keys: number }>('PRAGMA foreign_keys');
    expect(rows[0]?.foreign_keys).toBe(1);
  });
});

const makeItemsDatabase = async () => {
  const db = makeTestDatabase();
  await db.exec('CREATE TABLE items (id TEXT PRIMARY KEY, label TEXT NOT NULL)');
  return db;
};

const insertItem = (id: string) => ({
  sql: 'INSERT INTO items (id, label) VALUES (?, ?)',
  params: [id, 'x'],
});

describe('makeTestDatabase transaction', () => {
  it('commits every statement and reports changes', async () => {
    const db = await makeItemsDatabase();
    const outcome = await db.transaction({ statements: [insertItem('a'), insertItem('b')] });
    expect(outcome).toEqual({
      status: 'committed',
      results: [
        { rowsAffected: 1, rows: [] },
        { rowsAffected: 1, rows: [] },
      ],
    });
    expect(await db.select('SELECT id FROM items ORDER BY id')).toEqual([{ id: 'a' }, { id: 'b' }]);
  });

  it('rolls back earlier writes when a guard trips', async () => {
    const db = await makeItemsDatabase();
    const outcome = await db.transaction({
      statements: [
        insertItem('a'),
        {
          sql: "UPDATE items SET label = 'y' WHERE id = ?",
          params: ['missing'],
          abortWhen: 'noChanges',
          abortCode: 'STALE',
        },
        insertItem('b'),
      ],
    });
    expect(outcome).toEqual({ status: 'aborted', abortCode: 'STALE', index: 1 });
    expect(await db.select('SELECT id FROM items')).toEqual([]);
  });

  it('trips row guards on presence and absence', async () => {
    const db = await makeItemsDatabase();
    await db.transaction({ statements: [insertItem('a')] });
    const present = await db.transaction({
      statements: [
        {
          sql: 'SELECT id FROM items WHERE id = ?',
          params: ['a'],
          abortWhen: 'rows',
          abortCode: 'TAKEN',
        },
      ],
    });
    const absent = await db.transaction({
      statements: [
        {
          sql: 'SELECT id FROM items WHERE id = ?',
          params: ['z'],
          abortWhen: 'noRows',
          abortCode: 'MISSING',
        },
      ],
    });
    expect(present).toEqual({ status: 'aborted', abortCode: 'TAKEN', index: 0 });
    expect(absent).toEqual({ status: 'aborted', abortCode: 'MISSING', index: 0 });
  });

  it('rolls back the batch on a sql error', async () => {
    const db = await makeItemsDatabase();
    await expect(
      db.transaction({ statements: [insertItem('a'), insertItem('a')] }),
    ).rejects.toThrow();
    expect(await db.select('SELECT id FROM items')).toEqual([]);
  });

  it('returns rows from selects inside a batch without counting changes', async () => {
    const db = await makeItemsDatabase();
    const outcome = await db.transaction({
      statements: [insertItem('a'), { sql: 'SELECT id, label FROM items' }],
    });
    expect(outcome).toEqual({
      status: 'committed',
      results: [
        { rowsAffected: 1, rows: [] },
        { rowsAffected: 0, rows: [{ id: 'a', label: 'x' }] },
      ],
    });
  });
});
