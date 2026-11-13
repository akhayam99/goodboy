import { describe, expect, it } from 'vitest';
import type { PrComment } from '@goodboy/types';
import { botCommentCountOf } from './botCommentCountOf';

type FindingParams = {
  readonly id: string;
  readonly author: string;
};

const finding = ({ id, author }: FindingParams): PrComment => ({
  id,
  author,
  authorAvatarUrl: null,
  body: 'Retry cap check misses the 429 path',
  createdAt: '2026-10-01T10:00:00Z',
  url: `https://github.com/harborline/payments-api/pull/318#discussion_${id}`,
  source: 'review',
  threadId: `PRT_${id}`,
  resolved: false,
});

describe('botCommentCountOf', () => {
  it('counts the review threads the bot started', () => {
    const comments = [
      finding({ id: '1', author: 'acme-review[bot]' }),
      finding({ id: '2', author: 'acme-review[bot]' }),
      finding({ id: '3', author: 'nadia-p' }),
    ];

    expect(botCommentCountOf({ login: 'acme-review', comments, reviews: [] })).toBe(2);
  });

  it('adds the summaries the bot left with a body, one login or its bot form alike', () => {
    const reviews = [
      { author: 'acme-review', state: 'commented' as const, body: 'No issues in 4 areas.' },
      { author: 'acme-review[bot]', state: 'commented' as const, body: '' },
      { author: 'acme-review[bot]', state: 'approved' as const, body: 'Looks fine.' },
      { author: 'nadia-p', state: 'commented' as const, body: 'Thanks.' },
    ];

    expect(botCommentCountOf({ login: 'acme-review[bot]', comments: null, reviews })).toBe(1);
  });
});
