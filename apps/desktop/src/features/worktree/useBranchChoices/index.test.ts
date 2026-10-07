// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { OpenPrBranch } from '@goodboy/core';
import type { LocalBranchInfo, RemoteBranchInfo } from '../worktree';

const h = vi.hoisted(() => ({
  locals: vi.fn(),
  remotes: vi.fn(),
  fetchRemotes: vi.fn(),
  prs: vi.fn(),
}));

vi.mock('../worktree', () => ({
  getCachedLocalBranches: () => undefined,
  listLocalBranches: h.locals,
  listRemoteBranches: h.remotes,
  fetchRemoteBranches: h.fetchRemotes,
}));
vi.mock('../../integrations/github/github', () => ({ ghOpenPrBranches: h.prs }));

import { useBranchChoices } from './index';

const local = (name: string): LocalBranchInfo => ({ name, inUse: false, hasUncommitted: false });
const remote = (name: string): RemoteBranchInfo => ({
  name,
  author: 'Mara Cole',
  sha: 'a'.repeat(40),
  timestamp: 1,
  hasLocal: false,
});
const pr = (headBranch: string): OpenPrBranch => ({
  number: 12,
  title: 'Round the credit note',
  headBranch,
  isDraft: false,
  author: 'Mara Cole',
});

const LEDGER = '/work/ledger-core';
const NOTIFY = '/work/notify-relay';

beforeEach(() => {
  h.locals.mockReset();
  h.remotes.mockReset();
  h.fetchRemotes.mockReset().mockResolvedValue(undefined);
  h.prs.mockReset();
});

describe('useBranchChoices', () => {
  it('merges the local, remote and pull request branches of the repository', async () => {
    h.locals.mockResolvedValue([local('main')]);
    h.remotes.mockResolvedValue([remote('hl/cta')]);
    h.prs.mockResolvedValue([pr('hl/fix-credit')]);

    const { result } = renderHook(() => useBranchChoices({ repoRoot: LEDGER }));

    await waitFor(() =>
      expect(result.current.choices.map((choice) => choice.name)).toEqual([
        'main',
        'hl/fix-credit',
        'hl/cta',
      ]),
    );
  });

  it('drops the previous repository branches at once when the repository changes, even if every new read fails', async () => {
    h.locals.mockImplementation(async (root: string) =>
      root === LEDGER ? [local('ledger-main')] : Promise.reject(new Error('not a repository')),
    );
    h.remotes.mockImplementation(async (root: string) =>
      root === LEDGER ? [remote('ledger-remote')] : Promise.reject(new Error('no origin')),
    );
    h.prs.mockImplementation(async ({ cwd }: { cwd: string }) =>
      cwd === LEDGER ? [pr('ledger-pr')] : Promise.reject(new Error('no pull requests')),
    );
    const { result, rerender } = renderHook(
      ({ repoRoot }: { repoRoot: string }) => useBranchChoices({ repoRoot }),
      { initialProps: { repoRoot: LEDGER } },
    );
    await waitFor(() => expect(result.current.choices).toHaveLength(3));

    rerender({ repoRoot: NOTIFY });

    expect(result.current.choices).toEqual([]);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.choices).toEqual([]);
  });

  it('keeps the branches while only the workspace changes', async () => {
    h.locals.mockResolvedValue([local('main')]);
    h.remotes.mockResolvedValue([]);
    h.prs.mockResolvedValue([]);
    const { result, rerender } = renderHook(
      ({ workspaceId }: { workspaceId: string }) =>
        useBranchChoices({ repoRoot: LEDGER, workspaceId }),
      { initialProps: { workspaceId: 'w1' } },
    );
    await waitFor(() => expect(result.current.choices).toHaveLength(1));

    rerender({ workspaceId: 'w2' });

    expect(result.current.choices).toHaveLength(1);
  });
});
