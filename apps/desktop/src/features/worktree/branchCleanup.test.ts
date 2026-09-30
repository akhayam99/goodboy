import { beforeEach, describe, expect, it, vi } from 'vitest';
import { formatError } from '@goodboy/ui';

const h = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock('@tauri-apps/api/core', () => ({ invoke: h.invoke }));

import { asBranchCleanupError, listProjectBranches } from './branchCleanup';

const rejectScanWith = async (wire: unknown): Promise<unknown> => {
  h.invoke.mockRejectedValueOnce(wire);
  return listProjectBranches({ repoRoot: '/repos/ledger-core', base: null }).catch(
    (caught: unknown) => caught,
  );
};

beforeEach(() => {
  h.invoke.mockReset();
});

describe('branch cleanup errors through the wrapper', () => {
  it('shows the written message of a repo-not-found rejection', async () => {
    const error = await rejectScanWith({
      kind: 'repo-not-found',
      message: 'the repository folder was not found',
    });

    expect(formatError(error)).toBe('the repository folder was not found');
  });

  it('keeps the sha and the path reachable behind the normalized error', async () => {
    const moved = await rejectScanWith({
      kind: 'sha-moved',
      message: 'the branch moved to abc123 while it was being checked',
      actual: 'abc123',
    });
    const held = await rejectScanWith({
      kind: 'held-by-worktree',
      message: 'the branch is checked out in /work/ledger-core',
      path: '/work/ledger-core',
    });

    expect(asBranchCleanupError(moved)).toMatchObject({ kind: 'sha-moved', actual: 'abc123' });
    expect(asBranchCleanupError(held)).toMatchObject({
      kind: 'held-by-worktree',
      path: '/work/ledger-core',
    });
  });

  it('still reads a bare wire object and refuses an unrelated kind', () => {
    expect(asBranchCleanupError({ kind: 'branch-missing' })).toEqual({ kind: 'branch-missing' });
    expect(asBranchCleanupError({ kind: 'io', message: 'disk full' })).toBeNull();
    expect(asBranchCleanupError(new Error('boom'))).toBeNull();
  });
});
