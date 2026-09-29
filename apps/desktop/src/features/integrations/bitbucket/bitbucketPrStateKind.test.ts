import { describe, expect, it } from 'vitest';
import { PULL_REQUEST_PRESENTATION } from '../../../shared/pullRequestPresentation';
import { bitbucketPrStateKind } from './bitbucketPrStateKind';
import { BITBUCKET_PR_PRESENTATION } from './bitbucketPrPresentation';

describe('bitbucketPrStateKind', () => {
  it.each([
    { state: 'OPEN', kind: 'open' },
    { state: 'MERGED', kind: 'merged' },
    { state: 'DECLINED', kind: 'closed' },
    { state: 'SUPERSEDED', kind: 'closed' },
  ])('reads $state as $kind', ({ state, kind }) => {
    expect(bitbucketPrStateKind({ state })).toBe(kind);
  });

  it('falls back to open for a state it does not know', () => {
    expect(bitbucketPrStateKind({ state: 'ARCHIVED' })).toBe('open');
  });

  it('presents each state through the same kind the rows use', () => {
    expect(BITBUCKET_PR_PRESENTATION.OPEN).toBe(PULL_REQUEST_PRESENTATION.open);
    expect(BITBUCKET_PR_PRESENTATION.MERGED).toBe(PULL_REQUEST_PRESENTATION.merged);
    expect(BITBUCKET_PR_PRESENTATION.DECLINED).toBe(PULL_REQUEST_PRESENTATION.closed);
  });
});
