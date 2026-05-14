import { describe, expect, it } from 'vitest';
import type { PrDetail, PullRequestState } from '@kay-am/types';
import { pickSmartTab } from '../components/GithubCard';

function makePr(overrides: Partial<PullRequestState> = {}): PullRequestState {
  return {
    number: 1,
    title: 'a pr',
    url: 'https://github.com/org/repo/pull/1',
    state: 'open',
    mergeable: true,
    checks: null,
    baseBranch: 'main',
    headBranch: 'feature',
    isDraft: false,
    reviewDecision: null,
    body: '',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeDetail(overrides: Partial<PrDetail> = {}): PrDetail {
  return {
    prNumber: 1,
    comments: [],
    reviews: [],
    reviewRequests: [],
    checks: [],
    ...overrides,
  };
}

describe('pickSmartTab', () => {
  it('defaults to ci when a check is failing', () => {
    const pr = makePr();
    const detail = makeDetail({
      checks: [{ name: 'build', conclusion: 'failure', detailsUrl: null, durationMs: null }],
    });
    expect(pickSmartTab(pr, detail, null)).toBe('ci');
  });

  it('defaults to ci when a check is pending', () => {
    const pr = makePr();
    const detail = makeDetail({
      checks: [{ name: 'build', conclusion: 'pending', detailsUrl: null, durationMs: null }],
    });
    expect(pickSmartTab(pr, detail, null)).toBe('ci');
  });

  it('defaults to ci when no detail but pr.checks is failure', () => {
    const pr = makePr({ checks: 'failure' });
    expect(pickSmartTab(pr, null, null)).toBe('ci');
  });

  it('defaults to review when a review requested changes', () => {
    const pr = makePr({ reviewDecision: 'changes_requested' });
    const detail = makeDetail({
      reviews: [
        {
          id: '1',
          author: 'alice',
          authorAvatarUrl: null,
          state: 'changes_requested',
          submittedAt: '2026-01-02T00:00:00Z',
          body: '',
        },
      ],
    });
    expect(pickSmartTab(pr, detail, null)).toBe('review');
  });

  it('defaults to comments when newest comment is after branch activity', () => {
    const pr = makePr({ updatedAt: '2026-01-01T00:00:00Z' });
    const detail = makeDetail({
      comments: [
        {
          id: '1',
          author: 'alice',
          authorAvatarUrl: null,
          body: 'hey',
          createdAt: '2026-01-05T00:00:00Z',
          url: 'https://x',
          source: 'issue',
        },
      ],
    });
    expect(pickSmartTab(pr, detail, '2026-01-01T00:00:00Z')).toBe('comments');
  });

  it('falls back to ci when nothing urgent', () => {
    const pr = makePr({ checks: 'success' });
    expect(pickSmartTab(pr, makeDetail(), null)).toBe('ci');
  });
});
