import { describe, expect, it } from 'vitest';
import type { BranchCommit } from '@goodboy/types';
import { attributeResolverCommits } from './resolver-commits';

const commit = ({
  sha,
  timestamp,
}: {
  readonly sha: string;
  readonly timestamp: number;
}): BranchCommit => ({
  sha,
  shortSha: sha.slice(0, 7),
  subject: `work on ${sha.slice(0, 4)}`,
  author: 'agent',
  timestamp,
  pushed: false,
  parentSha: null,
});

const COMMITS: ReadonlyArray<BranchCommit> = [
  commit({ sha: 'aaaaaaa1111', timestamp: 1_000 }),
  commit({ sha: 'bbbbbbb2222', timestamp: 2_000 }),
  commit({ sha: 'ccccccc3333', timestamp: 3_000 }),
];

const NOW = 4_000_000;

describe('attributeResolverCommits', () => {
  it('matches a reported short sha against the full branch log sha', () => {
    const result = attributeResolverCommits({
      commits: COMMITS,
      reportedShas: ['bbbbbbb'],
      startedAt: undefined,
      completedAt: undefined,
      now: NOW,
    });

    expect(result.reported.map((c) => c.sha)).toEqual(['bbbbbbb2222']);
    expect(result.reportedMissingShas).toEqual([]);
  });

  it('keeps a reported sha that is absent from the branch log separate', () => {
    const result = attributeResolverCommits({
      commits: COMMITS,
      reportedShas: ['deadbeef'],
      startedAt: undefined,
      completedAt: undefined,
      now: NOW,
    });

    expect(result.reported).toEqual([]);
    expect(result.reportedMissingShas).toEqual(['deadbeef']);
  });

  it('collects run-window commits without repeating the reported ones', () => {
    const result = attributeResolverCommits({
      commits: COMMITS,
      reportedShas: ['ccccccc3333'],
      startedAt: new Date(1_500 * 1000).toISOString(),
      completedAt: new Date(3_500 * 1000).toISOString(),
      now: NOW,
    });

    expect(result.reported.map((c) => c.sha)).toEqual(['ccccccc3333']);
    expect(result.withinRunWindow.map((c) => c.sha)).toEqual(['bbbbbbb2222']);
  });

  it('returns no window commits when the resolver never started', () => {
    const result = attributeResolverCommits({
      commits: COMMITS,
      reportedShas: [],
      startedAt: undefined,
      completedAt: undefined,
      now: NOW,
    });

    expect(result.withinRunWindow).toEqual([]);
  });

  it('treats a still running resolver as open ended up to now', () => {
    const result = attributeResolverCommits({
      commits: COMMITS,
      reportedShas: [],
      startedAt: new Date(2_500 * 1000).toISOString(),
      completedAt: undefined,
      now: NOW,
    });

    expect(result.withinRunWindow.map((c) => c.sha)).toEqual(['ccccccc3333']);
  });
});
