import { describe, expect, it } from 'vitest';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import {
  decideIntegrationDraft,
  listPendingIntegrationDraftsForWorkspace,
  listPendingSlackDrafts,
  listPendingSlackDraftsForSession,
} from './integration-draft';

const workspaceId = 'w1' as WorkspaceId;
const sessionId = 's1' as SessionId;

async function seed() {
  const db = await makeMigratedTestDatabase();
  const now = Date.now();
  await db.execute(
    `INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
    [workspaceId, 'ws', '/tmp/ws', now, now],
  );
  await db.execute(
    `INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [sessionId, workspaceId, 'goal', 'idle', now, now],
  );
  return db;
}

async function insertDraft(
  db: Awaited<ReturnType<typeof seed>>,
  params: {
    id: string;
    verb?: string;
    target: Record<string, string>;
    body?: string;
    status?: string;
  },
) {
  const now = Date.now();
  await db.execute(
    `INSERT INTO integration_drafts
       (id, workspace_id, session_id, provider, verb, target_json, body, status, created_at, updated_at)
     VALUES (?, ?, ?, 'slack', ?, ?, ?, ?, ?, ?)`,
    [
      params.id,
      workspaceId,
      sessionId,
      params.verb ?? 'reply',
      JSON.stringify(params.target),
      params.body ?? 'ready to send',
      params.status ?? 'pending',
      now,
      now,
    ],
  );
}

describe('integration_drafts queries', () => {
  it('lists only pending drafts for the given channel and thread', async () => {
    const db = await seed();
    await insertDraft(db, { id: 'd1', target: { channelId: 'C1', threadTs: '111.1' } });
    await insertDraft(db, { id: 'd2', target: { channelId: 'C2', threadTs: '111.1' } });
    await insertDraft(db, {
      id: 'd3',
      target: { channelId: 'C1', threadTs: '111.1' },
      status: 'sent',
    });

    const drafts = await listPendingSlackDrafts({
      db,
      workspaceId,
      channelId: 'C1',
      threadTs: '111.1',
    });

    expect(drafts).toHaveLength(1);
    expect(drafts[0]!.id).toBe('d1');
    expect(drafts[0]!.target).toEqual({ channelId: 'C1', threadTs: '111.1' });
    expect(drafts[0]!.status).toBe('pending');
  });

  it('lists all pending drafts across a workspace, oldest first', async () => {
    const db = await seed();
    await insertDraft(db, { id: 'first', target: { channelId: 'C1', threadTs: '1' } });
    await insertDraft(db, { id: 'second', target: { channelId: 'C2', messageTs: '2' } });

    const drafts = await listPendingIntegrationDraftsForWorkspace({ db, workspaceId });

    expect(drafts.map((draft) => draft.id)).toEqual(['first', 'second']);
  });

  it('marks a draft sent, optionally updating its body, and returns true', async () => {
    const db = await seed();
    await insertDraft(db, { id: 'd1', target: { channelId: 'C1', threadTs: '1' }, body: 'draft' });

    const ok = await decideIntegrationDraft({ db, id: 'd1', status: 'sent', body: 'edited' });

    expect(ok).toBe(true);
    const [draft] = await listPendingIntegrationDraftsForWorkspace({ db, workspaceId });
    expect(draft).toBeUndefined();
  });

  it('lists only pending drafts for the given session, oldest first', async () => {
    const db = await seed();
    const otherSessionId = 's2' as SessionId;
    const now = Date.now();
    await db.execute(
      `INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [otherSessionId, workspaceId, 'goal', 'idle', now, now],
    );
    await insertDraft(db, { id: 'first', target: { channelId: 'C1', threadTs: '1' } });
    await insertDraft(db, { id: 'second', target: { channelId: 'C2', threadTs: '2' } });
    await insertDraft(db, {
      id: 'third',
      target: { channelId: 'C1', threadTs: '1' },
      status: 'sent',
    });
    await db.execute(`UPDATE integration_drafts SET session_id = ? WHERE id = 'second'`, [
      otherSessionId,
    ]);

    const drafts = await listPendingSlackDraftsForSession({ db, sessionId });

    expect(drafts.map((draft) => draft.id)).toEqual(['first']);
  });

  it('is a no-op when the draft is not pending', async () => {
    const db = await seed();
    await insertDraft(db, {
      id: 'd1',
      target: { channelId: 'C1', threadTs: '1' },
      status: 'discarded',
    });

    const ok = await decideIntegrationDraft({ db, id: 'd1', status: 'sent' });

    expect(ok).toBe(false);
  });
});
