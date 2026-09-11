import { describe, expect, it } from 'vitest';
import type { PullRequestState, PullRequestStateKind } from '@goodboy/types';
import { isPullRequestApproved, pullRequestGroupOf } from './pullRequestGroup';

const pr = (over: Partial<PullRequestState> = {}): PullRequestState => ({
  number: 12,
  title: 'a change',
  url: 'https://example.test/pr/12',
  state: 'open' as PullRequestStateKind,
  mergeable: true,
  checks: 'success',
  baseBranch: 'main',
  headBranch: 'ak/feat-x',
  isDraft: false,
  reviewDecision: null,
  body: '',
  updatedAt: '2026-09-11T00:00:00.000Z',
  ...over,
});

describe('pullRequestGroupOf', () => {
  it('keeps a merged pull request out of the closed group', () => {
    expect(pullRequestGroupOf({ pr: pr({ state: 'merged' }) })).toBe('merged');
    expect(pullRequestGroupOf({ pr: pr({ state: 'closed' }) })).toBe('closed');
  });

  it('reads an approved state the same way the session stage does', () => {
    const approvedByState = pr({ state: 'approved' });
    const approvedByReview = pr({ reviewDecision: 'approved' });

    expect(pullRequestGroupOf({ pr: approvedByState })).toBe('reviewed');
    expect(pullRequestGroupOf({ pr: approvedByReview })).toBe('reviewed');
    expect(isPullRequestApproved({ pr: approvedByState })).toBe(true);
    expect(isPullRequestApproved({ pr: approvedByReview })).toBe(true);
  });

  it('never calls a draft approved, however the review reads', () => {
    const draft = pr({ isDraft: true, reviewDecision: 'approved' });

    expect(isPullRequestApproved({ pr: draft })).toBe(false);
    expect(pullRequestGroupOf({ pr: draft })).toBe('draft');
  });

  it('puts a session without a pull request in its own group', () => {
    expect(pullRequestGroupOf({ pr: null })).toBe('not-open');
    expect(pullRequestGroupOf({ pr: undefined })).toBe('not-open');
  });

  it('keeps the merge queue apart from plain review', () => {
    expect(pullRequestGroupOf({ pr: pr({ state: 'queued' }) })).toBe('queued');
    expect(pullRequestGroupOf({ pr: pr() })).toBe('reviewable');
  });
});
