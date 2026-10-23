// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { GitDistance } from '@goodboy/types';
import { notPushedOf } from './notPushedOf';

type StatusParams = {
  readonly upstreamDistance: GitDistance;
  readonly upstream: string | null;
};

const statusOf = ({ upstreamDistance, upstream }: StatusParams) => ({
  upstreamDistance,
  upstream,
  mainDistance: { kind: 'known', ahead: 3, behind: 0 } satisfies GitDistance,
});

describe('notPushedOf', () => {
  it('counts the local commits of a diverged branch before its history loads', () => {
    const status = statusOf({
      upstreamDistance: { kind: 'known', ahead: 2, behind: 3 },
      upstream: 'origin/feature/ledger-core',
    });

    expect(notPushedOf({ status, commits: null, hasRemoteHead: true })).toBe(2);
  });

  it('counts the local commits of a branch only ahead of its upstream', () => {
    const status = statusOf({
      upstreamDistance: { kind: 'known', ahead: 4, behind: 0 },
      upstream: 'origin/feature/ledger-core',
    });

    expect(notPushedOf({ status, commits: null, hasRemoteHead: true })).toBe(4);
  });

  it('counts the commits ahead of main for a branch never pushed', () => {
    const status = statusOf({
      upstreamDistance: { kind: 'unknown', reason: 'no-upstream' },
      upstream: null,
    });

    expect(notPushedOf({ status, commits: null, hasRemoteHead: false })).toBe(3);
  });

  it('counts the unpushed commits of the loaded history once the branch has an upstream', () => {
    const status = statusOf({
      upstreamDistance: { kind: 'known', ahead: 2, behind: 3 },
      upstream: 'origin/feature/ledger-core',
    });
    const commits = [{ pushed: false }, { pushed: true }, { pushed: true }];

    expect(notPushedOf({ status, commits, hasRemoteHead: true })).toBe(1);
  });

  it('reads nothing before the status arrives', () => {
    expect(notPushedOf({ status: null, commits: null, hasRemoteHead: false })).toBeNull();
  });
});
