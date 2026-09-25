import { describe, expect, it } from 'vitest';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { migrations } from './index';
import { m185AgentHandoffs } from './m185-agent-handoffs';
import { migrate } from './runner';

describe('m185 agent handoffs', () => {
  it('adds an empty handoff table for agents made before it', async () => {
    const db = await makeMigratedTestDatabase({ throughVersion: 184 });
    await db.execute(
      "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace', 'Harborline', 'harborline', 1, 1)",
    );
    await db.execute(
      "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('session', 'workspace', 'Settle', 'idle', 1, 1)",
    );
    await db.execute(
      "INSERT INTO agents (id, session_id, ordinal, name, status) VALUES ('agent', 'session', 1, 'Scout', 'idle')",
    );

    await migrate(db, migrations);

    expect(await db.select('SELECT * FROM agent_handoffs')).toEqual([]);
    await db.execute(
      `INSERT INTO agent_handoffs (agent_id, sender_json, ask, sections_json, sent_message, provider, created_at)
       VALUES ('agent', '{"kind":"you"}', 'Trace it.', '[]', 'Trace it.', 'anthropic', 1)`,
    );
    await db.execute("DELETE FROM agents WHERE id = 'agent'");
    expect(await db.select('SELECT * FROM agent_handoffs')).toEqual([]);
  });

  it('runs again after a crash without failing', async () => {
    const db = await makeMigratedTestDatabase();

    await db.exec(m185AgentHandoffs);

    expect(await db.select("SELECT name FROM sqlite_master WHERE name = 'agent_handoffs'")).toEqual(
      [{ name: 'agent_handoffs' }],
    );
  });
});
