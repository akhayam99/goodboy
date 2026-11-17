// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type {
  HistoryRebasePlan,
  MountId,
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
import type { AppStore } from '../../../store/store';
import { resetWorktreeStatusCache } from '../../../store/runtime/worktreeStatuses/cache';
import type { HistoryRun } from '../../../store/slices/history/types';
import { clearSceneInvoke, sceneInvoke } from '../../../test/sceneInvoke';
import { A_REBASE_MOUNT_ID, A_REBASE_SESSION_ID, aRebaseRun } from '../testing/aRebaseRun';
import { brandedId } from '../testing/brandedId';
import { JobBanner } from './index';

const PROJECT_ID = brandedId<ProjectId>({ value: 'project-payments' });
const WORKTREE = '/w/payments-api';
const OTHER_WORKTREE = '/w/ledger-core';
const OTHER_MOUNT_ID = brandedId<MountId>({ value: 'mount-ledger' });

const MOUNT: SessionProjectMount = {
  mountId: A_REBASE_MOUNT_ID,
  sessionId: A_REBASE_SESSION_ID,
  projectId: PROJECT_ID,
  mountName: 'payments-api',
  worktreePath: WORKTREE,
  lastWorktreePath: null,
  repoRoot: '/repos/payments-api',
  branch: 'hl/fix-duplicate-credit',
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 1,
};

const OTHER_MOUNT: SessionProjectMount = {
  ...MOUNT,
  mountId: OTHER_MOUNT_ID,
  mountName: 'ledger-core',
  worktreePath: OTHER_WORKTREE,
  repoRoot: '/repos/ledger-core',
  branch: 'hl/feat-rates',
  parallelIndex: 1,
};

const STATUS: WorktreeStatus = {
  branch: MOUNT.branch,
  head: 'head-sha',
  headSubject: 'Guard the settlement batch',
  upstream: `origin/${MOUNT.branch}`,
  upstreamDistance: { kind: 'known', ahead: 3, behind: 0 },
  mainDistance: { kind: 'known', ahead: 7, behind: 18 },
  workingTree: { kind: 'known', staged: 0, unstaged: 0, untracked: 0, unmerged: 0, changed: 0 },
  inProgress: null,
};

const REBASE_PLAN: HistoryRebasePlan = {
  onto: 'c0ffee000000',
  ontoRef: 'origin/main',
  mergeBase: 'a0a0a0a0a0a0',
  head: 'head-sha',
  commits: [],
  behind: 18,
  fetchError: null,
};

const STOP = {
  reason: 'conflict',
  message: '2 files conflict with main.',
  files: ['src/a.ts', 'src/b.ts'],
  sha: null,
  head: 'head-sha',
} as const;

let useAppStore: Awaited<ReturnType<typeof importStore>>;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  storySpies.tauriInvoke.mockImplementation((command, args) =>
    sceneInvoke({ command: String(command), args }),
  );
  resetWorktreeStatusCache();
  mockSceneIpc((command) => {
    if (command === 'history_rebase_plan') {
      return REBASE_PLAN;
    }
    return command === 'worktree_status' ? STATUS : null;
  });
  useAppStore.setState({
    sessions: [aSession({ id: A_REBASE_SESSION_ID })],
    projects: [aProject({ id: PROJECT_ID, name: 'payments-api', baseBranch: 'main' })],
    sessionProjectMounts: { [A_REBASE_SESSION_ID]: [MOUNT, OTHER_MOUNT] },
  });
});

afterEach(() => {
  cleanup();
  clearSceneInvoke();
});

const settle = () => act(() => new Promise<void>((done) => window.setTimeout(done, 400)));

type StoppedParams = {
  readonly mountId: MountId;
};

const stopped = ({ mountId }: StoppedParams): HistoryRun =>
  aRebaseRun({
    mountId,
    phase: 'stopped',
    commitCount: 4,
    stop: STOP,
    rebaseConflict: {
      ontoRef: 'origin/main',
      baseBranch: 'main',
      head: 'head-sha',
      autoAgentId: null,
    },
  });

const seedTwo = (): void => {
  useAppStore.setState({
    historyRuns: {
      [A_REBASE_MOUNT_ID]: stopped({ mountId: A_REBASE_MOUNT_ID }),
      [OTHER_MOUNT_ID]: stopped({ mountId: OTHER_MOUNT_ID }),
    },
  });
};

const failingKeep = (): ReturnType<typeof vi.fn<AppStore['keepRebaseStop']>> => {
  const keepRebaseStop = vi.fn<AppStore['keepRebaseStop']>(async () => {
    throw new Error('git is busy');
  });
  useAppStore.setState({ keepRebaseStop });
  return keepRebaseStop;
};

describe('the banner on a session with two branches', () => {
  it('keeps a failure on its own branch and names it', async () => {
    seedTwo();
    failingKeep();
    const view = render(<JobBanner sessionId={A_REBASE_SESSION_ID} worktreePath={WORKTREE} />);
    await settle();

    fireEvent.click(screen.getByRole('button', { name: 'Abort rebase' }));
    await settle();
    screen.getByText('payments-api: git is busy');

    view.rerender(<JobBanner sessionId={A_REBASE_SESSION_ID} worktreePath={OTHER_WORKTREE} />);
    await settle();
    expect(screen.queryByText(/git is busy/)).toBeNull();

    view.rerender(<JobBanner sessionId={A_REBASE_SESSION_ID} worktreePath={WORKTREE} />);
    await settle();
    screen.getByText('payments-api: git is busy');
  });

  it('retries the failed branch even after the page moved to the other one and back', async () => {
    seedTwo();
    const keepRebaseStop = failingKeep();
    const view = render(<JobBanner sessionId={A_REBASE_SESSION_ID} worktreePath={WORKTREE} />);
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Abort rebase' }));
    await settle();

    view.rerender(<JobBanner sessionId={A_REBASE_SESSION_ID} worktreePath={OTHER_WORKTREE} />);
    await settle();
    view.rerender(<JobBanner sessionId={A_REBASE_SESSION_ID} worktreePath={WORKTREE} />);
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await settle();

    expect(keepRebaseStop).toHaveBeenCalledTimes(2);
    expect(keepRebaseStop).toHaveBeenLastCalledWith({
      sessionId: A_REBASE_SESSION_ID,
      mountId: A_REBASE_MOUNT_ID,
    });
  });

  it('does not lock the verbs of one branch while another branch is working', async () => {
    seedTwo();
    let release: () => void = () => undefined;
    const keepRebaseStop = vi.fn<AppStore['keepRebaseStop']>(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    useAppStore.setState({ keepRebaseStop });
    const view = render(<JobBanner sessionId={A_REBASE_SESSION_ID} worktreePath={WORKTREE} />);
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Abort rebase' }));
    await settle();

    view.rerender(<JobBanner sessionId={A_REBASE_SESSION_ID} worktreePath={OTHER_WORKTREE} />);
    await settle();

    expect(
      screen.getByRole('button', { name: 'Resolve in terminal' }).hasAttribute('disabled'),
    ).toBe(false);
    release();
    await settle();
  });
});
