// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { MonitorSnapshot } from '@goodboy/core/monitoring';
import type {
  MountId,
  ProjectId,
  Session,
  SessionId,
  SessionProjectMount,
  WorkspaceId,
} from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import { brandedId } from '../../../history/testing/brandedId';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import { ObjectMenuProvider } from '../../../actions/components/ObjectMenuProvider';
import { MonitoringPage } from './MonitoringPage';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).sqliteDbLibModuleMock(),
);

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const TAKEN_AT = 1_800_000_000_000;

const SNAPSHOT: MonitorSnapshot = {
  listeners: [{ port: 5005, address: '127.0.0.1', protocol: 'tcp', pid: 4100 }],
  processes: [
    {
      pid: 4100,
      ppid: 1,
      pgid: 4100,
      name: 'node',
      cwd: '/mock/harborline/payments-api',
      startedAt: TAKEN_AT - 3_600_000,
      cpuPercent: 1.2,
      rssBytes: 212 * 1024 * 1024,
      uid: 501,
      argsMasked: 'node server.js',
    },
  ],
  takenAt: TAKEN_AT,
  isPlatformSupported: true,
};

const WORKSPACE_A = brandedId<WorkspaceId>({ value: 'w-harborline' });
const WORKSPACE_B = brandedId<WorkspaceId>({ value: 'w-northwind' });
const PROJECT_A = brandedId<ProjectId>({ value: 'p-payments-api' });
const PROJECT_B = brandedId<ProjectId>({ value: 'p-notify-relay' });
const SESSION_A = brandedId<SessionId>({ value: 's-harborline' });
const SESSION_B = brandedId<SessionId>({ value: 's-northwind' });
const BRANCH = 'feature/check';
const TREE_A = '/mock/worktrees/harborline/check';
const TREE_B = '/mock/worktrees/northwind/check';

type SessionParams = {
  readonly id: SessionId;
  readonly workspaceId: WorkspaceId;
};

const sessionOf = ({ id, workspaceId }: SessionParams): Session => aSession({ id, workspaceId });

type MountParams = {
  readonly sessionId: SessionId;
  readonly projectId: ProjectId;
  readonly worktreePath: string;
};

const projectMountOf = ({
  sessionId,
  projectId,
  worktreePath,
}: MountParams): SessionProjectMount => ({
  mountId: brandedId<MountId>({ value: `m-${sessionId}` }),
  sessionId,
  projectId,
  mountName: 'check',
  worktreePath,
  lastWorktreePath: worktreePath,
  repoRoot: '/mock/repo',
  branch: BRANCH,
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 1,
});

const processAt = ({ pid, cwd, startedAt }: { pid: number; cwd: string; startedAt: number }) => ({
  pid,
  ppid: 1,
  pgid: pid,
  name: 'node',
  cwd,
  startedAt,
  birthId: `${startedAt}.000100`,
  cpuPercent: 1,
  rssBytes: 1024 * 1024,
  uid: 501,
  argsMasked: `node server-${pid}.js`,
});

const TWO_WORKSPACES: MonitorSnapshot = {
  listeners: [
    { port: 5005, address: '127.0.0.1', protocol: 'tcp', pid: 4100 },
    { port: 5006, address: '127.0.0.1', protocol: 'tcp', pid: 4200 },
  ],
  processes: [
    processAt({ pid: 4100, cwd: `${TREE_A}/src`, startedAt: TAKEN_AT - 1000 }),
    processAt({ pid: 4200, cwd: `${TREE_B}/src`, startedAt: TAKEN_AT - 2000 }),
  ],
  takenAt: TAKEN_AT,
  isPlatformSupported: true,
};

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({ currentWorkspaceId: WORKSPACE_A });
  vi.spyOn(document, 'hasFocus').mockImplementation(() => true);
  useAppStore.setState({
    monitorPinned: [
      { port: 5005, description: 'Ledger web' },
      { port: 9000, description: 'Mock API' },
    ],
  });
  stubStoryInvoke({
    monitor_snapshot: SNAPSHOT,
    process_ledger_list: [],
    monitor_watched_ports: [],
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const renderPage = () =>
  render(
    <ObjectMenuProvider>
      <MonitoringPage />
    </ObjectMenuProvider>,
  );

const hasPortRow = (port: number): boolean =>
  document.querySelector(`[data-port-row="${port}"]`) !== null;

const mountPage = async () => {
  const view = renderPage();
  await waitFor(() => expect(hasPortRow(5005)).toBe(true), { timeout: 4000 });
  return view;
};

describe('Monitoring keeps its state when you leave and come back', () => {
  it('keeps the search text', async () => {
    const first = await mountPage();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Filter ports' }), {
      target: { value: '5005' },
    });
    first.unmount();

    await mountPage();

    const field = screen.getByRole('searchbox', { name: 'Filter ports' });
    expect(field).toHaveProperty('value', '5005');
  });

  it('keeps a free ports fold open', async () => {
    const first = await mountPage();
    const pinned = screen.getByRole('region', { name: 'Pinned' });
    fireEvent.click(within(pinned).getByRole('button', { name: '1 free: :9000' }));
    expect(hasPortRow(9000)).toBe(true);
    first.unmount();

    await mountPage();

    expect(hasPortRow(9000)).toBe(true);
  });

  it('keeps an opened command line', async () => {
    const first = await mountPage();
    fireEvent.click(screen.getByRole('button', { name: 'Show command line' }));
    expect(screen.queryByText('node server.js')).not.toBeNull();
    first.unmount();

    await mountPage();

    expect(screen.queryByText('node server.js')).not.toBeNull();
  });
});

describe('Monitoring filtered by a branch of one workspace', () => {
  const openTarget = () => {
    useAppStore.setState({
      sessions: [
        sessionOf({ id: SESSION_A, workspaceId: WORKSPACE_A }),
        sessionOf({ id: SESSION_B, workspaceId: WORKSPACE_B }),
      ],
      sessionMounts: {},
      sessionProjectMounts: {
        [SESSION_A]: [
          projectMountOf({ sessionId: SESSION_A, projectId: PROJECT_A, worktreePath: TREE_A }),
        ],
        [SESSION_B]: [
          projectMountOf({ sessionId: SESSION_B, projectId: PROJECT_B, worktreePath: TREE_B }),
        ],
      },
      monitorPinned: [
        { port: 5005, description: 'Ledger web' },
        { port: 5006, description: 'Notify web' },
      ],
    });
    stubStoryInvoke({
      monitor_snapshot: TWO_WORKSPACES,
      process_ledger_list: [],
      monitor_watched_ports: [],
    });
    useAppStore.getState().openStudio({
      studio: {
        kind: 'monitoring',
        target: { workspaceId: WORKSPACE_A, projectId: PROJECT_A, branch: BRANCH },
      },
    });
  };

  it('shows the running ports right after load, from hydrated mounts only', async () => {
    openTarget();

    renderPage();

    await waitFor(() => expect(hasPortRow(5005)).toBe(true), { timeout: 4000 });
    expect(hasPortRow(5006)).toBe(false);
  });

  it('keeps each target at its own scroll position', async () => {
    openTarget();
    useAppStore.getState().amendStudio({ studio: { kind: 'monitoring', target: null } });
    renderPage();
    await waitFor(() => expect(hasPortRow(5005)).toBe(true), { timeout: 4000 });
    const viewport = screen.getByRole('region', { name: 'Pinned' }).parentElement;
    if (viewport === null) {
      throw new Error('The scroll viewport is missing.');
    }
    const scrollTo = (top: number) => {
      viewport.scrollTop = top;
      fireEvent.scroll(viewport);
    };

    scrollTo(800);
    act(() =>
      useAppStore.getState().amendStudio({
        studio: {
          kind: 'monitoring',
          target: { workspaceId: WORKSPACE_A, projectId: PROJECT_A, branch: BRANCH },
        },
      }),
    );
    scrollTo(100);
    act(() => useAppStore.getState().amendStudio({ studio: { kind: 'monitoring', target: null } }));

    await waitFor(() => expect(viewport.scrollTop).toBe(800));
    act(() => useAppStore.setState({ currentWorkspaceId: WORKSPACE_B }));
    scrollTo(30);
    act(() => useAppStore.setState({ currentWorkspaceId: WORKSPACE_A }));
    await waitFor(() => expect(viewport.scrollTop).toBe(800));
  });
});

describe('a fold belongs to one run of a process', () => {
  const withBirthId = (birthId: string | null): MonitorSnapshot => ({
    ...SNAPSHOT,
    processes: SNAPSHOT.processes.map((item) => ({ ...item, birthId })),
  });

  it('does not open for a new process that reuses the pid', async () => {
    const first = await mountPage();
    fireEvent.click(screen.getByRole('button', { name: 'Show command line' }));
    expect(screen.queryByText('node server.js')).not.toBeNull();
    first.unmount();

    const reused = withBirthId(`${TAKEN_AT - 500}.000100`);
    stubStoryInvoke({
      monitor_snapshot: reused,
      process_ledger_list: [],
      monitor_watched_ports: [],
    });
    act(() => useAppStore.setState({ monitorSnapshot: reused }));
    await mountPage();

    expect(screen.queryByText('node server.js')).toBeNull();
  });

  it('keeps the fold open across successive refreshes of the same live process', async () => {
    const first = await mountPage();
    fireEvent.click(screen.getByRole('button', { name: 'Show command line' }));
    first.unmount();
    const folds = () => useAppStore.getState().monitoringViews['w-harborline']?.openFolds ?? [];
    const before = folds();
    expect(before.some((key) => key.startsWith('proc:4100:'))).toBe(true);

    for (const step of [1, 2, 3]) {
      const live: MonitorSnapshot = {
        ...SNAPSHOT,
        takenAt: TAKEN_AT + step * 5000,
        processes: SNAPSHOT.processes.map((item) => ({
          ...item,
          cpuPercent: item.cpuPercent + step,
        })),
      };
      stubStoryInvoke({
        monitor_snapshot: live,
        process_ledger_list: [],
        monitor_watched_ports: [],
      });
      await useAppStore.getState().refreshMonitorSnapshot();
    }

    expect(folds()).toEqual(before);
    await mountPage();
    expect(screen.queryByText('node server.js')).not.toBeNull();
  });

  it('does not open for a pid reused within the same second', async () => {
    const first = await mountPage();
    fireEvent.click(screen.getByRole('button', { name: 'Show command line' }));
    first.unmount();
    const original = SNAPSHOT.processes[0]?.birthId ?? '';
    const reused: MonitorSnapshot = {
      ...SNAPSHOT,
      processes: SNAPSHOT.processes.map((item) => ({
        ...item,
        birthId: original.replace('.000100', '.900100'),
      })),
    };
    stubStoryInvoke({
      monitor_snapshot: reused,
      process_ledger_list: [],
      monitor_watched_ports: [],
    });
    act(() => useAppStore.setState({ monitorSnapshot: reused }));
    await mountPage();

    expect(screen.queryByText('node server.js')).toBeNull();
  });

  it('keeps the fold open across refreshes when the birth lookup failed', async () => {
    const unknown = withBirthId(null);
    stubStoryInvoke({
      monitor_snapshot: unknown,
      process_ledger_list: [],
      monitor_watched_ports: [],
    });
    act(() => useAppStore.setState({ monitorSnapshot: unknown }));
    const first = await mountPage();
    fireEvent.click(screen.getByRole('button', { name: 'Show command line' }));
    first.unmount();
    const folds = () => useAppStore.getState().monitoringViews['w-harborline']?.openFolds ?? [];
    const before = folds();
    expect(before.some((key) => key.startsWith('proc:4100:-:'))).toBe(true);

    for (const step of [1, 2]) {
      const live: MonitorSnapshot = {
        ...unknown,
        takenAt: TAKEN_AT + step * 5000,
        processes: unknown.processes.map((item) => ({ ...item, startedAt: item.startedAt + step })),
      };
      stubStoryInvoke({
        monitor_snapshot: live,
        process_ledger_list: [],
        monitor_watched_ports: [],
      });
      await useAppStore.getState().refreshMonitorSnapshot();
    }

    expect(folds()).toEqual(before);
    await mountPage();
    expect(screen.queryByText('node server.js')).not.toBeNull();
  });

  it('drops the fold when a full snapshot no longer has the process', async () => {
    const first = await mountPage();
    fireEvent.click(screen.getByRole('button', { name: 'Show command line' }));
    first.unmount();
    const folds = () => useAppStore.getState().monitoringViews['w-harborline']?.openFolds ?? [];
    expect(folds().some((key) => key.startsWith('proc:4100:'))).toBe(true);

    stubStoryInvoke({
      monitor_snapshot: { ...SNAPSHOT, processes: [], listeners: [], takenAt: TAKEN_AT + 1 },
      process_ledger_list: [],
      monitor_watched_ports: [],
    });
    await useAppStore.getState().refreshMonitorSnapshot();

    expect(folds().some((key) => key.startsWith('proc:'))).toBe(false);
  });
});

describe('Monitoring on a branch with leftovers, a search miss and shared processes', () => {
  const LEFTOVER_PGID = 4400;
  const OTHER_PGID = 4500;
  const NOTHING_RUNNING = 'Nothing running on this branch';

  type OrphanParams = {
    readonly pid: number;
    readonly pgid: number;
    readonly cwd: string;
  };

  const orphanOf = ({ pid, pgid, cwd }: OrphanParams) => ({
    ...processAt({ pid, cwd, startedAt: TAKEN_AT - 5000 }),
    pgid,
  });

  type LedgerParams = {
    readonly spawnId: string;
    readonly sessionId: SessionId;
    readonly pgid: number;
    readonly path: string;
  };

  const ledgerOf = ({ spawnId, sessionId, pgid, path }: LedgerParams) => ({
    spawnId,
    kind: 'turn' as const,
    pid: pgid,
    pgid,
    sessionId,
    mountPath: path,
    cwd: path,
    startedAt: TAKEN_AT - 9000,
  });

  type BranchParams = {
    readonly snapshot: MonitorSnapshot;
    readonly ledger: ReadonlyArray<ReturnType<typeof ledgerOf>>;
  };

  const openBranch = ({ snapshot, ledger }: BranchParams) => {
    useAppStore.setState({
      sessions: [
        sessionOf({ id: SESSION_A, workspaceId: WORKSPACE_A }),
        sessionOf({ id: SESSION_B, workspaceId: WORKSPACE_B }),
      ],
      sessionMounts: {},
      sessionProjectMounts: {
        [SESSION_A]: [
          projectMountOf({ sessionId: SESSION_A, projectId: PROJECT_A, worktreePath: TREE_A }),
        ],
        [SESSION_B]: [
          projectMountOf({ sessionId: SESSION_B, projectId: PROJECT_B, worktreePath: TREE_B }),
        ],
      },
      monitorPinned: [],
    });
    stubStoryInvoke({
      monitor_snapshot: snapshot,
      process_ledger_list: ledger,
      monitor_watched_ports: [],
    });
    useAppStore.getState().openStudio({
      studio: {
        kind: 'monitoring',
        target: { workspaceId: WORKSPACE_A, projectId: PROJECT_A, branch: BRANCH },
      },
    });
  };

  it('keeps the leftovers of this branch and drops the ones of another', async () => {
    openBranch({
      snapshot: {
        listeners: [],
        processes: [
          orphanOf({ pid: 4401, pgid: LEFTOVER_PGID, cwd: `${TREE_A}/src` }),
          orphanOf({ pid: 4501, pgid: OTHER_PGID, cwd: `${TREE_B}/src` }),
        ],
        takenAt: TAKEN_AT,
        isPlatformSupported: true,
      },
      ledger: [
        ledgerOf({ spawnId: 'spawn-a', sessionId: SESSION_A, pgid: LEFTOVER_PGID, path: TREE_A }),
        ledgerOf({ spawnId: 'spawn-b', sessionId: SESSION_B, pgid: OTHER_PGID, path: TREE_B }),
      ],
    });

    renderPage();

    await waitFor(() => expect(screen.queryByText('Stop leftovers')).not.toBeNull(), {
      timeout: 4000,
    });
    expect(screen.queryByText(NOTHING_RUNNING)).toBeNull();
    expect(document.querySelector('[data-leftover-row="spawn-a"]')).not.toBeNull();
    expect(document.querySelector('[data-leftover-row="spawn-b"]')).toBeNull();
  });

  it('says nothing runs when only another branch has leftovers', async () => {
    openBranch({
      snapshot: {
        listeners: [],
        processes: [orphanOf({ pid: 4501, pgid: OTHER_PGID, cwd: `${TREE_B}/src` })],
        takenAt: TAKEN_AT,
        isPlatformSupported: true,
      },
      ledger: [
        ledgerOf({ spawnId: 'spawn-b', sessionId: SESSION_B, pgid: OTHER_PGID, path: TREE_B }),
      ],
    });

    renderPage();

    await waitFor(() => expect(screen.queryByText(NOTHING_RUNNING)).not.toBeNull(), {
      timeout: 4000,
    });
    expect(screen.queryByText('Stop leftovers')).toBeNull();
  });

  it('does not report an empty branch when a saved search matches none of its ports', async () => {
    openBranch({ snapshot: TWO_WORKSPACES, ledger: [] });
    useAppStore.setState({ monitorPinned: [{ port: 5005, description: 'Ledger web' }] });
    useAppStore.getState().setMonitoringQuery({ workspaceId: WORKSPACE_A, query: '9999' });

    renderPage();

    await waitFor(() => expect(screen.queryByRole('searchbox')).not.toBeNull(), {
      timeout: 4000,
    });
    expect(screen.queryByText(NOTHING_RUNNING)).toBeNull();
  });

  it('hides the saved command line once the port becomes a nested row', async () => {
    useAppStore.setState({
      monitorPinned: [
        { port: 5005, description: 'Ledger web' },
        { port: 5006, description: 'Ledger admin' },
      ],
    });
    const single: MonitorSnapshot = {
      ...SNAPSHOT,
      processes: SNAPSHOT.processes.map((item) => ({ ...item, birthId: `${TAKEN_AT}.000100` })),
    };
    stubStoryInvoke({
      monitor_snapshot: single,
      process_ledger_list: [],
      monitor_watched_ports: [],
    });
    act(() => useAppStore.setState({ monitorSnapshot: single }));
    const first = await mountPage();
    fireEvent.click(screen.getByRole('button', { name: 'Show command line' }));
    expect(screen.queryByText('node server.js')).not.toBeNull();
    first.unmount();

    const shared: MonitorSnapshot = {
      ...single,
      listeners: [
        ...single.listeners,
        { port: 5006, address: '127.0.0.1', protocol: 'tcp', pid: 4100 },
      ],
    };
    stubStoryInvoke({
      monitor_snapshot: shared,
      process_ledger_list: [],
      monitor_watched_ports: [],
    });
    act(() => useAppStore.setState({ monitorSnapshot: shared }));
    renderPage();
    const toggle = await screen.findByRole('button', { name: /^Show 2 ports of node/ });
    fireEvent.click(toggle);

    expect(document.querySelectorAll('[data-port-row]').length).toBe(2);
    expect(screen.queryByText('node server.js')).toBeNull();
  });
});
