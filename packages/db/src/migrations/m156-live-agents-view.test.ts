import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { makeTestDatabase } from '../test-helpers/test-db';
import { migrations } from './index';
import { migrate } from './runner';

const before = migrations.filter((migration) => migration.version < 156);

const seed = async (): Promise<Database> => {
  const db = makeTestDatabase();
  await migrate(db, before);
  await db.execute(
    "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace', 'Workspace', 'workspace', 1, 1)",
  );
  await db.execute(
    "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('session', 'workspace', 'Goal', 'idle', 1, 1)",
  );
  await db.execute(
    "INSERT INTO agents (id, session_id, ordinal, name, status) VALUES ('live', 'session', 0, 'Live', 'pending')",
  );
  await db.execute(
    "INSERT INTO agents (id, session_id, ordinal, name, status, deleted_at) VALUES ('gone', 'session', 1, 'Gone', 'completed', 1)",
  );
  return db;
};

describe('m156 live agents view', () => {
  it('hides tombstoned agents and keeps the live ones', async () => {
    const db = await seed();
    await migrate(db);
    expect(await db.select('SELECT id FROM live_agents ORDER BY ordinal ASC')).toEqual([
      { id: 'live' },
    ]);
    expect(await db.select('SELECT id FROM agents ORDER BY ordinal ASC')).toEqual([
      { id: 'live' },
      { id: 'gone' },
    ]);
  });

  it('exposes every agent column through the star projection', async () => {
    const db = await seed();
    await migrate(db);
    const agentColumns = await db.select<{ readonly name: string }>(
      "SELECT name FROM pragma_table_info('agents')",
    );
    const viewColumns = await db.select<{ readonly name: string }>(
      "SELECT name FROM pragma_table_info('live_agents')",
    );
    expect(viewColumns.map((column) => column.name)).toEqual(
      agentColumns.map((column) => column.name),
    );
  });

  it('re-expands the star projection after a later column is added', async () => {
    const db = await seed();
    await migrate(db);
    await db.exec('ALTER TABLE agents ADD COLUMN probe TEXT');
    await db.execute("UPDATE agents SET probe = 'value' WHERE id = 'live'");
    expect(await db.select("SELECT id, probe FROM live_agents WHERE id = 'live'")).toEqual([
      { id: 'live', probe: 'value' },
    ]);
  });

  it('reflects a soft delete applied after the view exists', async () => {
    const db = await seed();
    await migrate(db);
    await db.execute("UPDATE agents SET deleted_at = 2 WHERE id = 'live'");
    expect(await db.select('SELECT id FROM live_agents')).toEqual([]);
  });

  it('is safe to re-enter when the view already exists', async () => {
    const db = await seed();
    await db.exec('CREATE VIEW live_agents AS SELECT * FROM agents WHERE deleted_at IS NULL');
    const first = await migrate(db);
    const second = await migrate(db);
    expect(first.applied).toContain(156);
    expect(second.applied).toEqual([]);
    expect(
      await db.select<{ readonly version: number }>(
        'SELECT version FROM schema_version WHERE version = 156',
      ),
    ).toEqual([{ version: 156 }]);
  });
});
