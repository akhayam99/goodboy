import { beforeEach, describe, expect, it } from 'vitest';
import {
  brandId,
  type ResolveCandidate,
  type ResolveCandidateState,
  type ResolveQueueItem,
  type ResolveThread,
  type SessionId,
} from '@goodboy/types';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import type { Database } from '../client';
import { upsertResolveThread } from './resolve-thread';
import { insertResolveQueueItem } from './resolve-queue-item';
import {
  getReadyResolveCandidateForItem,
  getResolveCandidate,
  insertResolveCandidate,
  insertResolveCandidateItem,
  markOverlappingResolveCandidatesStale,
  markResolveCandidateReady,
} from './resolve-candidate';

const sessionId = brandId<SessionId>({ value: 'session' });
const thread: ResolveThread = {
  id: 'row',
  sessionId,
  projectId: null,
  prNumber: 318,
  threadId: 'thread',
  originKind: 'review_comment',
  diffCommentId: null,
  state: 'open',
  stage: 'new',
  stateReason: null,
  revision: 1,
  generation: 0,
  reopenedFromThreadId: null,
  activeAttemptId: null,
  disposition: null,
  replyDraft: null,
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
  candidateRevision: 1,
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

type AddCandidateParams = {
  readonly id: string;
  readonly state: ResolveCandidateState;
  readonly queueItemIds: ReadonlyArray<string>;
  readonly createdAt?: number;
};

const addCandidate = async ({
  id,
  state,
  queueItemIds,
  createdAt = 1,
}: AddCandidateParams): Promise<void> => {
  const candidate: ResolveCandidate = {
    id,
    sessionId,
    revision: 1,
    baseSha: 'base',
    candidateSha: '',
    worktreePath: '/worktrees/payments-api',
    mountTarget: null,
    state,
    integratedSha: null,
    createdAt,
    updatedAt: createdAt,
  };
  await insertResolveCandidate({ db, candidate });
  for (const queueItemId of queueItemIds) {
    await insertResolveCandidateItem({
      db,
      item: { candidateId: id, queueItemId, itemRevision: 1 },
    });
  }
};

type StateOfParams = {
  readonly id: string;
};

const stateOf = async ({ id }: StateOfParams): Promise<string | undefined> =>
  (await getResolveCandidate({ db, candidateId: id }))?.state;

beforeEach(async () => {
  db = await makeMigratedTestDatabase();
  await db.execute(
    "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace', 'Workspace', 'workspace', 1, 1)",
  );
  await db.execute(
    "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('session', 'workspace', 'Goal', 'idle', 1, 1)",
  );
  await upsertResolveThread({ db, row: thread, expectedRevision: null });
  await upsertResolveThread({
    db,
    row: { ...thread, id: 'row-2', threadId: 'thread-2' },
    expectedRevision: null,
  });
  await insertResolveQueueItem({ db, item });
  await insertResolveQueueItem({ db, item: { ...item, id: 'item-2', threadId: 'thread-2' } });
});

describe('markResolveCandidateReady', () => {
  it('moves a building candidate to ready with its commit', async () => {
    await addCandidate({ id: 'candidate', state: 'building', queueItemIds: ['item'] });

    expect(
      await markResolveCandidateReady({ db, candidateId: 'candidate', candidateSha: 'c0ffee' }),
    ).toBe(true);

    const candidate = await getResolveCandidate({ db, candidateId: 'candidate' });
    expect(candidate?.state).toBe('ready');
    expect(candidate?.candidateSha).toBe('c0ffee');
  });

  it('leaves a candidate that is no longer building as it was', async () => {
    await addCandidate({ id: 'candidate', state: 'stale', queueItemIds: ['item'] });

    expect(
      await markResolveCandidateReady({ db, candidateId: 'candidate', candidateSha: 'c0ffee' }),
    ).toBe(false);

    expect(await stateOf({ id: 'candidate' })).toBe('stale');
  });
});

describe('markOverlappingResolveCandidatesStale', () => {
  it('stales the other open candidates that share an item and keeps the rest', async () => {
    await addCandidate({ id: 'mine', state: 'building', queueItemIds: ['item'] });
    await addCandidate({ id: 'building-twin', state: 'building', queueItemIds: ['item'] });
    await addCandidate({ id: 'ready-twin', state: 'ready', queueItemIds: ['item', 'item-2'] });
    await addCandidate({ id: 'integrated-twin', state: 'integrated', queueItemIds: ['item'] });
    await addCandidate({ id: 'elsewhere', state: 'ready', queueItemIds: ['item-2'] });

    await markOverlappingResolveCandidatesStale({ db, candidateId: 'mine' });

    expect(await stateOf({ id: 'mine' })).toBe('building');
    expect(await stateOf({ id: 'building-twin' })).toBe('stale');
    expect(await stateOf({ id: 'ready-twin' })).toBe('stale');
    expect(await stateOf({ id: 'integrated-twin' })).toBe('integrated');
    expect(await stateOf({ id: 'elsewhere' })).toBe('ready');
  });
});

describe('getReadyResolveCandidateForItem', () => {
  it('returns the newest ready candidate that covers the item', async () => {
    await addCandidate({ id: 'older', state: 'ready', queueItemIds: ['item'], createdAt: 1 });
    await addCandidate({ id: 'newer', state: 'ready', queueItemIds: ['item'], createdAt: 2 });
    await addCandidate({ id: 'building', state: 'building', queueItemIds: ['item'], createdAt: 3 });

    expect((await getReadyResolveCandidateForItem({ db, queueItemId: 'item' }))?.id).toBe('newer');
  });

  it('returns null when no ready candidate covers the item', async () => {
    await addCandidate({ id: 'other', state: 'ready', queueItemIds: ['item-2'] });
    await addCandidate({ id: 'stale', state: 'stale', queueItemIds: ['item'] });

    expect(await getReadyResolveCandidateForItem({ db, queueItemId: 'item' })).toBeNull();
  });
});
