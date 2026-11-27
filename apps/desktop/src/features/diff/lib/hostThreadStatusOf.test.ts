import { describe, expect, it } from 'vitest';
import type { PrComment } from '@goodboy/types';
import { buildItem, buildThread } from '../../../app/components/MockScene/scenes/resolveSeed';
import { buildResolveQueueRows } from '../../resolve/buildResolveQueueRows';
import {
  reviewCommentStateOf,
  reviewCommentWord,
  type ReviewCommentState,
} from '../../resolve/reviewCommentState';
import { hostThreadStatusOf } from './hostThreadStatusOf';

const THREAD_ID = 'PRRT_thread_retry_backoff';

const COMMENT: PrComment = {
  id: 'c-1',
  author: 'Maya Ortiz',
  authorAvatarUrl: null,
  body: 'Cap the retries at three.',
  createdAt: '2026-10-10T09:00:00.000Z',
  url: '',
  source: 'review',
  path: 'src/webhooks.ts',
  line: 42,
  threadId: THREAD_ID,
};

const rowAt = ({
  stage,
  state,
}: {
  readonly stage: 'new' | 'working' | 'proposed';
  readonly state: 'open' | 'working' | 'fixed';
}) => {
  const thread = buildThread({
    threadId: THREAD_ID,
    state,
    stage,
    revision: 1,
    activeAttemptId: null,
    disposition: stage === 'proposed' ? 'fix' : null,
    replyDraft: null,
    question: null,
    createdMinutesAgo: 10,
  });
  const item = buildItem({
    id: 'item-1',
    threadId: THREAD_ID,
    approvalState: 'none',
    approvedRevision: null,
    deferredAt: null,
    deliveredAt: null,
    candidateRevision: 1,
    createdMinutesAgo: 10,
  });
  const [row] = buildResolveQueueRows({
    entries: [{ item, thread }],
    attempts: [],
    deliveryReceipts: [],
    comments: [COMMENT],
  });
  if (row === undefined) {
    throw new Error('the seed built no row');
  }
  return row;
};

describe('hostThreadStatusOf', () => {
  it('reads Open for a thread nobody has worked on', () => {
    expect(hostThreadStatusOf({ row: null, isResolved: false, isOutdated: false })).toEqual({
      label: 'Open',
      tone: 'neutral',
      isDone: false,
    });
    expect(
      hostThreadStatusOf({
        row: rowAt({ stage: 'new', state: 'open' }),
        isResolved: false,
        isOutdated: false,
      }).label,
    ).toBe('Open');
  });

  it('reads Resolved when the host closed it, whatever a fix says', () => {
    const status = hostThreadStatusOf({
      row: rowAt({ stage: 'proposed', state: 'fixed' }),
      isResolved: true,
      isOutdated: false,
    });

    expect(status).toMatchObject({ label: 'Resolved', isDone: true });
  });

  it('reads Outdated for a thread the host marks outdated', () => {
    expect(hostThreadStatusOf({ row: null, isResolved: false, isOutdated: true }).label).toBe(
      'Outdated',
    );
  });

  it.each([
    ['proposed', 'fixed'],
    ['working', 'working'],
  ] as const)('takes the word of a %s fix from the comment state owner', (stage, state) => {
    const row = rowAt({ stage, state });
    const owned: ReviewCommentState = reviewCommentStateOf({ row });

    const status = hostThreadStatusOf({ row, isResolved: false, isOutdated: false });

    expect(status.label).toBe(reviewCommentWord({ state: owned, row }));
    expect(status.isDone).toBe(false);
  });
});
