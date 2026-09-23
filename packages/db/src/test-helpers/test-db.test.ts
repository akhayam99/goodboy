import { describe, expect, it } from 'vitest';
import { migrations } from '../migrations/index';
import { makeMigratedTestDatabase } from './test-db';

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
