import { describe, expect, it } from 'vitest';
import type { ResolveQueueItem, ResolveThread, SessionId } from '@goodboy/types';
import { buildResolveQueueRows } from './buildResolveQueueRows';
import { reviewCommentStateOf, reviewCommentWord } from './reviewCommentState';

const sessionId = 'session' as SessionId;

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
  revision: 7,
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

const rowOf = () => {
  const [row] = buildResolveQueueRows({
    entries: [{ item, thread }],
    attempts: [],
    deliveryReceipts: [],
    comments: [],
  });
  if (row === undefined) {
    throw new Error('no row');
  }
  return row;
};

describe('reviewCommentStateOf', () => {
  it('stays ready when only the thread revision moved', () => {
    expect(reviewCommentStateOf({ row: rowOf() })).toBe('ready');
  });

  it('turns outdated only for a real change of the comment', () => {
    const row = rowOf();
    const state = reviewCommentStateOf({ row, isChanged: true });
    expect(state).toBe('outdated');
    expect(reviewCommentWord({ state, row })).toBe('Comment changed');
  });

  it('does not flag a change on a comment nobody drafted yet', () => {
    const [row] = buildResolveQueueRows({
      entries: [{ item, thread: { ...thread, stage: 'new' } }],
      attempts: [],
      deliveryReceipts: [],
      comments: [],
    });
    expect(row === undefined ? null : reviewCommentStateOf({ row, isChanged: true })).toBe('new');
  });
});
