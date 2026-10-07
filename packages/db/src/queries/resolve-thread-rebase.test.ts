import { beforeEach, describe, expect, it } from 'vitest';
import type { ResolveQueueItem, ResolveThread, SessionId } from '@goodboy/types';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import type { Database } from '../client';
import { setResolveThreadState, upsertResolveThread } from './resolve-thread';
import {
  insertResolveCandidate,
  insertResolveCandidateItem,
  listResolveCandidateItems,
} from './resolve-candidate';
import { repairLaggingResolveQueueItems } from './resolve-draft-current';
import {
  insertResolveQueueItem,
  listResolveQueueItems,
  setResolveQueueItemApproval,
} from './resolve-queue-item';

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
const edited: ResolveThread = { ...thread, replyDraft: 'Fixed and renamed' };
let db: Database;

const itemRevision = async (): Promise<number | undefined> =>
  (await listResolveQueueItems({ db, sessionId }))[0]?.item.candidateRevision;
const candidateRevision = async (): Promise<number | undefined> =>
  (await listResolveCandidateItems({ db, candidateId: 'candidate' }))[0]?.itemRevision;
const accept = async ({ revision }: { readonly revision: number }): Promise<boolean> =>
  setResolveQueueItemApproval({ db, sessionId, itemId: 'item', revision, replyHash: 'hash' });

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

describe('a thread write while an item waits for the owner', () => {
  it('moves the item with a stage, sync or timestamp write so Accept still lands', async () => {
    await upsertResolveThread({
      db,
      row: { ...thread, stage: 'approved', githubResolved: false, updatedAt: 9 },
      expectedRevision: 2,
    });
    expect(await itemRevision()).toBe(3);
    expect(await candidateRevision()).toBe(3);
    expect(await accept({ revision: 3 })).toBe(true);
  });

  it('moves the item when the thread closes on the remote', async () => {
    await upsertResolveThread({
      db,
      row: { ...thread, state: 'closed', githubResolved: true, closedSource: 'github' },
      expectedRevision: 2,
    });
    expect(await itemRevision()).toBe(3);
    await setResolveThreadState({
      db,
      sessionId,
      threadId: 'thread',
      revision: 3,
      state: 'closed',
      stage: 'resolved',
      stateReason: null,
    });
    expect(await itemRevision()).toBe(4);
  });

  it('keeps the item stale when the reply, the commits or the state change', async () => {
    await upsertResolveThread({ db, row: edited, expectedRevision: 2 });
    expect(await itemRevision()).toBe(2);
    await upsertResolveThread({ db, row: { ...edited, commitShas: ['abc'] }, expectedRevision: 3 });
    await upsertResolveThread({
      db,
      row: { ...edited, commitShas: ['abc'], state: 'failed' },
      expectedRevision: 4,
    });
    await setResolveThreadState({
      db,
      sessionId,
      threadId: 'thread',
      revision: 5,
      state: 'working',
      stage: 'working',
      stateReason: null,
    });
    expect(await itemRevision()).toBe(2);
    expect(await candidateRevision()).toBe(2);
    expect(await accept({ revision: 6 })).toBe(false);
  });

  it('leaves a decided item alone', async () => {
    await db.execute("UPDATE resolve_queue_items SET approval_state = 'accepted'");
    await upsertResolveThread({ db, row: { ...thread, stage: 'approved' }, expectedRevision: 2 });
    expect(await itemRevision()).toBe(2);
  });

  it('writes nothing when the expected revision is behind', async () => {
    expect(
      await upsertResolveThread({ db, row: { ...thread, stage: 'approved' }, expectedRevision: 1 }),
    ).toBe(false);
    expect(await itemRevision()).toBe(2);
  });
});

describe('repairLaggingResolveQueueItems', () => {
  const lag = async (): Promise<void> => {
    await db.execute("UPDATE resolve_threads SET revision = 6, stage = 'approved'");
  };

  it('moves an item and its ready candidate to the thread revision', async () => {
    await lag();
    expect(await repairLaggingResolveQueueItems({ db, sessionId })).toBe(1);
    expect(await itemRevision()).toBe(6);
    expect(await candidateRevision()).toBe(6);
    expect(await accept({ revision: 6 })).toBe(true);
  });

  it('repairs an item that never had a candidate', async () => {
    await db.execute('DELETE FROM resolve_candidate_items');
    await lag();
    expect(await repairLaggingResolveQueueItems({ db, sessionId })).toBe(1);
    expect(await itemRevision()).toBe(6);
  });

  it('leaves an item whose thread is working again or whose candidate went stale', async () => {
    await lag();
    await db.execute("UPDATE resolve_threads SET state = 'working'");
    expect(await repairLaggingResolveQueueItems({ db, sessionId })).toBe(0);
    await db.execute("UPDATE resolve_threads SET state = 'fixed'");
    await db.execute("UPDATE resolve_candidates SET state = 'stale'");
    expect(await repairLaggingResolveQueueItems({ db, sessionId })).toBe(0);
    expect(await itemRevision()).toBe(2);
  });

  it('leaves decided items alone and does nothing when in step', async () => {
    expect(await repairLaggingResolveQueueItems({ db, sessionId })).toBe(0);
    await lag();
    await db.execute("UPDATE resolve_queue_items SET approval_state = 'accepted'");
    expect(await repairLaggingResolveQueueItems({ db, sessionId })).toBe(0);
    expect(await itemRevision()).toBe(2);
  });
});
