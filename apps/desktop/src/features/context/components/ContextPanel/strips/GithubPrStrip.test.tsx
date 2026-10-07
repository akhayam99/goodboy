// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { IsoDateTime, PullRequestState, SessionId } from '@goodboy/types';

vi.mock('../../../../review/openReview', () => ({ openReview: vi.fn(async () => undefined) }));

import { GithubPrStrip } from './GithubPrStrip';

const pullRequestOf = (over: Partial<PullRequestState>): PullRequestState => ({
  number: 9913,
  title: 'Render sensitive start flows under opaque codes',
  url: 'https://github.com/harborline/payments-api/pull/9913',
  state: 'open',
  mergeable: true,
  checks: 'success',
  baseBranch: 'main',
  headBranch: 'harborline/opaque-codes',
  isDraft: false,
  reviewDecision: 'review_required',
  body: '',
  updatedAt: '2026-10-06T14:56:20Z' as IsoDateTime,
  ...over,
});

const renderStrip = (over: Partial<PullRequestState>) =>
  render(<GithubPrStrip sessionId={'session-1' as SessionId} pullRequest={pullRequestOf(over)} />);

afterEach(cleanup);

describe('GithubPrStrip', () => {
  it('reads a closed pull request as Closed even when GitHub still flags it as a draft', () => {
    renderStrip({ state: 'closed', isDraft: true });

    expect(screen.getByText('Closed')).toBeDefined();
    expect(screen.queryByText('Draft')).toBeNull();
  });

  it('reads a merged pull request as Merged even when GitHub still flags it as a draft', () => {
    renderStrip({ state: 'merged', isDraft: true });

    expect(screen.getByText('Merged')).toBeDefined();
    expect(screen.queryByText('Draft')).toBeNull();
  });

  it('keeps Draft for a live draft', () => {
    renderStrip({ state: 'draft', isDraft: true });

    expect(screen.getByText('Draft')).toBeDefined();
  });
});
