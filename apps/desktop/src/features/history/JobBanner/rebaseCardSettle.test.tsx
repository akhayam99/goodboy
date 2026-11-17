// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type {
  HistoryOriginAhead,
  ProjectId,
  SessionProjectMount,
  WorktreeStatus,
} from '@goodboy/types';
import { aProject, aSession } from '@goodboy/types/testing';
import { mockSceneIpc } from '../../../app/components/MockScene/scenes/mockSceneIpc';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
} from '../../../store/storyHarness';
import {
  refreshWorktreeStatuses,
  resetWorktreeStatusCache,
} from '../../../store/runtime/worktreeStatuses/cache';
import type { HistoryRun } from '../../../store/slices/history/types';
import { clearSceneInvoke, sceneInvoke } from '../../../test/sceneInvoke';
import { A_REBASE_MOUNT_ID, A_REBASE_SESSION_ID, aRebaseRun } from '../testing/aRebaseRun';
import { brandedId } from '../testing/brandedId';
import { JobBanner } from './index';

const PROJECT_ID = brandedId<ProjectId>({ value: 'project-ledger-core' });
const WORKTREE = '/w/ledger-core';

const MOUNT: SessionProjectMount = {
  mountId: A_REBASE_MOUNT_ID,
  sessionId: A_REBASE_SESSION_ID,
  projectId: PROJECT_ID,
  mountName: 'ledger-core',
  worktreePath: WORKTREE,
  lastWorktreePath: null,
  repoRoot: '/repos/ledger-core',
  branch: 'hl/settle-ledger',
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 1,
};

const git = { ahead: 3, head: 'rebased-sha' };

const statusNow = (): WorktreeStatus => ({
  branch: MOUNT.branch,
  head: git.head,
  headSubject: 'Settle the ledger in one batch',
  upstream: `origin/${MOUNT.branch}`,
  upstreamDistance: { kind: 'known', ahead: git.ahead, behind: 0 },
  mainDistance: { kind: 'known', ahead: 3, behind: 0 },
  workingTree: { kind: 'known', staged: 0, unstaged: 0, untracked: 0, unmerged: 0, changed: 0 },
  inProgress: null,
});

const ORIGIN_AHEAD: HistoryOriginAhead = {
  remoteSha: 'online-sha',
  knownRemoteSha: 'old-online-sha',
  commits: [{ sha: '7c41e0a9b8c7', subject: 'Round the ledger totals' }],
  onlyOnline: [{ sha: '7c41e0a9b8c7', subject: 'Round the ledger totals', author: 'Northwind' }],
  fetchError: null,
};

const ORIGIN_MOVED: Partial<HistoryRun> = {
  phase: 'stopped',
  backupRef: 'refs/goodboy/backup/1',
  stop: { reason: 'origin-moved', message: 'Origin moved.', files: [], sha: null },
};

let useAppStore: Awaited<ReturnType<typeof importStore>>;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  sessionStorage.clear();
  await resetStoryStore();
  storySpies.tauriInvoke.mockImplementation((command, args) =>
    sceneInvoke({ command: String(command), args }),
  );
  resetWorktreeStatusCache();
  git.ahead = 3;
  git.head = 'rebased-sha';
  mockSceneIpc((command) => {
    if (command === 'history_origin_ahead') {
      return ORIGIN_AHEAD;
    }
    return command === 'worktree_status' ? statusNow() : null;
  });
  useAppStore.setState({
    sessions: [aSession({ id: A_REBASE_SESSION_ID })],
    projects: [aProject({ id: PROJECT_ID, name: 'ledger-core', baseBranch: 'main' })],
    sessionProjectMounts: { [A_REBASE_SESSION_ID]: [MOUNT] },
  });
});

afterEach(() => {
  cleanup();
  clearSceneInvoke();
});

const showOriginMoved = async (): Promise<void> => {
  useAppStore.setState({
    historyRuns: {
      [A_REBASE_MOUNT_ID]: aRebaseRun({ ...ORIGIN_MOVED, updatedAt: Date.now() - 5_000 }),
    },
  });
  render(<JobBanner sessionId={A_REBASE_SESSION_ID} worktreePath={WORKTREE} />);
  await screen.findByRole('region', { name: 'Rebase' });
};

describe('a stopped rebase card on the branch page', () => {
  it('puts Dismiss on the title row, and Dismiss leaves no card behind', async () => {
    await showOriginMoved();
    const dismiss = screen.getByRole('button', { name: 'Dismiss' });
    expect(dismiss.closest('p')?.textContent).toContain(
      'Rebased here, but origin has 1 new commit',
    );

    fireEvent.click(dismiss);

    await waitFor(() => expect(screen.queryByRole('region', { name: 'Rebase' })).toBeNull());
    expect(screen.queryByText(/Rebased here/)).toBeNull();
  });

  it('settles on its own once origin has the rebased commits, with one quiet line', async () => {
    await showOriginMoved();
    screen.getByRole('region', { name: 'Rebase' });

    git.ahead = 0;
    git.head = 'pushed-sha';
    await act(() => refreshWorktreeStatuses({ worktreePaths: [WORKTREE] }));

    await waitFor(() => expect(screen.queryByRole('region', { name: 'Rebase' })).toBeNull());
    expect(screen.getByRole('status').textContent).toBe('Origin now has your rebased commits');
    expect(useAppStore.getState().historyRuns[A_REBASE_MOUNT_ID]).toBeUndefined();
  });

  it('keeps the card while the branch and origin still diverge after a refresh', async () => {
    await showOriginMoved();

    await act(() => refreshWorktreeStatuses({ worktreePaths: [WORKTREE] }));

    screen.getByRole('region', { name: 'Rebase' });
    expect(screen.queryByText('Origin now has your rebased commits')).toBeNull();
  });
});
