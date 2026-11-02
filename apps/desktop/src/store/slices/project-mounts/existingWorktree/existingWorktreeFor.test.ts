// @vitest-environment node

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../storyHarness')).tauriEventModuleMock(),
);

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { storySpies } from '../../../storyHarness';
import { existingWorktreeFor } from './existingWorktreeFor';

const REPO = '/repos/ledger-core';
const HELD_AT = '/repos/ledger-core/.goodboy/worktrees/gb-held';

const holderIs = ({ path }: { readonly path: string | null }) => {
  storySpies.tauriInvoke.mockImplementation(async (command) => {
    if (command === 'worktree_branch_holder') {
      return path;
    }
    throw new Error(`unexpected command ${String(command)}`);
  });
};

beforeEach(() => {
  storySpies.tauriInvoke.mockReset();
});

describe('existingWorktreeFor', () => {
  it('points the mount at the worktree that holds the branch', async () => {
    holderIs({ path: HELD_AT });

    await expect(
      existingWorktreeFor({ repoPath: REPO, branch: 'ak/held', worktreePath: HELD_AT }),
    ).resolves.toEqual({
      worktreePath: HELD_AT,
      branchName: 'ak/held',
      slug: 'held',
      reused: true,
    });
  });

  it('refuses when another worktree holds the branch now', async () => {
    holderIs({ path: '/repos/ledger-core/.goodboy/worktrees/gb-other' });

    await expect(
      existingWorktreeFor({ repoPath: REPO, branch: 'ak/held', worktreePath: HELD_AT }),
    ).rejects.toThrow('ak/held is no longer checked out');
  });

  it('refuses when no worktree holds the branch any more', async () => {
    holderIs({ path: null });

    await expect(
      existingWorktreeFor({ repoPath: REPO, branch: 'ak/held', worktreePath: HELD_AT }),
    ).rejects.toThrow('no longer checked out');
  });
});
