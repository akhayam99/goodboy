import { describe, expect, it } from 'vitest';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { migrations } from './index';
import { migrate } from './runner';

type ModeRow = {
  readonly id: string;
  readonly default_permission_mode: string;
};

describe('m191 workspace permission default', () => {
  it('gives every existing and new workspace full access by default', async () => {
    const db = await makeMigratedTestDatabase({ throughVersion: 190 });
    await db.execute(
      `INSERT INTO workspaces (id, name, slug, created_at, updated_at)
       VALUES ('harborline', 'Harborline', 'harborline', 1, 1)`,
    );

    await migrate(db, migrations);
    await db.execute(
      `INSERT INTO workspaces (id, name, slug, created_at, updated_at)
       VALUES ('northwind', 'Northwind', 'northwind', 2, 2)`,
    );

    expect(
      await db.select<ModeRow>('SELECT id, default_permission_mode FROM workspaces ORDER BY id'),
    ).toEqual([
      { id: 'harborline', default_permission_mode: 'bypassPermissions' },
      { id: 'northwind', default_permission_mode: 'bypassPermissions' },
    ]);
  });

  it('refuses a mode that no provider knows', async () => {
    const db = await makeMigratedTestDatabase();

    await expect(
      db.execute(
        `INSERT INTO workspaces (id, name, slug, created_at, updated_at, default_permission_mode)
         VALUES ('acme', 'Acme', 'acme', 1, 1, 'yolo')`,
      ),
    ).rejects.toThrow();
  });
});
