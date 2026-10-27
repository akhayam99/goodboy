// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { GitDistance } from '@goodboy/types';
import { branchPushFactsOf, branchPushStateOf } from './branchPushState';

type StatusParams = {
  readonly upstreamDistance: GitDistance;
  readonly upstream?: string | null;
  readonly aheadOfMain?: number;
};

const statusOf = ({ upstreamDistance, upstream = null, aheadOfMain = 8 }: StatusParams) => ({
  upstreamDistance,
  upstream,
  mainDistance: { kind: 'known', ahead: aheadOfMain, behind: 0 } satisfies GitDistance,
});

describe('branchPushStateOf', () => {
  it('says in sync when every commit is already on origin', () => {
    expect(
      branchPushStateOf({
        status: statusOf({ upstreamDistance: { kind: 'known', ahead: 0, behind: 0 } }),
      }),
    ).toEqual({ kind: 'in-sync' });
  });

  it('says ahead with the local commits', () => {
    expect(
      branchPushStateOf({
        status: statusOf({ upstreamDistance: { kind: 'known', ahead: 2, behind: 0 } }),
      }),
    ).toEqual({ kind: 'ahead', ahead: 2 });
  });

  it('says not pushed yet when the branch has no remote copy', () => {
    expect(
      branchPushStateOf({
        status: statusOf({
          upstreamDistance: { kind: 'unknown', reason: 'no-upstream' },
          aheadOfMain: 3,
        }),
      }),
    ).toEqual({ kind: 'not-pushed', commits: 3 });
  });

  it('says diverged when origin moved on its own', () => {
    expect(
      branchPushStateOf({
        status: statusOf({ upstreamDistance: { kind: 'known', ahead: 2, behind: 3 } }),
      }),
    ).toEqual({ kind: 'diverged', ahead: 2, behind: 3 });
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

describe('branchPushFactsOf', () => {
  it('has nothing to push when every commit is already on origin', () => {
    const facts = branchPushFactsOf({
      status: statusOf({ upstreamDistance: { kind: 'known', ahead: 0, behind: 0 } }),
    });

    expect(facts).toEqual({ state: { kind: 'in-sync' }, toPush: 0, canForce: false });
  });

  it('counts the local commits of a branch only ahead of its upstream', () => {
    const facts = branchPushFactsOf({
      status: statusOf({
        upstreamDistance: { kind: 'known', ahead: 4, behind: 0 },
        upstream: 'origin/feature/ledger-core',
      }),
    });

    expect(facts.toPush).toBe(4);
    expect(facts.canForce).toBe(false);
  });

  it('counts the commits ahead of main for a branch never pushed', () => {
    const facts = branchPushFactsOf({
      status: statusOf({
        upstreamDistance: { kind: 'unknown', reason: 'no-upstream' },
        aheadOfMain: 3,
      }),
    });

    expect(facts.toPush).toBe(3);
    expect(facts.canForce).toBe(false);
  });

  it('counts the local commits of a diverged branch and says a force push can send them', () => {
    const facts = branchPushFactsOf({
      status: statusOf({
        upstreamDistance: { kind: 'known', ahead: 2, behind: 3 },
        upstream: 'origin/feature/ledger-core',
      }),
    });

    expect(facts).toEqual({
      state: { kind: 'diverged', ahead: 2, behind: 3 },
      toPush: 2,
      canForce: true,
    });
  });

  it('counts the unpushed commits of the loaded history once the branch has an upstream', () => {
    const facts = branchPushFactsOf({
      status: statusOf({
        upstreamDistance: { kind: 'known', ahead: 2, behind: 3 },
        upstream: 'origin/feature/ledger-core',
      }),
      commits: [{ pushed: false }, { pushed: true }, { pushed: true }],
      hasRemoteHead: true,
    });

    expect(facts.toPush).toBe(1);
    expect(facts.canForce).toBe(true);
  });

  it('ignores the loaded history while the branch has no upstream', () => {
    const facts = branchPushFactsOf({
      status: statusOf({
        upstreamDistance: { kind: 'unknown', reason: 'no-upstream' },
        aheadOfMain: 3,
      }),
      commits: [{ pushed: false }],
      hasRemoteHead: false,
    });

    expect(facts.toPush).toBe(3);
  });

  it('reads nothing before the status arrives', () => {
    expect(branchPushFactsOf({ status: null })).toEqual({
      state: { kind: 'unknown' },
      toPush: 0,
      canForce: false,
    });
  });

  it('never says a diverged branch has nothing to push', () => {
    const facts = branchPushFactsOf({
      status: statusOf({ upstreamDistance: { kind: 'known', ahead: 1, behind: 1 } }),
    });

    expect(facts.toPush).toBeGreaterThan(0);
  });
});
