import { beforeEach, describe, expect, it } from 'vitest';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  MessageId,
  ProviderRunId,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import type { Database } from '../client';
import { migrate } from '../migrations/runner';
import { makeTestDatabase } from '../test-helpers/test-db';
import { insertAgent, listAgentsForSession } from './agent';
import { insertMessage, listMessagesForSession } from './message';
import { archiveSession, listArchivedSessionRefs, softDeleteSession } from './session';
import {
  deleteTurnEventsForSessions,
  getTurnEventStatsForSessions,
  insertTurnEvent,
  listTurnEventsForSession,
} from './turn-event';

const workspaceId = 'workspace-1' as WorkspaceId;
const archivedSessionId = 'session-archived' as SessionId;
const liveSessionId = 'session-live' as SessionId;
const deletedSessionId = 'session-deleted' as SessionId;
const archivedAgentId = 'agent-archived' as AgentId;
const liveAgentId = 'agent-live' as AgentId;
const runId = 'run-1' as ProviderRunId;
const at = '2026-07-30T10:00:00.000Z' as IsoDateTime;

const insertSessionRow = async (db: Database, sessionId: SessionId) => {
  const now = Date.now();
  await db.execute(
    'INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [sessionId, workspaceId, 'goal', 'idle', now, now],
  );
};

const insertAgentRow = async (db: Database, sessionId: SessionId, agentId: AgentId) => {
  const agent: Agent = {
    id: agentId,
    sessionId,
    ordinal: 0,
    name: 'agent',
    status: 'pending',
  };
  await insertAgent(db, agent);
};

describe('archived storage queries', () => {
  let db: Database;

  beforeEach(async () => {
    db = makeTestDatabase();
    await migrate(db);
    const now = Date.now();
    await db.execute(
      'INSERT INTO workspaces (id, name, root_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [workspaceId, 'workspace', '/tmp/workspace', now, now],
    );
    await insertSessionRow(db, archivedSessionId);
    await insertSessionRow(db, liveSessionId);
    await insertSessionRow(db, deletedSessionId);
    await insertAgentRow(db, archivedSessionId, archivedAgentId);
    await insertAgentRow(db, liveSessionId, liveAgentId);
    await archiveSession(db, archivedSessionId);
    await archiveSession(db, deletedSessionId);
    await softDeleteSession(db, deletedSessionId);

    await insertTurnEvent(db, {
      id: 'event-archived-1',
      sessionId: archivedSessionId,
      agentId: archivedAgentId,
      event: { kind: 'user_text', runId, text: 'archived one', at },
    });
    await insertTurnEvent(db, {
      id: 'event-archived-2',
      sessionId: archivedSessionId,
      agentId: archivedAgentId,
      event: { kind: 'assistant_text', runId, delta: 'archived two', at },
    });
    await insertTurnEvent(db, {
      id: 'event-live-1',
      sessionId: liveSessionId,
      agentId: liveAgentId,
      event: { kind: 'user_text', runId, text: 'live one', at },
    });
  });

  it('lists only archived sessions that are not soft deleted', async () => {
    await expect(listArchivedSessionRefs({ db })).resolves.toEqual([
      { sessionId: archivedSessionId, workspaceId },
    ]);
  });

  it('counts rows and payload bytes only for the requested sessions', async () => {
    const archivedStats = await getTurnEventStatsForSessions({
      db,
      sessionIds: [archivedSessionId],
    });
    const liveStats = await getTurnEventStatsForSessions({ db, sessionIds: [liveSessionId] });

    expect(archivedStats.rowCount).toBe(2);
    expect(liveStats.rowCount).toBe(1);
    expect(archivedStats.payloadBytes).toBeGreaterThan(liveStats.payloadBytes);
    await expect(getTurnEventStatsForSessions({ db, sessionIds: [] })).resolves.toEqual({
      rowCount: 0,
      payloadBytes: 0,
    });
  });

  it('deletes turn events of the requested sessions and leaves the others intact', async () => {
    const deleted = await deleteTurnEventsForSessions({ db, sessionIds: [archivedSessionId] });

    expect(deleted).toBe(2);
    await expect(listTurnEventsForSession(db, archivedSessionId)).resolves.toEqual([]);
    await expect(listTurnEventsForSession(db, liveSessionId)).resolves.toHaveLength(1);
  });

  it('leaves agents and final messages untouched when transcripts are pruned', async () => {
    await insertMessage(db, {
      id: 'message-1' as MessageId,
      sessionId: archivedSessionId,
      agentId: archivedAgentId,
      role: 'assistant',
      content: 'final prose',
      createdAt: at,
    });

    await deleteTurnEventsForSessions({ db, sessionIds: [archivedSessionId] });

    await expect(listMessagesForSession(db, archivedSessionId)).resolves.toHaveLength(1);
    await expect(listAgentsForSession(db, archivedSessionId)).resolves.toHaveLength(1);
    const sessionRows = await db.select<{ id: string }>('SELECT id FROM sessions');
    expect(sessionRows).toHaveLength(3);
  });
});
