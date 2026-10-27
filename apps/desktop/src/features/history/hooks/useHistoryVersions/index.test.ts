// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { SessionId } from '@goodboy/types';
import { nextSessionId } from '@goodboy/types/testing';
import { resetStorySpies, stubStoryInvoke } from '../../../../store/storyHarness';
import { useHistoryVersions } from './index';

type BranchProps = {
  readonly branch: string;
};

const SESSION_ID: SessionId = nextSessionId();
const BACKUPS = [
  {
    refName: 'refs/goodboy/backup/b-01/1',
    sha: 'a1',
    subject: 'Acme export',
    createdAt: 1,
    isLegacy: false,
  },
];

beforeEach(() => {
  resetStorySpies();
  stubStoryInvoke({ history_backups_list: () => BACKUPS });
});

describe('useHistoryVersions', () => {
  it('drops the old rows while another branch is still loading', async () => {
    const { result, rerender } = renderHook(
      ({ branch }: BranchProps) =>
        useHistoryVersions({
          sessionId: SESSION_ID,
          worktreePath: '/wt/ledger-core',
          branch,
          baseRef: null,
          headSha: null,
          revision: 0,
        }),
      { initialProps: { branch: 'hl/export' } },
    );
    await waitFor(() => expect(result.current).toHaveLength(1));
    stubStoryInvoke({ history_backups_list: () => new Promise(() => undefined) });

    rerender({ branch: 'hl/other' });

    await waitFor(() => expect(result.current).toBeNull());
  });

  it('reads at most four version facts at a time and keeps them in order', async () => {
    const many = Array.from({ length: 10 }, (_, index) => ({
      subject: 'Acme export',
      createdAt: index,
      isLegacy: false,
      refName: `refs/goodboy/backup/b-01/${index}`,
      sha: `sha-${index}`,
    }));
    let running = 0;
    let peak = 0;
    stubStoryInvoke({
      history_backups_list: () => many,
      history_backup_facts: async () => {
        running += 1;
        peak = Math.max(peak, running);
        await new Promise((resolve) => setTimeout(resolve, 5));
        running -= 1;
        return {
          commits: [],
          isSameForkAsNext: false,
          nextCommitCount: 0,
          filesChangedVsNow: 0,
          additionsVsNow: 0,
          deletionsVsNow: 0,
        };
      },
    });

    const { result } = renderHook(() =>
      useHistoryVersions({
        sessionId: SESSION_ID,
        worktreePath: '/wt/ledger-core',
        branch: 'hl/export',
        baseRef: 'main',
        headSha: 'head',
        revision: 0,
      }),
    );

    await waitFor(() => expect(result.current).toHaveLength(10));
    expect(peak).toBe(4);
    expect(result.current?.map((version) => version.backup.sha)).toEqual(
      many.map((backup) => backup.sha),
    );
    expect(result.current?.every((version) => version.facts !== null)).toBe(true);
  });
});
