// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { retainedDirName } from './retainedDirName';

describe('retainedDirName', () => {
  it('keeps the last segment of an old long worktree path untouched', () => {
    const path =
      '/repos/ledger-core/.goodboy/worktrees/retry-sync-3c43f246-856d-4e7d-81d3-e05b5e18a6c5';

    expect(retainedDirName({ path })).toBe('retry-sync-3c43f246-856d-4e7d-81d3-e05b5e18a6c5');
  });

  it('reads a short name and ignores a trailing separator', () => {
    expect(retainedDirName({ path: '/repos/ledger-core/.goodboy/worktrees/gb-7k2q9x/' })).toBe(
      'gb-7k2q9x',
    );
  });

  it('reads a windows path', () => {
    expect(
      retainedDirName({ path: 'C:\\repos\\ledger-core\\.goodboy\\worktrees\\gb-7k2q9x' }),
    ).toBe('gb-7k2q9x');
  });

  it('has nothing to keep without a stored path', () => {
    expect(retainedDirName({ path: null })).toBeUndefined();
    expect(retainedDirName({ path: '' })).toBeUndefined();
  });
});
