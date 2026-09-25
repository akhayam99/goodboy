import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { m175AgentQueuedMessages } from './m175-agent-queued-messages';
import { migrations } from './index';
import { migrate } from './runner';

const seed = async (): Promise<Database> => {
  const db = await makeMigratedTestDatabase({ throughVersion: 174 });
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

describe('m175 agent queued messages', () => {
  it('stores queued messages for an agent in order', async () => {
    const db = await seed();
    await migrate(db, migrations);

    await db.execute(
      "INSERT INTO agent_queued_messages (id, agent_id, position, content, created_at) VALUES ('b', 'agent', 1, 'second', 2), ('a', 'agent', 0, 'first', 1)",
    );

    expect(
      await db.select(
        'SELECT id, content, attachments_json, override_json FROM agent_queued_messages ORDER BY position',
      ),
    ).toEqual([
      { id: 'a', content: 'first', attachments_json: '[]', override_json: null },
      { id: 'b', content: 'second', attachments_json: '[]', override_json: null },
    ]);
  });

  it('is a no-op when a crash left the table already created', async () => {
    const db = await seed();
    await db.exec(m175AgentQueuedMessages);

    await migrate(db, migrations);

    expect(
      await db.select<{ readonly name: string }>(
        "SELECT name FROM sqlite_master WHERE name LIKE '%agent_queued_messages%' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      ),
    ).toEqual([{ name: 'agent_queued_messages' }, { name: 'idx_agent_queued_messages_agent' }]);
  });
});
