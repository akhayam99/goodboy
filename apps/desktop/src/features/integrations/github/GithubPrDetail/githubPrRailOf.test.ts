import { describe, expect, it } from 'vitest';
import type { PullRequestState } from '@goodboy/types';
import { githubPrRailOf } from './githubPrRailOf';

const prOf = (overrides: Partial<PullRequestState>): PullRequestState => ({
  number: 7,
  title: 'Raise the fuel constant',
  url: 'https://github.com/acme/ledger-core/pull/7',
  state: 'open',
  mergeable: true,
  checks: null,
  baseBranch: 'main',
  headBranch: 'fuel',
  isDraft: false,
  reviewDecision: null,
  body: '',
  updatedAt: '2026-08-01T10:00:00Z',
  ...overrides,
});

describe('githubPrRailOf', () => {
  it('feeds the author and the closing references', () => {
    const rail = githubPrRailOf({
      pr: prOf({ body: 'Closes #12', author: { login: 'harbor-dev', avatarUrl: null } }),
    });
    expect(rail.author?.login).toBe('harbor-dev');
    expect(rail.linked.map((issue) => issue.label)).toEqual(['#12']);
  });

  it('leaves reviewers and checks empty when the inbox row holds no such fact', () => {
    const rail = githubPrRailOf({ pr: prOf({}) });
    expect(rail.reviewers).toEqual([]);
    expect(rail.checks).toBeNull();
    expect(rail.author).toBeNull();
    expect(rail.linked).toEqual([]);
  });
});
