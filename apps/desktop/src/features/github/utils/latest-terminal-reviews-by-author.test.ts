import { describe, expect, it } from 'vitest';
import type { PrReview } from '@goodboy/types';
import { latestTerminalReviewsByAuthor } from './latest-terminal-reviews-by-author';

const makeReview = (over: Partial<PrReview> = {}): PrReview => ({
  id: 'r1',
  author: 'alice',
  authorAvatarUrl: null,
  state: 'approved',
  submittedAt: '2026-05-01T00:00:00.000Z',
  body: '',
  ...over,
});

describe('latestTerminalReviewsByAuthor', () => {
  it('drops non-terminal review states', () => {
    const reviews = [
      makeReview({ state: 'commented' }),
      makeReview({ state: 'pending' }),
      makeReview({ state: 'dismissed' }),
    ];
    expect(latestTerminalReviewsByAuthor(reviews)).toEqual([]);
  });

  it('keeps the latest terminal review per author', () => {
    const reviews = [
      makeReview({ author: 'alice', state: 'approved', submittedAt: '2026-05-01T00:00:00.000Z' }),
      makeReview({
        author: 'alice',
        state: 'changes_requested',
        submittedAt: '2026-05-02T00:00:00.000Z',
      }),
    ];
    const result = latestTerminalReviewsByAuthor(reviews);
    expect(result).toHaveLength(1);
    expect(result[0]?.state).toBe('changes_requested');
  });

  it('keeps one entry per distinct author', () => {
    const reviews = [
      makeReview({ author: 'alice', state: 'approved' }),
      makeReview({ author: 'bob', state: 'changes_requested' }),
    ];
    expect(latestTerminalReviewsByAuthor(reviews)).toHaveLength(2);
  });
});
