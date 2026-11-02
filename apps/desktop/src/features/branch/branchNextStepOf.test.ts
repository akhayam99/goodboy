import { describe, expect, it } from 'vitest';
import type { GitDistance, WorktreeStatus } from '@goodboy/types';
import { branchNextStepOf } from './branchNextStepOf';

type StatusParams = {
  readonly ahead: number;
  readonly behind: number;
  readonly upstream: GitDistance;
  readonly inProgress?: WorktreeStatus['inProgress'];
};

const statusOf = ({ ahead, behind, upstream, inProgress = null }: StatusParams) => ({
  mainDistance: { kind: 'known' as const, ahead, behind },
  upstreamDistance: upstream,
  inProgress,
});

const NOT_PUSHED: GitDistance = { kind: 'unknown', reason: 'no-upstream' };
const IN_SYNC: GitDistance = { kind: 'known', ahead: 0, behind: 0 };

describe('branchNextStepOf', () => {
  it.each([
    {
      name: 'not pushed',
      status: statusOf({ ahead: 3, behind: 0, upstream: NOT_PUSHED }),
      expected: { state: 'unpushed', header: 'push', submit: 'secondary', unpushed: 3 },
    },
    {
      name: 'pushed, no pull request',
      status: statusOf({ ahead: 3, behind: 0, upstream: IN_SYNC }),
      expected: { state: 'pushed', header: null, submit: 'primary', unpushed: 0 },
    },
    {
      name: 'behind main',
      status: statusOf({ ahead: 3, behind: 7, upstream: IN_SYNC }),
      expected: { state: 'behind', header: 'rebase', submit: 'secondary', unpushed: 0 },
    },
    {
      name: 'conflict during a rebase',
      status: statusOf({ ahead: 3, behind: 7, upstream: IN_SYNC, inProgress: 'rebase' }),
      expected: { state: 'conflict', header: null, submit: null, unpushed: 0 },
    },
  ])('$name', ({ status, expected }) => {
    expect(branchNextStepOf({ status, hasConflictStop: false })).toMatchObject(expected);
  });

  it('counts a branch with unpushed commits and an upstream as unpushed', () => {
    const step = branchNextStepOf({
      status: statusOf({ ahead: 5, behind: 0, upstream: { kind: 'known', ahead: 2, behind: 0 } }),
      hasConflictStop: false,
    });

    expect(step).toMatchObject({ state: 'unpushed', unpushed: 2, isPushed: false });
  });

  it('rebases first when the branch is behind and also has unpushed commits', () => {
    expect(
      branchNextStepOf({
        status: statusOf({ ahead: 3, behind: 2, upstream: NOT_PUSHED }),
        hasConflictStop: false,
      }),
    ).toMatchObject({ state: 'behind', header: 'rebase', isPushed: false });
  });

  it('hides the form while a rebase job stopped on conflicts', () => {
    expect(
      branchNextStepOf({
        status: statusOf({ ahead: 3, behind: 7, upstream: IN_SYNC }),
        hasConflictStop: true,
      }),
    ).toMatchObject({ state: 'conflict', submit: null });
  });

  it('offers nothing for a branch with no commit of its own', () => {
    expect(
      branchNextStepOf({
        status: statusOf({ ahead: 0, behind: 0, upstream: IN_SYNC }),
        hasConflictStop: false,
      }),
    ).toMatchObject({ state: 'empty', header: null, submit: null });
  });

  it('keeps the form while the status is unknown', () => {
    expect(branchNextStepOf({ status: null, hasConflictStop: false })).toMatchObject({
      state: 'unknown',
      header: null,
      submit: 'primary',
    });
  });

  it('names a rebased branch that origin also moved as diverged, with the commits to force push', () => {
    const step = branchNextStepOf({
      status: statusOf({ ahead: 5, behind: 0, upstream: { kind: 'known', ahead: 2, behind: 1 } }),
      hasConflictStop: false,
    });

    expect(step).toMatchObject({
      state: 'unpushed',
      header: 'push',
      unpushed: 2,
      diverged: { yours: 2, online: 1 },
    });
  });

  it('has no diverged distance on a branch that only runs ahead', () => {
    expect(
      branchNextStepOf({
        status: statusOf({ ahead: 5, behind: 0, upstream: { kind: 'known', ahead: 2, behind: 0 } }),
        hasConflictStop: false,
      }).diverged,
    ).toBeNull();
  });
});
