import { beforeEach, describe, expect, it } from 'vitest';
import type { ResolveQueueItem, ResolveThread, SessionId } from '@goodboy/types';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import type { Database } from '../client';
import { upsertResolveThread } from './resolve-thread';
import {
  insertResolveCandidate,
  insertResolveCandidateItem,
  listResolveCandidateItems,
} from './resolve-candidate';
import { keepResolveDraftCurrent } from './resolve-draft-current';
import { listResolveThreadFacts, setResolveThreadSourceSnapshot } from './resolve-thread-facts';
import { insertResolveQueueItem, listResolveQueueItems } from './resolve-queue-item';

const sessionId = 'session' as SessionId;
const thread: ResolveThread = {
  id: 'row',
  sessionId,
  projectId: null,
  prNumber: 1,
  threadId: 'thread',
  originKind: 'review_comment',
  diffCommentId: null,
  state: 'fixed',
  stage: 'proposed',
  stateReason: null,
  revision: 2,
  generation: 0,
  reopenedFromThreadId: null,
  activeAttemptId: null,
  disposition: 'fix',
  replyDraft: 'Fixed',
  commitShas: null,
  fixupOfSha: null,
  replacesSha: null,
  question: null,
  replyPostedAt: null,
  replyId: null,
  githubResolved: null,
  closedAt: null,
  closedSource: null,
  createdAt: 1,
  updatedAt: 1,
};
const item: ResolveQueueItem = {
  id: 'item',
  sessionId,
  threadId: 'thread',
  generation: 0,
  reopenedFromItemId: null,
  candidateRevision: 2,
  approvalState: 'none',
  approvedRevision: null,
  approvedReplyHash: null,
  integratedSha: null,
  deferredAt: null,
  deliveredAt: null,
  supersededAt: null,
  createdAt: 1,
  updatedAt: 1,
};
let db: Database;

beforeEach(async () => {
  db = await makeMigratedTestDatabase();
  await db.execute(
    "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace', 'Workspace', 'workspace', 1, 1)",
  );
  await db.execute(
    "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('session', 'workspace', 'Goal', 'idle', 1, 1)",
  );
  await upsertResolveThread({ db, row: thread, expectedRevision: null });
  await insertResolveQueueItem({ db, item });
  await insertResolveCandidate({
    db,
    candidate: {
      id: 'candidate',
      sessionId,
      revision: 1,
      baseSha: 'base',
      candidateSha: 'head',
      worktreePath: '/tmp/candidate',
      mountTarget: null,
      state: 'ready',
      integratedSha: null,
      createdAt: 1,
      updatedAt: 1,
    },
  });
  await insertResolveCandidateItem({
    db,
    item: { candidateId: 'candidate', queueItemId: 'item', itemRevision: 2 },
  });
});

describe('keepResolveDraftCurrent', () => {
  it('moves the item and its candidate to the revision a plain write produced', async () => {
    await upsertResolveThread({ db, row: thread, expectedRevision: 2 });
    expect(
      await keepResolveDraftCurrent({ db, sessionId, threadId: 'thread', fromRevision: 2 }),
    ).toBe(true);
    expect((await listResolveQueueItems({ db, sessionId }))[0]?.item.candidateRevision).toBe(3);
    expect(
      (await listResolveCandidateItems({ db, candidateId: 'candidate' }))[0]?.itemRevision,
    ).toBe(3);
  });

  it('leaves an item alone when it was not in step with the revision before the write', async () => {
    await upsertResolveThread({ db, row: thread, expectedRevision: 2 });
    await upsertResolveThread({ db, row: thread, expectedRevision: 3 });
    expect(
      await keepResolveDraftCurrent({ db, sessionId, threadId: 'thread', fromRevision: 3 }),
    ).toBe(false);
    expect((await listResolveQueueItems({ db, sessionId }))[0]?.item.candidateRevision).toBe(2);
    expect(
      (await listResolveCandidateItems({ db, candidateId: 'candidate' }))[0]?.itemRevision,
    ).toBe(2);
  });

  it('keeps an undecided draft on demand and never touches an accepted one', async () => {
    await upsertResolveThread({ db, row: thread, expectedRevision: 2 });
    expect(await keepResolveDraftCurrent({ db, sessionId, threadId: 'thread' })).toBe(true);
    await db.execute("UPDATE resolve_queue_items SET approval_state = 'accepted'");
    await upsertResolveThread({ db, row: thread, expectedRevision: 3 });
    expect(await keepResolveDraftCurrent({ db, sessionId, threadId: 'thread' })).toBe(false);
    expect((await listResolveQueueItems({ db, sessionId }))[0]?.item.candidateRevision).toBe(3);
  });
});

describe('source snapshot with a pending change', () => {
  it('round trips and never bumps the thread revision', async () => {
    const snapshot = {
      body: 'Move the timeout to config.',
      author: 'mquint',
      fingerprint: 'aaa',
      seenAt: 5,
      changed: {
        body: 'Move it and cap the backoff.',
        author: 'mquint',
        fingerprint: 'bbb',
        seenAt: 9,
      },
    };
    await setResolveThreadSourceSnapshot({ db, sessionId, threadId: 'thread', snapshot });
    const [fact] = await listResolveThreadFacts({ db, sessionId });
    expect(fact?.sourceSnapshot).toEqual(snapshot);
    expect((await listResolveQueueItems({ db, sessionId }))[0]?.thread.revision).toBe(2);
  });
});
