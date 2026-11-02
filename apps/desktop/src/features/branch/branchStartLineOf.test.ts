import { describe, expect, it } from 'vitest';
import type { GitDistance } from '@goodboy/types';
import { branchNextStepOf } from './branchNextStepOf';
import { branchStartLineOf } from './branchStartLineOf';

type UpstreamParams = {
  readonly upstream: GitDistance;
};

const lineOf = ({ upstream }: UpstreamParams) =>
  branchStartLineOf({
    step: branchNextStepOf({
      status: {
        mainDistance: { kind: 'known', ahead: 3, behind: 0 },
        upstreamDistance: upstream,
        inProgress: null,
      },
      hasConflictStop: false,
    }),
    baseBranch: 'main',
  });

describe('branchStartLineOf', () => {
  it('does not say up to date while origin has newer commits', () => {
    expect(lineOf({ upstream: { kind: 'known', ahead: 0, behind: 2 } }).word).toBe(
      '2 only on origin',
    );
  });
  it('counts commits ahead of origin instead of commits ahead of main', () => {
    expect(lineOf({ upstream: { kind: 'known', ahead: 2, behind: 0 } })).toEqual({
      word: '2 not pushed',
      tone: 'neutral',
      distance: '0 behind main',
    });
  });
  it('reads Up to date with origin when nothing remains to push', () => {
    expect(lineOf({ upstream: { kind: 'known', ahead: 0, behind: 0 } })).toMatchObject({
      word: 'Up to date with origin',
      tone: 'neutral',
    });
  });

  it('reads Diverged, never Pushed, when origin has commits the branch lacks', () => {
    expect(lineOf({ upstream: { kind: 'known', ahead: 2, behind: 1 } })).toMatchObject({
      word: 'Diverged: 2 not pushed, 1 only on origin',
      tone: 'warning',
    });
  });

  it('reads Not pushed for a branch with no remote copy', () => {
    expect(lineOf({ upstream: { kind: 'unknown', reason: 'no-upstream' } }).word).toBe(
      '3 not pushed',
    );
  });
});
