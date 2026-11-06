// @vitest-environment happy-dom

const remoteBranchState = vi.hoisted(() => vi.fn());
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../../worktree/worktree', async () => ({
  ...(await import('../../../../../../store/storyHarness')).worktreeModuleMock(),
  remoteBranchState,
}));

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import type { WorktreeStatus } from '@goodboy/types';
import type { MountRowView } from '../../../../../../store/slices/project-mounts/mountRowModel';
import { worktreeStatusOf } from '../../../../../../test/worktreeStatusOf';
import { aMountRow, aRequest } from '../../../../central/branches/testing/aMountRow';
import { useForeignCommitsByMount } from '.';

const BRANCH = 'fix/ledger-reconciliation';

const STRANDED = { remoteAhead: 2, localOwn: 0, remoteContainsLocal: true };

const statusOf = (): WorktreeStatus => ({
  ...worktreeStatusOf({}),
  branch: BRANCH,
  head: 'abc1234',
  mainDistance: { kind: 'known', ahead: 0, behind: 0 },
});

const rowOf = (): MountRowView => ({
  ...aMountRow({
    key: 'ledger',
    projectName: 'ledger-core',
    branch: BRANCH,
    request: aRequest({ provider: 'github', number: 12 }),
  }),
});

beforeEach(() => {
  remoteBranchState.mockReset();
  remoteBranchState.mockResolvedValue(STRANDED);
});

afterEach(cleanup);

describe('useForeignCommitsByMount', () => {
  it('finds the stranded branch of a candidate', async () => {
    const row = rowOf();
    const view = renderHook(() => useForeignCommitsByMount({ rows: [row], statusOf }));

    await waitFor(() => expect(view.result.current.get(row.mountId)?.remoteAhead).toBe(2));
  });

  it('does not probe the remote again when the rows are rebuilt with the same facts', async () => {
    const row = rowOf();
    const view = renderHook(({ rows }) => useForeignCommitsByMount({ rows, statusOf }), {
      initialProps: { rows: [row] },
    });
    await waitFor(() => expect(view.result.current.size).toBe(1));
    expect(remoteBranchState).toHaveBeenCalledTimes(1);

    view.rerender({ rows: [{ ...row }] });
    view.rerender({ rows: [{ ...row, revision: row.revision + 1 }] });

    expect(remoteBranchState).toHaveBeenCalledTimes(1);
  });

  it('probes again when the head of the branch moved', async () => {
    const row = rowOf();
    let head = 'abc1234';
    const movingStatusOf = (): WorktreeStatus => ({ ...statusOf(), head });
    const view = renderHook(
      ({ rows }) => useForeignCommitsByMount({ rows, statusOf: movingStatusOf }),
      { initialProps: { rows: [row] } },
    );
    await waitFor(() => expect(remoteBranchState).toHaveBeenCalledTimes(1));

    head = 'def5678';
    view.rerender({ rows: [{ ...row }] });

    await waitFor(() => expect(remoteBranchState).toHaveBeenCalledTimes(2));
  });
});
