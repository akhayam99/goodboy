import { describe, expect, it } from 'vitest';
import type { GitDistance } from '@goodboy/types';
import { branchPushStateOf, commitsToPush } from './branchPushState';

type StatusParams = {
  readonly upstreamDistance: GitDistance;
  readonly aheadOfMain?: number;
};

const statusOf = ({ upstreamDistance, aheadOfMain = 8 }: StatusParams) => ({
  upstreamDistance,
  mainDistance: { kind: 'known', ahead: aheadOfMain, behind: 0 } satisfies GitDistance,
});

describe('branchPushStateOf', () => {
  it('counts nothing to push when every commit is already on origin', () => {
    const state = branchPushStateOf({
      status: statusOf({ upstreamDistance: { kind: 'known', ahead: 0, behind: 0 } }),
    });

    expect(state).toEqual({ kind: 'in-sync' });
    expect(commitsToPush({ state })).toBe(0);
  });

  it('counts only the local commits', () => {
    const state = branchPushStateOf({
      status: statusOf({ upstreamDistance: { kind: 'known', ahead: 2, behind: 0 } }),
    });

    expect(state).toEqual({ kind: 'ahead', ahead: 2 });
    expect(commitsToPush({ state })).toBe(2);
  });

  it('says not pushed yet when the branch has no remote copy', () => {
    const state = branchPushStateOf({
      status: statusOf({
        upstreamDistance: { kind: 'unknown', reason: 'no-upstream' },
        aheadOfMain: 3,
      }),
    });

    expect(state).toEqual({ kind: 'not-pushed', commits: 3 });
    expect(commitsToPush({ state })).toBe(3);
  });

  it('says diverged, with nothing a plain push can send, when origin moved on its own', () => {
    const state = branchPushStateOf({
      status: statusOf({ upstreamDistance: { kind: 'known', ahead: 2, behind: 3 } }),
    });

    expect(state).toEqual({ kind: 'diverged', ahead: 2, behind: 3 });
    expect(commitsToPush({ state })).toBe(0);
  });

  it('keeps a pruned remote branch apart from one never pushed', () => {
    expect(
      branchPushStateOf({
        status: statusOf({ upstreamDistance: { kind: 'unknown', reason: 'upstream-gone' } }),
      }),
    ).toEqual({ kind: 'gone' });
    expect(
      branchPushStateOf({
        status: statusOf({ upstreamDistance: { kind: 'unknown', reason: 'rev-list-failed' } }),
      }),
    ).toEqual({ kind: 'unknown' });
  });
});
