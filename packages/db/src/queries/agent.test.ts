import { beforeEach, describe, expect, it } from 'vitest';
import type { Agent, AgentId, SessionId, WorkspaceId } from '@goodboy/types';
import type { Database } from '../client';
import { migrate } from '../migrations/runner';
import { makeTestDatabase } from '../test-helpers/test-db';
import { getAgentById, insertAgent } from './agent';

const workspaceId = 'workspace-1' as WorkspaceId;
const sessionId = 'session-1' as SessionId;
const agentId = 'agent-1' as AgentId;

describe('agent queries', () => {
  let db: Database;

  beforeEach(async () => {
    db = makeTestDatabase();
    await migrate(db);
    const now = Date.now();
    await db.execute(
      'INSERT INTO workspaces (id, name, root_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [workspaceId, 'workspace', '/tmp/workspace', now, now],
    );
    await db.execute(
      'INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [sessionId, workspaceId, 'goal', 'idle', now, now],
    );
  });

  it('round-trips the provider session id and its owning provider', async () => {
    const agent: Agent = {
      id: agentId,
      sessionId,
      ordinal: 0,
      name: 'agent',
      status: 'pending',
      providerSessionId: 'codex-session',
      providerSessionProviderId: 'codex',
    };

    await insertAgent(db, agent);

    const stored = await getAgentById(db, agentId);
    expect(stored?.providerSessionId).toBe('codex-session');
    expect(stored?.providerSessionProviderId).toBe('codex');
  });
});
