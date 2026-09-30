import { describe, expect, it } from 'vitest';
import type { PullRequestStateKind } from '@goodboy/types';
import type { BitbucketPullRequestState } from './client';
import { PULL_REQUEST_PRESENTATION } from '../../../shared/pullRequestPresentation';
import { BITBUCKET_PR_PRESENTATION } from './bitbucketPrPresentation';
import { BITBUCKET_PR_STATE_KIND, bitbucketPrStateKind } from './bitbucketPrStateKind';

const EXPECTED: ReadonlyArray<readonly [BitbucketPullRequestState, PullRequestStateKind]> = [
  ['OPEN', 'open'],
  ['MERGED', 'merged'],
  ['DECLINED', 'closed'],
  ['SUPERSEDED', 'closed'],
];

describe('bitbucketPrStateKind', () => {
  it.each(EXPECTED)('reads %s as %s', (state, kind) => {
    expect(bitbucketPrStateKind({ state })).toBe(kind);
  });

  it('covers exactly the states the API returns', () => {
    expect(Object.keys(BITBUCKET_PR_STATE_KIND).sort()).toEqual(
      EXPECTED.map(([state]) => state).sort(),
    );
  });

  it('reads a state it does not know as open', () => {
    const unknown: string = 'ARCHIVED';
    expect(bitbucketPrStateKind({ state: unknown as BitbucketPullRequestState })).toBe('open');
  });

  it('presents each state through the same kind the rows use', () => {
    expect(BITBUCKET_PR_PRESENTATION.OPEN).toBe(PULL_REQUEST_PRESENTATION.open);
    expect(BITBUCKET_PR_PRESENTATION.MERGED).toBe(PULL_REQUEST_PRESENTATION.merged);
    expect(BITBUCKET_PR_PRESENTATION.DECLINED).toBe(PULL_REQUEST_PRESENTATION.closed);
  });
});
