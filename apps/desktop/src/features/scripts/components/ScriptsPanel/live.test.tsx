// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).sqliteDbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { insertProject, insertWorkspace } from '@goodboy/db';
import type { MonitorSnapshot } from '@goodboy/core';
import type {
  MountId,
  Project,
  SessionId,
  SessionMountView,
  SessionProjectMount,
  Workspace,
} from '@goodboy/types';
import { TEST_NOW, aProject, aSession, aWorkspace } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  openStorySqlite,
  resetStoryStore,
  storySpies,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import { ToastProvider } from '../../../../shared/components/Toast';
import { scriptPinId } from '../../scriptPinId';
import { scriptPinsKey } from '../../scriptPinsKey';
import { discoveredScriptId, type ScriptRunRecord } from '../../scripts';
import { ScriptsPanel } from './index';

type MountIdParams = {
  readonly value: string;
};

const isMountId = (value: string): value is MountId => value.startsWith('mount-');

const mountIdOf = ({ value }: MountIdParams): MountId => {
  if (!isMountId(value)) {
    throw new Error(`Not a mount id: ${value}`);
  }
  return value;
};

let useAppStore: StoryStore;

const HARBORLINE: Workspace = aWorkspace({ name: 'Harborline', slug: 'harborline' });
const PAYMENTS: Project = aProject({
  workspaceId: HARBORLINE.id,
  name: 'payments-api',
  rootPath: '/repos/payments-api',
  kind: 'repo',
  baseBranch: 'main',
});

const FIRST = aSession({ workspaceId: HARBORLINE.id, goal: 'Round the ledger' });
const SECOND = aSession({ workspaceId: HARBORLINE.id, goal: 'Close the batch' });

const FIRST_WORKTREE = '/repos/payments-api/.goodboy/worktrees/hl-212';
const SECOND_WORKTREE = '/repos/payments-api/.goodboy/worktrees/hl-240';
const NOW = Date.parse('2026-10-11T09:00:00.000Z');

const mountOf = ({
  sessionId,
  worktreePath,
  branch,
}: {
  readonly sessionId: SessionId;
  readonly worktreePath: string;
  readonly branch: string;
}): SessionProjectMount => ({
  mountId: mountIdOf({ value: `mount-${sessionId}` }),
  sessionId,
  projectId: PAYMENTS.id,
  mountName: PAYMENTS.name,
  worktreePath,
  lastWorktreePath: null,
  repoRoot: PAYMENTS.rootPath,
  branch,
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 1,
});

const viewOf = ({ mount }: { readonly mount: SessionProjectMount }): SessionMountView => ({
  ...mount,
  id: mount.mountId,
  repoSlug: null,
  createdAt: TEST_NOW,
  updatedAt: TEST_NOW,
});

const SCRIPTS = [
  {
    source: 'package-json',
    packageName: 'payments-api',
    relDir: '',
    manager: 'pnpm',
    scripts: [
      { name: 'dev', command: 'pnpm run dev', body: 'vite --port 5005' },
      { name: 'test', command: 'pnpm run test', body: 'vitest run' },
    ],
  },
];

const processOf = ({
  pid,
  ppid,
  cwd,
  cpuPercent,
  rssBytes,
}: {
  readonly pid: number;
  readonly ppid: number;
  readonly cwd: string;
  readonly cpuPercent: number;
  readonly rssBytes: number;
}) => ({
  pid,
  ppid,
  pgid: ppid === 1 ? pid : ppid,
  name: 'node',
  cwd,
  startedAt: NOW - 72_000,
  cpuPercent,
  rssBytes,
  uid: 501,
  argsMasked: 'node',
});

const RUNNING_SNAPSHOT: MonitorSnapshot = {
  listeners: [{ port: 5005, address: '127.0.0.1', protocol: 'tcp', pid: 4243 }],
  processes: [
    processOf({ pid: 4242, ppid: 1, cwd: FIRST_WORKTREE, cpuPercent: 10, rssBytes: 100 * 1048576 }),
    processOf({
      pid: 4243,
      ppid: 4242,
      cwd: FIRST_WORKTREE,
      cpuPercent: 5,
      rssBytes: 50 * 1048576,
    }),
  ],
  takenAt: NOW,
  isPlatformSupported: true,
};

const HELD_SNAPSHOT: MonitorSnapshot = {
  listeners: [{ port: 5005, address: '127.0.0.1', protocol: 'tcp', pid: 9000 }],
  processes: [
    processOf({ pid: 9000, ppid: 1, cwd: SECOND_WORKTREE, cpuPercent: 1, rssBytes: 1048576 }),
  ],
  takenAt: NOW,
  isPlatformSupported: true,
};

const DEV_KEY = discoveredScriptId({
  worktreePath: FIRST_WORKTREE,
  source: 'package-json',
  relDir: '',
  name: 'dev',
});

const RUNNING_DEV: ScriptRunRecord = {
  status: 'pending',
  result: null,
  runId: 'run-dev',
  startedAt: NOW - 72_000,
  mountId: mountIdOf({ value: `mount-${FIRST.id}` }),
  output: 'vite ready in 312 ms\nlistening on 5005\n',
};

const invokes = (command: string): ReadonlyArray<unknown> =>
  storySpies.tauriInvoke.mock.calls
    .filter(([name]) => String(name) === command)
    .map(([, args]) => args);

const stubMonitor = ({ snapshot }: { readonly snapshot: MonitorSnapshot }) =>
  stubStoryInvoke({
    project_scripts_scan: SCRIPTS,
    workspace_script_run_adhoc: 'run-next',
    workspace_script_cancel: null,
    monitor_watched_ports: [{ port: 5005, label: 'dev', source: 'script', relDir: '' }],
    monitor_snapshot: snapshot,
    process_ledger_list: [],
    workspace_script_list_live: [
      {
        runId: 'run-dev',
        scriptId: DEV_KEY,
        name: 'dev',
        sessionId: FIRST.id,
        pid: 4242,
        startedAt: NOW - 72_000,
      },
    ],
  });

const renderLens = () =>
  render(
    <ToastProvider>
      <ScriptsPanel workspaceId={HARBORLINE.id} sessionId={FIRST.id} />
    </ToastProvider>,
  );

const press = ({ code }: { readonly code: string }) =>
  fireEvent.keyDown(window, { code, key: code.replace('Key', '').toLowerCase() });

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  const db = await openStorySqlite();
  await insertWorkspace({ db, workspace: HARBORLINE });
  await insertProject({ db, project: PAYMENTS });
  const firstMount = mountOf({
    sessionId: FIRST.id,
    worktreePath: FIRST_WORKTREE,
    branch: 'hl/ledger-rounding',
  });
  const secondMount = mountOf({
    sessionId: SECOND.id,
    worktreePath: SECOND_WORKTREE,
    branch: 'hl/ledger-rounding',
  });
  useAppStore.setState({
    workspaces: [HARBORLINE],
    currentWorkspaceId: HARBORLINE.id,
    projects: [PAYMENTS],
    sessions: [FIRST, SECOND],
    currentSessionId: FIRST.id,
    sessionProjectMounts: { [FIRST.id]: [firstMount], [SECOND.id]: [secondMount] },
    sessionMounts: {
      [FIRST.id]: [viewOf({ mount: firstMount })],
      [SECOND.id]: [viewOf({ mount: secondMount })],
    },
  });
  await useAppStore
    .getState()
    .saveSetting(
      scriptPinsKey({ projectId: PAYMENTS.id }),
      JSON.stringify(
        ['dev', 'test'].map((name) =>
          scriptPinId({ source: 'package-json', relDir: '', name, savedId: null }),
        ),
      ),
    );
});

afterEach(cleanup);

describe('Scripts page live state', () => {
  it('shows the last line, uptime and the port link of a running service', async () => {
    stubMonitor({ snapshot: RUNNING_SNAPSHOT });
    useAppStore.setState({
      scriptRuns: { [FIRST.id]: { [DEV_KEY]: { ...RUNNING_DEV, startedAt: Date.now() - 72_000 } } },
    });
    renderLens();

    const services = await screen.findByRole('region', { name: 'Services' });
    expect(within(services).getByText('listening on 5005')).toBeDefined();
    expect(within(services).getByText(/^1m \d+s$/)).toBeDefined();
    const link = await within(services).findByRole('button', { name: 'Open localhost:5005' });
    expect(link).toBeDefined();
    expect(await within(services).findByText('15%')).toBeDefined();
    expect(within(services).getByText('150 MB')).toBeDefined();
    expect(within(services).getByRole('button', { name: 'Stop dev' })).toBeDefined();
    expect(within(services).getByRole('button', { name: 'Restart dev' })).toBeDefined();
  });

  it('warns that the expected port is in use by another worktree and keeps Run enabled', async () => {
    stubMonitor({ snapshot: HELD_SNAPSHOT });
    useAppStore.setState({ monitorSnapshot: HELD_SNAPSHOT });
    renderLens();

    const services = await screen.findByRole('region', { name: 'Services' });
    expect(await within(services).findByText(':5005 in use')).toBeDefined();
    expect(within(services).getByRole('button', { name: 'Run dev' }).hasAttribute('disabled')).toBe(
      false,
    );
  });

  it('shows an expected port without a warning when nothing holds it', async () => {
    stubMonitor({ snapshot: { ...HELD_SNAPSHOT, listeners: [], processes: [] } });
    renderLens();

    const services = await screen.findByRole('region', { name: 'Services' });
    expect(await within(services).findByText(':5005')).toBeDefined();
    expect(within(services).queryByText(':5005 in use')).toBeNull();
  });

  it('moves with J and K, restarts a running service with R and stops it with X', async () => {
    stubMonitor({ snapshot: RUNNING_SNAPSHOT });
    useAppStore.setState({
      scriptRuns: { [FIRST.id]: { [DEV_KEY]: { ...RUNNING_DEV, startedAt: Date.now() } } },
    });
    renderLens();
    await screen.findByRole('region', { name: 'Services' });

    press({ code: 'KeyJ' });
    const devRow = screen.getByRole('button', { name: 'Show dev output' });
    await waitFor(() => expect(devRow.closest('[data-selected="true"]')).not.toBeNull());

    press({ code: 'KeyJ' });
    const testRow = screen.getByRole('button', { name: 'Show test output' });
    await waitFor(() => expect(testRow.closest('[data-selected="true"]')).not.toBeNull());
    press({ code: 'KeyK' });
    await waitFor(() => expect(devRow.closest('[data-selected="true"]')).not.toBeNull());

    press({ code: 'KeyR' });
    await waitFor(() => expect(invokes('workspace_script_cancel')).toEqual([{ runId: 'run-dev' }]));
    await waitFor(() => expect(invokes('workspace_script_run_adhoc')).toHaveLength(1));
  });

  it('stops the selected running service with X and ignores X on an idle one', async () => {
    stubMonitor({ snapshot: RUNNING_SNAPSHOT });
    useAppStore.setState({
      scriptRuns: { [FIRST.id]: { [DEV_KEY]: { ...RUNNING_DEV, startedAt: Date.now() } } },
    });
    renderLens();
    await screen.findByRole('region', { name: 'Services' });

    press({ code: 'KeyJ' });
    press({ code: 'KeyX' });
    await waitFor(() => expect(invokes('workspace_script_cancel')).toEqual([{ runId: 'run-dev' }]));
    expect(invokes('workspace_script_run_adhoc')).toHaveLength(0);

    press({ code: 'KeyJ' });
    press({ code: 'KeyX' });
    expect(invokes('workspace_script_cancel')).toHaveLength(1);
  });

  it('opens the output drawer of the selected row with Enter', async () => {
    stubMonitor({ snapshot: HELD_SNAPSHOT });
    renderLens();
    await screen.findByRole('region', { name: 'Services' });

    press({ code: 'KeyJ' });
    fireEvent.keyDown(window, { code: 'Enter', key: 'Enter' });

    await waitFor(() =>
      expect(useAppStore.getState().drawer).toMatchObject({
        kind: 'scriptRun',
        sessionId: FIRST.id,
      }),
    );
  });

  it('runs an idle selected row with R', async () => {
    stubMonitor({ snapshot: HELD_SNAPSHOT });
    renderLens();
    await screen.findByRole('region', { name: 'Tasks' });

    press({ code: 'KeyJ' });
    press({ code: 'KeyJ' });
    press({ code: 'KeyR' });

    await waitFor(() => expect(invokes('workspace_script_run_adhoc')).toHaveLength(1));
    expect(invokes('workspace_script_run_adhoc')[0]).toMatchObject({
      name: 'test',
      cwd: FIRST_WORKTREE,
    });
  });
});
