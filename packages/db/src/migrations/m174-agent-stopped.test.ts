import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { m174AgentStopped } from './m174-agent-stopped';
import { migrations } from './index';
import { migrate } from './runner';

const seed = async (): Promise<Database> => {
  const db = await makeMigratedTestDatabase({ throughVersion: 173 });
  await db.execute(
    "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace', 'Harborline', 'harborline', 1, 1)",
  );
  await db.execute(
    "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('session', 'workspace', 'Goal', 'idle', 1, 1)",
  );
  await db.execute(
    "INSERT INTO agents (id, session_id, ordinal, name, status) VALUES ('agent', 'session', 0, 'Scout', 'running')",
  );
  return db;
};

describe('m174 agent stopped', () => {
  it('leaves agents recorded before it without a stop', async () => {
    const db = await seed();

    await migrate(db, migrations);

    expect(await db.select('SELECT id, status, stopped_at, stopped_by FROM live_agents')).toEqual([
      { id: 'agent', status: 'running', stopped_at: null, stopped_by: null },
    ]);
  });

  it('stores who stopped an agent and when', async () => {
    const db = await seed();
    await migrate(db, migrations);

    await db.execute(
      "UPDATE agents SET status = 'stopped', stopped_at = 42, stopped_by = 'you' WHERE id = 'agent'",
    );

    expect(await db.select('SELECT status, stopped_at, stopped_by FROM agents')).toEqual([
      { status: 'stopped', stopped_at: 42, stopped_by: 'you' },
    ]);
  });

  it('is a no-op when a crash left the columns already added', async () => {
    const db = await seed();
    await db.exec(m174AgentStopped);

    await migrate(db, migrations);

    expect(
      await db.select<{ readonly name: string }>(
        "SELECT name FROM pragma_table_info('agents') WHERE name LIKE 'stopped_%' ORDER BY name",
      ),
    ).toEqual([{ name: 'stopped_at' }, { name: 'stopped_by' }]);
  });
});
