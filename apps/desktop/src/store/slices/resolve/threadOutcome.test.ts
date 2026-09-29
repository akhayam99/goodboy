import { describe, expect, it } from 'vitest';
import type { ResolveQueueItem, ResolveThread, SessionId } from '@goodboy/types';
import { buildResolveQueueRows } from '../../../features/resolve/buildResolveQueueRows';
import { conversationSha } from '../../../features/resolve/conversationAgentResult';
import { threadOutcome } from './threadOutcome';

const sessionId = 'session' as SessionId;

const thread: ResolveThread = {
  id: 'thread-row',
  sessionId,
  projectId: null,
  prNumber: 318,
  threadId: 'PRRT_1',
  originKind: 'review_comment',
  diffCommentId: null,
  state: 'answered',
  stage: 'new',
  stateReason: null,
  revision: 2,
  generation: 0,
  reopenedFromThreadId: null,
  activeAttemptId: null,
  disposition: 'fix',
  replyDraft: 'Stopped the retry loop.',
  commitShas: ['c81e5aa', 'e31b9f4'],
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
  threadId: 'PRRT_1',
  generation: 0,
  reopenedFromItemId: null,
  candidateRevision: 2,
  approvalState: 'accepted',
  approvedRevision: 2,
  approvedReplyHash: null,
  integratedSha: 'c81e5aa',
  deferredAt: null,
  deliveredAt: null,
  supersededAt: null,
  createdAt: 1,
  updatedAt: 1,
};

describe('the sha of a resolved thread', () => {
  it('is the same one in the reply and on the page after a remap', () => {
    const outcome = threadOutcome({ row: thread });
    const [row] = buildResolveQueueRows({
      entries: [{ item, thread }],
      attempts: [],
      deliveryReceipts: [],
      comments: [],
    });
    expect(outcome).toMatchObject({ kind: 'resolved', commitSha: 'e31b9f4' });
    expect(row).toBeDefined();
    expect(row === undefined ? null : conversationSha({ row })).toBe('e31b9f4');
  });
});
