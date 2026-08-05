import { describe, expect, it } from 'vitest';
import type { PrCheckRun, PrComment, PrDetail, PrReview, PullRequestState } from '@goodboy/types';
import { computeTabStatus } from './compute-tab-status';

const makePr = (over: Partial<PullRequestState> = {}): PullRequestState => ({
  number: 1,
  title: 'pr',
  url: 'https://example.test/pr/1',
  state: 'open',
  mergeable: true,
  checks: null,
  baseBranch: 'main',
  headBranch: 'feat',
  isDraft: false,
  reviewDecision: null,
  body: '',
  updatedAt: '2026-05-01T00:00:00.000Z',
  ...over,
});

const makeDetail = (over: Partial<PrDetail> = {}): PrDetail => ({
  prNumber: 1,
  comments: [],
  reviews: [],
  reviewRequests: [],
  checks: [],
  ...over,
});

const makeCheck = (over: Partial<PrCheckRun> = {}): PrCheckRun => ({
  name: 'build',
  conclusion: 'success',
  detailsUrl: null,
  durationMs: null,
  ...over,
});

const makeComment = (over: Partial<PrComment> = {}): PrComment => ({
  id: 'c1',
  author: 'alice',
  authorAvatarUrl: null,
  body: 'hi',
  createdAt: '2026-05-01T00:00:00.000Z',
  url: 'https://example.test/c/1',
  source: 'review',
  resolved: false,
  ...over,
});

const makeReview = (over: Partial<PrReview> = {}): PrReview => ({
  id: 'r1',
  author: 'alice',
  authorAvatarUrl: null,
  state: 'approved',
  submittedAt: '2026-05-01T00:00:00.000Z',
  body: '',
  ...over,
});

describe('computeTabStatus', () => {
  it('reports null for ci when there is nothing to show', () => {
    const status = computeTabStatus(makePr(), makeDetail());
    expect(status.ci).toBeNull();
  });

  it('counts failing checks for the ci tab', () => {
    const detail = makeDetail({
      checks: [makeCheck({ conclusion: 'failure' }), makeCheck({ conclusion: 'success' })],
    });
    const status = computeTabStatus(makePr(), detail);
    expect(status.ci?.tone).toBe('danger');
    expect(status.ci?.count).toBe(1);
    expect(status.ci?.label).toBe('1 failing check');
  });

  it('falls back to pr.checks when there is no detail', () => {
    const status = computeTabStatus(makePr({ checks: 'pending' }), makeDetail());
    expect(status.ci?.tone).toBe('warning');
    expect(status.ci?.label).toBe('ci running');
  });

  it('counts unresolved review comment threads for the comments tab', () => {
    const detail = makeDetail({
      comments: [makeComment({ resolved: false }), makeComment({ id: 'c2', resolved: true })],
    });
    const status = computeTabStatus(makePr(), detail);
    expect(status.comments?.tone).toBe('warning');
    expect(status.comments?.count).toBe(1);
  });

  it('reports changes requested for the review tab', () => {
    const detail = makeDetail({ reviews: [makeReview({ state: 'changes_requested' })] });
    const status = computeTabStatus(makePr(), detail);
    expect(status.review?.tone).toBe('danger');
    expect(status.review?.label).toBe('changes requested by alice');
  });

  it('reports approval for the review tab', () => {
    const detail = makeDetail({ reviews: [makeReview({ state: 'approved' })] });
    const status = computeTabStatus(makePr(), detail);
    expect(status.review?.tone).toBe('success');
    expect(status.review?.label).toBe('approved by alice');
  });
});
