import { describe, expect, it } from 'vitest';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { makeTestDatabase } from '../test-helpers/test-db';
import { migrations } from '../migrations';
import { migrate } from '../migrations/runner';
import {
  listPendingResolutionsForSession,
  markPendingResolutionReplyPosted,
  queuePendingResolution,
} from './pending-resolution';

const workspaceId = 'w1' as WorkspaceId;
const sessionId = 's1' as SessionId;

type SeedParams = Record<string, never>;

const seed = async ({}: SeedParams) => {
  const db = makeTestDatabase();
  await migrate(db, migrations);
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
};

describe('pending_resolutions queries', () => {
  it('stores the resolver reply and outcome', async () => {
    const db = await seed({});
    await queuePendingResolution({
      db,
      id: 'pending-1',
      sessionId,
      prNumber: 42,
      threadId: 'PRRT_1',
      commitSha: 'abcdef1234567890',
      reply: 'persist this reply',
      outcome: 'resolved',
    });

    const rows = await listPendingResolutionsForSession({ db, sessionId });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 'pending-1',
      sessionId,
      prNumber: 42,
      threadId: 'PRRT_1',
      commitSha: 'abcdef1234567890',
      reply: 'persist this reply',
      outcome: 'resolved',
      replyPostedAt: null,
    });
  });

  it('records when the reply was posted, so a retry can skip reposting it', async () => {
    const db = await seed({});
    await queuePendingResolution({
      db,
      id: 'pending-1',
      sessionId,
      prNumber: 42,
      threadId: 'PRRT_1',
      commitSha: 'abcdef1234567890',
      reply: 'persist this reply',
      outcome: 'resolved',
    });

    await markPendingResolutionReplyPosted({ db, sessionId, threadId: 'PRRT_1' });
    const rows = await listPendingResolutionsForSession({ db, sessionId });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.replyPostedAt).not.toBeNull();
  });
});
