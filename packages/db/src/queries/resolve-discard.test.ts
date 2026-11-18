import { beforeEach, describe, expect, it } from 'vitest';
import { brandId, type ResolveQueueItem, type ResolveThread, type SessionId } from '@goodboy/types';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import type { Database } from '../client';
import { listResolveThreads, upsertResolveThread } from './resolve-thread';
import {
  insertResolveCandidate,
  insertResolveCandidateItem,
  listResolveCandidates,
} from './resolve-candidate';
import { insertResolveQueueItem, listResolveQueueItems } from './resolve-queue-item';
import { discardResolveFix } from './resolve-discard';

const sessionId = brandId<SessionId>({ value: 'session' });
const thread: ResolveThread = {
  id: 'row',
  sessionId,
  projectId: null,
  prNumber: 318,
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
  replyDraft: 'Fixed in 90b1d57.',
  commitShas: ['90b1d57'],
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
const second: ResolveThread = { ...thread, id: 'row-2', threadId: 'thread-2' };
let db: Database;

type OpenedParams = {
  readonly row: ResolveThread;
};

const opened = ({ row }: OpenedParams): ResolveThread => ({
  ...row,
  state: 'open',
  stage: 'new',
  disposition: null,
  replyDraft: null,
  commitShas: null,
  updatedAt: 5,
});

const stages = async (): Promise<ReadonlyArray<string>> =>
  (await listResolveThreads({ db, sessionId })).map((row) => row.stage);

const candidateStates = async (): Promise<ReadonlyArray<string>> =>
  (await listResolveCandidates({ db, sessionId })).map((candidate) => candidate.state);

beforeEach(async () => {
  db = await makeMigratedTestDatabase();
  await db.execute(
    "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace', 'Workspace', 'workspace', 1, 1)",
  );
  await db.execute(
    "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('session', 'workspace', 'Goal', 'idle', 1, 1)",
  );
  await upsertResolveThread({ db, row: thread, expectedRevision: null });
  await upsertResolveThread({ db, row: second, expectedRevision: null });
  await insertResolveQueueItem({ db, item });
  await insertResolveQueueItem({ db, item: { ...item, id: 'item-2', threadId: 'thread-2' } });
  await insertResolveCandidate({
    db,
    candidate: {
      id: 'candidate',
      sessionId,
      revision: 1,
      baseSha: 'base',
      candidateSha: '90b1d57',
      worktreePath: '/worktrees/payments-api',
      mountTarget: null,
      state: 'ready',
      integratedSha: null,
      createdAt: 1,
      updatedAt: 1,
    },
  });
  for (const queueItemId of ['item', 'item-2']) {
    await insertResolveCandidateItem({
      db,
      item: { candidateId: 'candidate', queueItemId, itemRevision: 2 },
    });
  }
});

describe('discarding a fix that answers several comments', () => {
  it('opens every comment, drops the fix and keeps each item on its comment', async () => {
    const isDiscarded = await discardResolveFix({
      db,
      candidateId: 'candidate',
      threads: [
        { row: opened({ row: thread }), expectedRevision: 2, itemId: 'item' },
        { row: opened({ row: second }), expectedRevision: 2, itemId: 'item-2' },
      ],
    });

    expect(isDiscarded).toBe(true);
    expect(await stages()).toEqual(['new', 'new']);
    expect(await candidateStates()).toEqual(['discarded']);
    expect(
      (await listResolveQueueItems({ db, sessionId })).map((entry) => entry.item.candidateRevision),
    ).toEqual([3, 3]);
  });

  it('changes nothing when one comment moved since it was read', async () => {
    const isDiscarded = await discardResolveFix({
      db,
      candidateId: 'candidate',
      threads: [
        { row: opened({ row: thread }), expectedRevision: 2, itemId: 'item' },
        { row: opened({ row: second }), expectedRevision: 1, itemId: 'item-2' },
      ],
    });

    expect(isDiscarded).toBe(false);
    expect(await stages()).toEqual(['proposed', 'proposed']);
    expect(await candidateStates()).toEqual(['ready']);
    expect(
      (await listResolveQueueItems({ db, sessionId })).map((entry) => entry.item.candidateRevision),
    ).toEqual([2, 2]);
  });
});
