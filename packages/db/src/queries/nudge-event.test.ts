import { describe, expect, it } from 'vitest';
import type { IsoDateTime, SessionId, WorkspaceId } from '@goodboy/types';
import type { Database } from '../client';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { insertNudgeEvent, listNudgeEvents, updateNudgeEventOutcome } from './nudge-event';

const workspaceId = 'w1' as WorkspaceId;
const sessionId = 's1' as SessionId;
const otherSessionId = 's2' as SessionId;

const seed = async (): Promise<Database> => {
  const db = await makeMigratedTestDatabase();
  const now = Date.now();
  await db.execute(
    'INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [workspaceId, 'ws', '/tmp/ws', now, now],
  );
  for (const id of [sessionId, otherSessionId]) {
    await db.execute(
      'INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [id, workspaceId, 'goal', 'idle', now, now],
    );
  }
  return db;
};

describe('listNudgeEvents', () => {
  it('returns only the events for that session, in creation order', async () => {
    const db = await seed();
    await insertNudgeEvent(db, {
      id: 'ev-1',
      sessionId,
      ts: '2026-01-01T00:00:00.000Z' as IsoDateTime,
      kind: 'next:push-branch',
      contextJson: null,
      outcome: 'dismissed',
      outcomeTs: '2026-01-01T00:00:00.000Z' as IsoDateTime,
    });
    await insertNudgeEvent(db, {
      id: 'ev-2',
      sessionId,
      ts: '2026-01-02T00:00:00.000Z' as IsoDateTime,
      kind: 'next:merge-pr',
      contextJson: null,
      outcome: 'accepted',
      outcomeTs: '2026-01-02T00:00:00.000Z' as IsoDateTime,
    });
    await insertNudgeEvent(db, {
      id: 'ev-other-session',
      sessionId: otherSessionId,
      ts: '2026-01-01T00:00:00.000Z' as IsoDateTime,
      kind: 'next:push-branch',
      contextJson: null,
      outcome: 'dismissed',
      outcomeTs: '2026-01-01T00:00:00.000Z' as IsoDateTime,
    });

    const events = await listNudgeEvents({
      db,
      sessionId,
      sinceTs: '2025-12-01T00:00:00.000Z' as IsoDateTime,
    });

    expect(events.map((event) => event.id)).toEqual(['ev-1', 'ev-2']);
    expect(events.map((event) => event.kind)).toEqual(['next:push-branch', 'next:merge-pr']);
    expect(events.map((event) => event.outcome)).toEqual(['dismissed', 'accepted']);
  });

  it('excludes events created before sinceTs', async () => {
    const db = await seed();
    await insertNudgeEvent(db, {
      id: 'ev-old',
      sessionId,
      ts: '2026-01-01T00:00:00.000Z' as IsoDateTime,
      kind: 'next:push-branch',
      contextJson: null,
      outcome: 'dismissed',
      outcomeTs: '2026-01-01T00:00:00.000Z' as IsoDateTime,
    });

    const events = await listNudgeEvents({
      db,
      sessionId,
      sinceTs: '2026-01-15T00:00:00.000Z' as IsoDateTime,
    });

    expect(events).toEqual([]);
  });

  it('reflects an outcome recorded after the event was created', async () => {
    const db = await seed();
    await insertNudgeEvent(db, {
      id: 'ev-1',
      sessionId,
      ts: '2026-01-01T00:00:00.000Z' as IsoDateTime,
      kind: 'next:merge-pr',
      contextJson: null,
      outcome: null,
      outcomeTs: null,
    });
    await updateNudgeEventOutcome(
      db,
      'ev-1',
      'accepted',
      '2026-01-01T00:05:00.000Z' as IsoDateTime,
    );

    const events = await listNudgeEvents({
      db,
      sessionId,
      sinceTs: '2025-12-01T00:00:00.000Z' as IsoDateTime,
    });

    expect(events[0]?.outcome).toBe('accepted');
  });
});
