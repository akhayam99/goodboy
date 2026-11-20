import { describe, expect, it } from 'vitest';
import type { PullRequestState } from '@goodboy/types';
import { toCachedPullRequest } from '../toCachedPullRequest';

const SAMPLE_PR: PullRequestState = {
  number: 1,
  title: 'Test PR',
  url: 'https://github.com/org/repo/pull/1',
  state: 'open',
  mergeable: true,
  checks: null,
  baseBranch: 'main',
  headBranch: 'feature',
  isDraft: false,
  isAutoMerge: false,
  reviewDecision: null,
  body: '',
  updatedAt: '2024-01-01T00:00:00Z',
};

describe('toCachedPullRequest', () => {
  it('keeps only the five fields the impact panel reads', () => {
    expect(Object.keys(toCachedPullRequest({ pr: SAMPLE_PR }) ?? {}).sort()).toEqual([
      'number',
      'state',
      'title',
      'updatedAt',
      'url',
    ]);
  });

  it('trims a full pull request and passes a missing one through', () => {
    expect(toCachedPullRequest({ pr: SAMPLE_PR })).toEqual({
      number: SAMPLE_PR.number,
      title: SAMPLE_PR.title,
      url: SAMPLE_PR.url,
      state: SAMPLE_PR.state,
      updatedAt: SAMPLE_PR.updatedAt,
    });
    expect(toCachedPullRequest({ pr: null })).toBeNull();
  });
});
