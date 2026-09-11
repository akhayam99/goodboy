import { describe, expect, it } from 'vitest';
import type { ResolveQueueItem, ResolveThread, SessionId } from '@goodboy/types';
import type { ResolveQueueStatus } from '../../store/slices/resolve/deriveResolveQueueStatus';
import { groupResolveQueue, groupSharedRuns, rowsForResolveFilter } from './groupResolveQueue';
import type { ResolveQueueRow } from './buildResolveQueueRows';

const sessionId = 'session' as SessionId;

const baseItem: ResolveQueueItem = {
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

const baseThread: ResolveThread = {
  id: 'row',
  sessionId,
  projectId: null,
  prNumber: 1,
  threadId: 'thread',
  originKind: 'review_comment',
  state: 'open',
  stateReason: null,
  revision: 1,
  activeAttemptId: null,
  disposition: null,
  replyDraft: null,
  commitShas: null,
  question: null,
  replyPostedAt: null,
  replyId: null,
  githubResolved: null,
  closedAt: null,
  closedSource: null,
  createdAt: 1,
  updatedAt: 1,
};

const row = ({
  threadId,
  status,
  reviewerCreatedAtMs,
  integratedSha = null,
  activeAttemptId = null,
}: {
  readonly threadId: string;
  readonly status: ResolveQueueStatus;
  readonly reviewerCreatedAtMs: number;
  readonly integratedSha?: string | null;
  readonly activeAttemptId?: string | null;
}): ResolveQueueRow => ({
  item: { ...baseItem, id: `item-${threadId}`, threadId, integratedSha },
  thread: { ...baseThread, id: `row-${threadId}`, threadId, activeAttemptId },
  status,
  attempt: null,
  reviewerNote: {
    body: `body-${threadId}`,
    author: 'reviewer',
    createdAtMs: reviewerCreatedAtMs,
    location: null,
    path: null,
    line: null,
  },
  proposal: null,
  proposalKind: 'none',
  coveredThreadIds: [],
  delivery: null,
});

describe('the retryable bucket', () => {
  const rows = [
    row({ threadId: 'failed', status: 'run_failed', reviewerCreatedAtMs: 1 }),
    row({ threadId: 'stopped', status: 'run_stopped', reviewerCreatedAtMs: 2 }),
    row({ threadId: 'undelivered', status: 'delivery_failed', reviewerCreatedAtMs: 3 }),
    row({ threadId: 'waiting', status: 'fix_ready', reviewerCreatedAtMs: 4 }),
    row({ threadId: 'unsure', status: 'confirm_delivery', reviewerCreatedAtMs: 5 }),
  ];

  it('holds only what a second attempt can move', () => {
    expect(groupResolveQueue({ rows }).retryable.map((entry) => entry.thread.threadId)).toEqual([
      'failed',
      'stopped',
      'undelivered',
    ]);
  });

  it('serves the retryable filter its own rows, never the whole active list', () => {
    const groups = groupResolveQueue({ rows });

    expect(
      rowsForResolveFilter({ groups, filter: 'retryable' }).map((entry) => entry.thread.threadId),
    ).toEqual(['failed', 'stopped', 'undelivered']);
    expect(rowsForResolveFilter({ groups, filter: 'needs_review' })).toEqual(groups.needsReview);
    expect(rowsForResolveFilter({ groups, filter: 'everything' })).toEqual(groups.active);
  });
});

describe('groupResolveQueue', () => {
  it('buckets fix_ready, agent_asked and changed_since_accepted together, ordered oldest first', () => {
    const rows = [
      row({ threadId: 'newest', status: 'fix_ready', reviewerCreatedAtMs: 300 }),
      row({ threadId: 'oldest', status: 'agent_asked', reviewerCreatedAtMs: 100 }),
      row({
        threadId: 'middle',
        status: 'changed_since_accepted',
        reviewerCreatedAtMs: 200,
        integratedSha: 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678',
      }),
    ];
    const groups = groupResolveQueue({ rows });
    expect(groups.needsReview.map((entry) => entry.thread.threadId)).toEqual([
      'oldest',
      'middle',
      'newest',
    ]);
  });

  it('keeps failed and uncertain delivery in the needs-review bucket', () => {
    const rows = [
      row({ threadId: 'f', status: 'delivery_failed', reviewerCreatedAtMs: 1 }),
      row({ threadId: 'u', status: 'confirm_delivery', reviewerCreatedAtMs: 2 }),
    ];
    const groups = groupResolveQueue({ rows });
    expect(groups.needsReview.map((entry) => entry.thread.threadId)).toEqual(['f', 'u']);
    expect(groups.completed).toHaveLength(0);
  });

  it('excludes only later and pushed from the active bucket', () => {
    const rows = [
      row({ threadId: 'w', status: 'working', reviewerCreatedAtMs: 1 }),
      row({
        threadId: 'r',
        status: 'ready_to_push',
        reviewerCreatedAtMs: 2,
        integratedSha: 'b2c3d4e5f60718293a4b5c6d7e8f90123456789a',
      }),
      row({
        threadId: 'p',
        status: 'pushed',
        reviewerCreatedAtMs: 3,
        integratedSha: 'c3d4e5f60718293a4b5c6d7e8f90123456789ab2',
      }),
      row({ threadId: 'l', status: 'later', reviewerCreatedAtMs: 4 }),
    ];
    const groups = groupResolveQueue({ rows });
    expect(groups.needsReview).toHaveLength(0);
    expect(groups.active.map((entry) => entry.thread.threadId)).toEqual(['w', 'r']);
    expect(groups.completed.map((entry) => entry.thread.threadId)).toEqual(['p']);
    expect(groups.later.map((entry) => entry.thread.threadId)).toEqual(['l']);
  });

  it('never counts a later item as completed', () => {
    const rows = [row({ threadId: 'l', status: 'later', reviewerCreatedAtMs: 1 })];
    const groups = groupResolveQueue({ rows });
    expect(groups.completed).toHaveLength(0);
    expect(groups.later).toHaveLength(1);
  });
});

describe('groupSharedRuns', () => {
  it('gathers the members of one attempt under a single named group, keeping list order', () => {
    const rows = [
      row({ threadId: 'a', status: 'fix_ready', reviewerCreatedAtMs: 1, activeAttemptId: 'run-1' }),
      row({ threadId: 'b', status: 'fix_ready', reviewerCreatedAtMs: 2 }),
      row({ threadId: 'c', status: 'fix_ready', reviewerCreatedAtMs: 3, activeAttemptId: 'run-1' }),
    ];
    const groups = groupSharedRuns({ rows });
    expect(groups.map((group) => group.attemptId)).toEqual(['run-1', null]);
    expect(groups[0]?.rows.map((entry) => entry.thread.threadId)).toEqual(['a', 'c']);
    expect(groups[1]?.rows.map((entry) => entry.thread.threadId)).toEqual(['b']);
  });

  it('gives a lone member of an attempt no shared-run heading', () => {
    const rows = [
      row({ threadId: 'a', status: 'fix_ready', reviewerCreatedAtMs: 1, activeAttemptId: 'run-1' }),
    ];
    expect(groupSharedRuns({ rows }).map((group) => group.attemptId)).toEqual([null]);
  });
});
