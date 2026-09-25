import { describe, expect, it } from 'vitest';
import type { PrComment } from '@goodboy/types';
import { conversationsCounter } from './conversationsCounter';

const NOW = Date.parse('2026-01-01T12:00:12Z');
const READ_AT = '2026-01-01T12:00:00Z';

const reviewComment = (patch: Partial<PrComment>): PrComment => ({
  id: 'review-1',
  author: 'reviewer',
  authorAvatarUrl: null,
  body: 'Why?',
  createdAt: '2026-01-01T10:00:00Z',
  url: 'https://github.com/acme/web/pull/248#discussion_r1',
  source: 'review',
  threadId: 'PRRT_1',
  resolved: false,
  ...patch,
});

describe('conversationsCounter', () => {
  it('counts the threads GitHub still has open and says when it read them', () => {
    const comments = [
      reviewComment({}),
      reviewComment({ id: 'review-2', inReplyToId: 'review-1', createdAt: '2026-01-01T11:00:00Z' }),
      reviewComment({ id: 'review-3', threadId: 'PRRT_2', outdated: true }),
      reviewComment({ id: 'review-4', threadId: 'PRRT_3', resolved: true }),
    ];

    expect(conversationsCounter({ comments, fetchedAt: READ_AT, error: null, now: NOW })).toBe(
      '2 open on GitHub · read 12s ago',
    );
  });

  it('says nothing is open only after a read that found nothing open', () => {
    expect(
      conversationsCounter({
        comments: [reviewComment({ resolved: true })],
        fetchedAt: READ_AT,
        error: null,
        now: NOW,
      }),
    ).toBe('No open comments on GitHub · read 12s ago');
    expect(conversationsCounter({ comments: null, fetchedAt: null, error: null, now: NOW })).toBe(
      null,
    );
  });

  it('never reports an empty list when the read failed', () => {
    expect(
      conversationsCounter({
        comments: [],
        fetchedAt: READ_AT,
        error: 'HTTP 401: Bad credentials',
        now: NOW,
      }),
    ).toBe('Comments unavailable');
  });
});
