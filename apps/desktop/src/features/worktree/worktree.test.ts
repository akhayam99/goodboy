import { beforeEach, describe, expect, it, vi } from 'vitest';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock('@tauri-apps/api/core', () => ({ invoke }));

import {
  getCachedLocalBranches,
  invalidateLocalBranchesCache,
  listLocalBranches,
} from './worktree';

describe('local branches cache', () => {
  beforeEach(() => {
    invoke.mockReset();
    invalidateLocalBranchesCache('/repo-a');
    invalidateLocalBranchesCache('/repo-b');
  });

  it('has nothing cached before the first fetch', () => {
    expect(getCachedLocalBranches('/repo-a')).toBeUndefined();
  });

  it('populates the cache for the fetched repo path after listLocalBranches resolves', async () => {
    const branches = [{ name: 'main', inUse: true, hasUncommitted: false }];
    invoke.mockResolvedValue(branches);

    const result = await listLocalBranches('/repo-a');

    expect(result).toEqual(branches);
    expect(getCachedLocalBranches('/repo-a')).toEqual(branches);
  });

  it('keys the cache per repo path', async () => {
    invoke.mockResolvedValueOnce([{ name: 'main', inUse: false, hasUncommitted: false }]);
    invoke.mockResolvedValueOnce([{ name: 'develop', inUse: false, hasUncommitted: true }]);

    await listLocalBranches('/repo-a');
    await listLocalBranches('/repo-b');

    expect(getCachedLocalBranches('/repo-a')).toEqual([
      { name: 'main', inUse: false, hasUncommitted: false },
    ]);
    expect(getCachedLocalBranches('/repo-b')).toEqual([
      { name: 'develop', inUse: false, hasUncommitted: true },
    ]);
  });

  it('clears only the invalidated repo path', async () => {
    invoke.mockResolvedValueOnce([{ name: 'main', inUse: false, hasUncommitted: false }]);
    invoke.mockResolvedValueOnce([{ name: 'develop', inUse: false, hasUncommitted: true }]);
    await listLocalBranches('/repo-a');
    await listLocalBranches('/repo-b');

    invalidateLocalBranchesCache('/repo-a');

    expect(getCachedLocalBranches('/repo-a')).toBeUndefined();
    expect(getCachedLocalBranches('/repo-b')).toEqual([
      { name: 'develop', inUse: false, hasUncommitted: true },
    ]);
  });
});
