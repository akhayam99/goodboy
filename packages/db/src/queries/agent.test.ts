import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type {
  AgentId,
  SessionId,
  WorkflowRoutingDecision,
  WorkflowRoutingLock,
  WorkspaceId,
} from '@goodboy/types';
import type { Database } from '../client';
import { migrate } from '../migrations/runner';
import { makeTestDatabase } from '../test-helpers/test-db';
import { getAgentById, updateAgentRouting } from './agent';

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
      'INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [workspaceId, 'workspace', '/tmp/workspace', now, now],
    );
    await db.execute(
      'INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [sessionId, workspaceId, 'goal', 'idle', now, now],
    );
  });

  it('round-trips the provider session id and its owning provider', async () => {
    await db.execute(
      `INSERT INTO agents (
         id, session_id, ordinal, name, status, provider_session_id,
         provider_session_provider_id
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [agentId, sessionId, 0, 'agent', 'pending', 'codex-session', 'codex'],
    );

    const stored = await getAgentById(db, agentId);
    expect(stored?.providerSessionId).toBe('codex-session');
    expect(stored?.providerSessionProviderId).toBe('codex');
  });
});

const userLock: WorkflowRoutingLock = {
  version: 1,
  pick: { provider: 'codex', model: 'gpt-5.6-sol', effort: 'high' },
  origin: 'user',
};

const lockedDecision: WorkflowRoutingDecision = {
  version: 1,
  proposal: {
    pick: { provider: 'anthropic', model: 'sonnet-5', effort: 'medium' },
    reason: 'A standard implementation step fits a mid tier model.',
    source: 'agent',
    profile: { taskType: 'implementation', difficulty: 'standard', basis: 'agent' },
  },
  selected: { provider: 'codex', model: 'gpt-5.6-sol', effort: 'high' },
  source: 'step_lock',
  reason: 'This node lock selected codex/gpt-5.6-sol.',
  adjustment: 'none',
  executed: null,
};

describe('agent routing persistence', () => {
  let directory: string;
  let file: string;
  let db: Database;

  beforeEach(async () => {
    directory = mkdtempSync(join(tmpdir(), 'goodboy-routing-'));
    file = join(directory, 'routing.sqlite');
    db = makeTestDatabase(file);
    await migrate(db);
    const now = Date.now();
    await db.execute(
      'INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [workspaceId, 'workspace', '/tmp/workspace', now, now],
    );
    await db.execute(
      'INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [sessionId, workspaceId, 'goal', 'idle', now, now],
    );
    await db.execute(
      'INSERT INTO agents (id, session_id, ordinal, name, status) VALUES (?, ?, ?, ?, ?)',
      [agentId, sessionId, 0, 'agent', 'pending'],
    );
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  it('a user lock and its decision survive a database reopen', async () => {
    const written = await updateAgentRouting({
      db,
      id: agentId,
      update: {
        routingLock: userLock,
        routingDecision: lockedDecision,
        taskProfile: { taskType: 'implementation', difficulty: 'standard', basis: 'agent' },
        providerOverride: 'codex',
        modelOverride: 'gpt-5.6-sol',
        effort: 'high',
      },
    });
    expect(written).toBe(true);

    const reopened = makeTestDatabase(file);
    const stored = await getAgentById(reopened, agentId);

    expect(stored?.routingLock).toEqual(userLock);
    expect(stored?.routingDecision).toEqual(lockedDecision);
    expect(stored?.taskProfile).toEqual({
      taskType: 'implementation',
      difficulty: 'standard',
      basis: 'agent',
    });
    expect(stored?.providerOverride).toBe('codex');
    expect(stored?.modelOverride).toBe('gpt-5.6-sol');
    expect(stored?.effort).toBe('high');
  });

  it('refuses to write a routing lock the codec cannot read back', async () => {
    await expect(
      updateAgentRouting({
        db,
        id: agentId,
        update: {
          routingLock: {
            version: 1,
            pick: { provider: 'nowhere', model: 'gpt-5.6-sol', effort: 'high' },
            origin: 'user',
          } as unknown as WorkflowRoutingLock,
          routingDecision: lockedDecision,
          taskProfile: null,
          providerOverride: 'codex',
          modelOverride: 'gpt-5.6-sol',
          effort: 'high',
        },
      }),
    ).rejects.toThrow('Invalid routing lock');

    const reopened = makeTestDatabase(file);
    const stored = await getAgentById(reopened, agentId);
    expect(stored?.routingLock).toBeNull();
  });
});
