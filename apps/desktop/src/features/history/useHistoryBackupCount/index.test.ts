// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { resetStorySpies, stubStoryInvoke } from '../../../store/storyHarness';
import { useHistoryBackupCount } from './index';

type BranchProps = {
  readonly branch: string;
};

const BACKUPS = [{ sha: 'a1' }, { sha: 'b2' }];

beforeEach(() => {
  resetStorySpies();
  stubStoryInvoke({ history_backups_list: () => BACKUPS });
});

describe('useHistoryBackupCount', () => {
  it('counts the backups of the selected branch', async () => {
    const { result } = renderHook(() =>
      useHistoryBackupCount({ worktreePath: '/wt/ledger-core', branch: 'hl/export', revision: 0 }),
    );

    await waitFor(() => expect(result.current).toBe(2));
  });

  it('drops the count when the branch becomes empty', async () => {
    const { result, rerender } = renderHook(
      ({ branch }: BranchProps) =>
        useHistoryBackupCount({ worktreePath: '/wt/ledger-core', branch, revision: 0 }),
      { initialProps: { branch: 'hl/export' } },
    );
    await waitFor(() => expect(result.current).toBe(2));

    rerender({ branch: '' });

    await waitFor(() => expect(result.current).toBe(0));
  });

  it('drops the old count while another branch is still loading', async () => {
    const { result, rerender } = renderHook(
      ({ branch }: BranchProps) =>
        useHistoryBackupCount({ worktreePath: '/wt/ledger-core', branch, revision: 0 }),
      { initialProps: { branch: 'hl/export' } },
    );
    await waitFor(() => expect(result.current).toBe(2));
    stubStoryInvoke({ history_backups_list: () => new Promise(() => undefined) });

    rerender({ branch: 'hl/other' });

    await waitFor(() => expect(result.current).toBe(0));
  });
});
