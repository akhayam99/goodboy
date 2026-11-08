import { describe, expect, it } from 'vitest';
import type { ResolveStage } from '@goodboy/types';
import { reviewCounts } from './reviewCounts';
import { openThreadsLineOf } from '../branch/components/PullRequestTab/openThreadsLineOf';

const thread = (stage: ResolveStage) => ({ stage, state: 'open' as const, stateReason: null });

const THREADS = [
  thread('asking'),
  thread('proposed'),
  thread('resolved'),
  thread('parked'),
  thread('working'),
];

describe('reviewCounts', () => {
  it('counts threads, open threads and threads that need you once', () => {
    const counts = reviewCounts({ threads: THREADS });
    expect(counts).toEqual({ threads: 5, comments: 0, unresolved: 4, needYou: 2, unread: 0 });
  });

  it('counts review comments and unread threads when they are read', () => {
    const counts = reviewCounts({
      threads: THREADS,
      comments: [{ source: 'review' }, { source: 'review' }, { source: 'issue' }],
      unread: [{ threadId: 'a' }],
    });
    expect(counts.comments).toBe(2);
    expect(counts.unread).toBe(1);
  });

  it('gives the same open, need-you and unread numbers to the line on the PR page', () => {
    const counts = reviewCounts({ threads: THREADS, comments: null, unread: [{ threadId: 'a' }] });
    expect(
      openThreadsLineOf({
        unresolved: counts.unresolved,
        unreadCount: counts.unread,
        needYou: counts.needYou,
      }),
    ).toBe('4 open threads · 2 need you · 1 unread');
  });
});
