import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { migrations } from './index';
import { migrate } from './runner';

const before = migrations.filter((migration) => migration.version < 161);

const insertWorkflow = async (
  db: Database,
  id: string,
  name: string,
  isPreset: number,
): Promise<void> => {
  await db.execute(
    `INSERT INTO workflows (id, workspace_id, name, description, created_at, updated_at, is_preset)
     VALUES (?, 'workspace', ?, '', 1, 1, ?)`,
    [id, name, isPreset],
  );
};

const seed = async (): Promise<Database> => {
  const db = await makeMigratedTestDatabase({ throughVersion: 160 });
  await db.execute(
    "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace', 'Northwind', 'northwind', 1, 1)",
  );
  await insertWorkflow(db, 'preset', 'Ship it', 1);
  return db;
};

describe('m161 workflow preset name unique', () => {
  it('refuses a run copy that shares a live preset name before the migration', async () => {
    const db = await seed();
    await expect(insertWorkflow(db, 'run-copy', 'Ship it', 0)).rejects.toThrow();
  });

  it('keeps every row the earlier migrations stored', async () => {
    const db = await seed();
    await migrate(db, migrations);
    const rows = await db.select<{ readonly id: string; readonly name: string }>(
      'SELECT id, name FROM workflows',
    );
    expect(rows).toEqual([{ id: 'preset', name: 'Ship it' }]);
  });

  it('lets a run copy carry the name of a live preset', async () => {
    const db = await seed();
    await migrate(db, migrations);
    await insertWorkflow(db, 'run-copy', 'Ship it', 0);
    const rows = await db.select<{ readonly id: string }>(
      "SELECT id FROM workflows WHERE name = 'Ship it' AND deleted_at IS NULL ORDER BY id",
    );
    expect(rows.map((row) => row.id)).toEqual(['preset', 'run-copy']);
  });

  it('lets two run copies share a name', async () => {
    const db = await seed();
    await migrate(db, migrations);
    await insertWorkflow(db, 'run-copy-1', 'Ship it', 0);
    await insertWorkflow(db, 'run-copy-2', 'Ship it', 0);
    const rows = await db.select<{ readonly count: number }>(
      "SELECT COUNT(*) AS count FROM workflows WHERE name = 'Ship it'",
    );
    expect(rows[0]?.count).toBe(3);
  });

  it('still refuses a second live preset of the same name', async () => {
    const db = await seed();
    await migrate(db, migrations);
    await expect(insertWorkflow(db, 'preset-2', 'Ship it', 1)).rejects.toThrow();
  });

  it('still lets a deleted preset free its name', async () => {
    const db = await seed();
    await migrate(db, migrations);
    await db.execute("UPDATE workflows SET deleted_at = 2 WHERE id = 'preset'");
    await insertWorkflow(db, 'preset-2', 'Ship it', 1);
    const rows = await db.select<{ readonly id: string }>(
      "SELECT id FROM workflows WHERE name = 'Ship it' AND deleted_at IS NULL",
    );
    expect(rows.map((row) => row.id)).toEqual(['preset-2']);
  });
});
