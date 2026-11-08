// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { LedgerRow, MonitorSnapshot } from '@goodboy/core/monitoring';
import type {
  MountId,
  Project,
  ProjectId,
  SessionId,
  SessionProjectMount,
  WorkspaceId,
} from '@goodboy/types';
import { aProject, aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import { brandedId } from '../../../history/testing/brandedId';
import { BranchRunningLine } from './index';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).sqliteDbLibModuleMock(),
);

const WORKSPACE_ID = brandedId<WorkspaceId>({ value: 'w-northwind' });
const SESSION_ID = brandedId<SessionId>({ value: 's-northwind' });
const PROJECT_ID = brandedId<ProjectId>({ value: 'payments-api' });
const BRANCH = 'nw/fix-duplicate-credit';
const WORKTREE = '/mock/worktrees/northwind/payments-api';

const PROJECT: Project = aProject({
  id: PROJECT_ID,
  workspaceId: WORKSPACE_ID,
  name: 'payments-api',
  rootPath: '/mock/repos/payments-api',
});

const MOUNT: SessionProjectMount = {
  mountId: brandedId<MountId>({ value: 'm-payments' }),
  sessionId: SESSION_ID,
  projectId: PROJECT_ID,
  mountName: 'payments-api',
  worktreePath: WORKTREE,
  lastWorktreePath: WORKTREE,
  repoRoot: '/mock/repos/payments-api',
  branch: BRANCH,
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 1,
};

const RUNNING: MonitorSnapshot = {
  listeners: [{ port: 5173, address: '127.0.0.1', protocol: 'tcp', pid: 4100 }],
  processes: [
    {
      pid: 4100,
      ppid: 1,
      pgid: 4100,
      name: 'node',
      cwd: WORKTREE,
      startedAt: 1,
      cpuPercent: 0,
      rssBytes: 0,
      uid: 501,
      argsMasked: 'node vite',
    },
  ],
  takenAt: 2,
  isPlatformSupported: true,
};

const IDLE: MonitorSnapshot = { ...RUNNING, listeners: [], processes: [] };

const LEDGER: ReadonlyArray<LedgerRow> = [
  {
    spawnId: 'spawn-dev',
    kind: 'terminal',
    pid: 4100,
    pgid: 4100,
    sessionId: SESSION_ID,
    mountPath: null,
    cwd: WORKTREE,
    startedAt: 1,
    branch: BRANCH,
  },
];

type SeedParams = {
  readonly snapshot: MonitorSnapshot;
  readonly ledger: ReadonlyArray<LedgerRow>;
};

let useAppStore: StoryStore;

const seed = ({ snapshot, ledger }: SeedParams): void => {
  stubStoryInvoke({
    monitor_snapshot: () => snapshot,
    process_ledger_list: () => ledger,
    monitor_watched_ports: () => [],
  });
  useAppStore.setState({
    currentWorkspaceId: WORKSPACE_ID,
    projects: [PROJECT],
    sessions: [aSession({ id: SESSION_ID, workspaceId: WORKSPACE_ID })],
    sessionProjectMounts: { [SESSION_ID]: [MOUNT] },
    monitorSnapshot: snapshot,
    monitorLedger: ledger,
  });
};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
});

describe('BranchRunningLine', () => {
  it('is hidden when nothing runs on the branch', async () => {
    seed({ snapshot: IDLE, ledger: [] });
    const { container } = render(<BranchRunningLine workspaceId={WORKSPACE_ID} mount={MOUNT} />);
    await act(async () => undefined);

    expect(container.querySelector('[data-branch-running-line]')).toBeNull();
    expect(screen.queryByText('Running here')).toBeNull();
  });

  it('is hidden when a port runs on another branch', async () => {
    seed({ snapshot: RUNNING, ledger: [{ ...LEDGER[0]!, branch: 'nw/ledger-rounding' }] });
    render(<BranchRunningLine workspaceId={WORKSPACE_ID} mount={MOUNT} />);
    await act(async () => undefined);

    expect(screen.queryByText('Running here')).toBeNull();
  });

  it('does not ask for a snapshot while the Branch page is not on screen', async () => {
    seed({ snapshot: RUNNING, ledger: LEDGER });
    const refreshMonitorSnapshot = vi.fn(async () => undefined);
    const loadWatchedPorts = vi.fn(async () => undefined);
    act(() => useAppStore.setState({ refreshMonitorSnapshot, loadWatchedPorts }));
    render(<BranchRunningLine workspaceId={WORKSPACE_ID} mount={MOUNT} isActive={false} />);
    await act(async () => undefined);

    expect(loadWatchedPorts).not.toHaveBeenCalled();
    expect(refreshMonitorSnapshot).not.toHaveBeenCalled();
  });

  it('names the port that runs here and opens Monitoring filtered to the branch', async () => {
    seed({ snapshot: RUNNING, ledger: LEDGER });
    const openStudio = vi.fn();
    act(() => useAppStore.setState({ openStudio }));
    render(<BranchRunningLine workspaceId={WORKSPACE_ID} mount={MOUNT} />);

    const name = 'Open :5173 node in Monitoring';
    await waitFor(() => expect(screen.queryByRole('button', { name })).not.toBeNull());
    const pill = screen.getByRole('button', { name });
    screen.getByText('Terminal');
    fireEvent.click(pill);

    expect(openStudio).toHaveBeenCalledWith({
      studio: {
        kind: 'monitoring',
        target: { workspaceId: WORKSPACE_ID, projectId: PROJECT_ID, branch: BRANCH },
      },
    });
  });
});
