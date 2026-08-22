import { beforeEach, describe, expect, it } from 'vitest';
import type { AgentId, IsoDateTime, ProviderRunId, SessionId, WorkspaceId } from '@goodboy/types';
import type { Database } from '../client';
import { migrate } from '../migrations/runner';
import { makeTestDatabase } from '../test-helpers/test-db';
import { countUserTextEvents, insertTurnEvent, listTurnEventsForAgent } from './turn-event';

const workspaceId = 'workspace-1' as WorkspaceId;
const sessionId = 'session-1' as SessionId;
const agentId = 'agent-1' as AgentId;
const otherAgentId = 'agent-2' as AgentId;
const runId = 'run-1' as ProviderRunId;
const at = '2026-07-30T10:00:00.000Z' as IsoDateTime;

describe('turn event queries', () => {
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
    await db.execute(
      `INSERT INTO agents (id, session_id, ordinal, name, status)
       VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)`,
      [
        agentId,
        sessionId,
        0,
        'agent one',
        'pending',
        otherAgentId,
        sessionId,
        1,
        'agent two',
        'pending',
      ],
    );
  });

  it('counts only user_text payloads for the requested agent', async () => {
    await insertTurnEvent(db, {
      id: 'event-1',
      sessionId,
      agentId,
      event: { kind: 'user_text', runId, text: 'first', at },
    });
    await insertTurnEvent(db, {
      id: 'event-2',
      sessionId,
      agentId,
      event: { kind: 'assistant_text', runId, delta: 'reply', at },
    });
    await insertTurnEvent(db, {
      id: 'event-3',
      sessionId,
      agentId,
      event: { kind: 'user_text', runId, text: 'second', at },
    });
    await insertTurnEvent(db, {
      id: 'event-4',
      sessionId,
      agentId: otherAgentId,
      event: { kind: 'user_text', runId, text: 'other agent', at },
    });

    await expect(countUserTextEvents({ db, agentId })).resolves.toBe(2);
    await expect(countUserTextEvents({ db, agentId: otherAgentId })).resolves.toBe(1);
  });

  it('round-trips the operator note stored on an orchestrator decision', async () => {
    await insertTurnEvent(db, {
      id: 'event-5',
      sessionId,
      agentId,
      event: {
        kind: 'orchestrator_decision',
        runId,
        action: 'next',
        reason: 'the tests come next',
        stepName: 'write the gate tests',
        operatorNote: 'the gate is in place but its tests are missing',
        at,
      },
    });

    const events = await listTurnEventsForAgent(db, agentId);
    const decision = events.find((event) => event.kind === 'orchestrator_decision');
    expect(decision).toBeDefined();
    if (decision?.kind !== 'orchestrator_decision') {
      return;
    }
    expect(decision.operatorNote).toBe('the gate is in place but its tests are missing');
  });
});
