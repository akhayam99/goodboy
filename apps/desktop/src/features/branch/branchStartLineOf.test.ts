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
  it('reads Pushed for a branch that matches origin', () => {
    expect(lineOf({ upstream: { kind: 'known', ahead: 0, behind: 0 } })).toMatchObject({
      word: 'Pushed',
      tone: 'neutral',
    });
  });

  it('reads Diverged, never Pushed, when origin has commits the branch lacks', () => {
    expect(lineOf({ upstream: { kind: 'known', ahead: 2, behind: 1 } })).toMatchObject({
      word: 'Diverged',
      tone: 'warning',
    });
  });

  it('reads Not pushed for a branch with no remote copy', () => {
    expect(lineOf({ upstream: { kind: 'unknown', reason: 'no-upstream' } }).word).toBe(
      'Not pushed',
    );
  });
});
