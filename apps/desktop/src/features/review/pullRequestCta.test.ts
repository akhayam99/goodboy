import { describe, expect, it } from 'vitest';
import type { PrComment, PrReview } from '@goodboy/types';
import { pullRequestCta, pullRequestCtaTitle } from './pullRequestCta';

const thread = (threadId: string, resolved: boolean): PrComment => ({
  id: `comment-${threadId}`,
  author: 'ledger-lead',
  authorAvatarUrl: null,
  body: 'Round half even here',
  createdAt: '2026-09-26T10:00:00Z',
  url: 'https://github.com/acme/ledger-core/pull/528#discussion_r1',
  source: 'review',
  resolved,
  threadId,
});

const review = (author: string, state: PrReview['state'], submittedAt: string): PrReview => ({
  id: `${author}-${submittedAt}`,
  author,
  authorAvatarUrl: null,
  state,
  submittedAt,
  body: '',
});

describe('pullRequestCta', () => {
  it('stays away when nothing waits on the pull request', () => {
    expect(pullRequestCta({ comments: [thread('t1', true)], reviews: [] })).toBeNull();
  });

  it('counts open conversations and names who still asks for changes', () => {
    const cta = pullRequestCta({
      comments: [thread('t1', false), thread('t2', false), thread('t3', true)],
      reviews: [
        review('ledger-lead', 'changes_requested', '2026-09-26T09:00:00Z'),
        review('northwind-dev', 'changes_requested', '2026-09-26T08:00:00Z'),
        review('northwind-dev', 'approved', '2026-09-26T09:30:00Z'),
      ],
    });

    expect(cta).toEqual({ openCount: 2, changesRequestedBy: ['ledger-lead'] });
    expect(cta === null ? null : pullRequestCtaTitle(cta)).toBe(
      '2 conversations need an answer · changes requested by ledger-lead',
    );
  });
});
