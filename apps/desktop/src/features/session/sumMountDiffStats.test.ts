// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { sumMountDiffStats } from './sumMountDiffStats';

describe('sumMountDiffStats', () => {
  it('adds the stat of every mount', () => {
    const stats = new Map([
      ['/tmp/payments-api', { additions: 10, deletions: 2 }],
      ['/tmp/ledger-core', { additions: 5, deletions: 0 }],
    ]);
    expect(sumMountDiffStats({ stats })).toEqual({ additions: 15, deletions: 2 });
  });

  it('is zero without mounts', () => {
    expect(sumMountDiffStats({ stats: new Map() })).toEqual({ additions: 0, deletions: 0 });
  });
});
