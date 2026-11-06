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
import { listen } from '@tauri-apps/api/event';
import { insertProject, insertWorkspace } from '@goodboy/db';
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
import { discoveredScriptId } from '../../scripts';
import { startRunnableScript } from '../../startRunnableScript';
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

const FIRST_WORKTREE = '/repos/payments-api/.goodboy/worktrees/hl-212';

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

const TEST_KEY = discoveredScriptId({
  worktreePath: FIRST_WORKTREE,
  source: 'package-json',
  relDir: '',
  name: 'test',
});

const invokes = (command: string): ReadonlyArray<unknown> =>
  storySpies.tauriInvoke.mock.calls
    .filter(([name]) => String(name) === command)
    .map(([, args]) => args);

const emitExit = ({ runId, exitCode }: { readonly runId: string; readonly exitCode: number }) => {
  const handlers = vi
    .mocked(listen)
    .mock.calls.filter(([event]) => event === 'script-exit')
    .map(([, handler]) => handler);
  for (const handler of handlers) {
    handler({ event: 'script-exit', id: 0, payload: { runId, exitCode } });
  }
};

const renderLens = () =>
  render(
    <ToastProvider>
      <ScriptsPanel workspaceId={HARBORLINE.id} sessionId={FIRST.id} onClose={vi.fn()} />
    </ToastProvider>,
  );

const press = ({ code }: { readonly code: string }) =>
  fireEvent.keyDown(window, { code, key: code.replace('Key', '').toLowerCase() });

const suggestedBand = async () => screen.findByRole('region', { name: /^Suggested of /u });

const runOf = () => useAppStore.getState().scriptRuns[FIRST.id]?.[TEST_KEY];

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
  useAppStore.setState({
    workspaces: [HARBORLINE],
    currentWorkspaceId: HARBORLINE.id,
    projects: [PAYMENTS],
    sessions: [FIRST],
    currentSessionId: FIRST.id,
    sessionProjectMounts: { [FIRST.id]: [firstMount] },
    sessionMounts: { [FIRST.id]: [viewOf({ mount: firstMount })] },
  });
  stubStoryInvoke({
    project_scripts_scan: SCRIPTS,
    workspace_script_run_adhoc: 'run-next',
    workspace_script_cancel: null,
    workspace_script_snapshot: { data: '', offset: 0, exitCode: null },
    monitor_watched_ports: [],
    monitor_snapshot: {
      listeners: [],
      processes: [],
      takenAt: TEST_NOW,
      isPlatformSupported: true,
    },
    process_ledger_list: [],
    workspace_script_list_live: [],
  });
});

afterEach(cleanup);

describe('Suggested scripts through the real store', () => {
  it('runs a suggested script from Run to completion and brings Run back with its mark', async () => {
    renderLens();
    const band = await suggestedBand();

    fireEvent.click(within(band).getByRole('button', { name: 'Run test' }));
    await waitFor(() => expect(invokes('workspace_script_run_adhoc')).toHaveLength(1));
    const first = runOf();
    expect(first?.status).toBe('pending');
    await within(band).findByRole('button', { name: 'Stop test' });
    expect(within(band).queryByRole('button', { name: 'Run test' })).toBeNull();

    emitExit({ runId: first?.runId ?? '', exitCode: 0 });

    await within(band).findByRole('button', { name: 'Run test' });
    expect(runOf()?.status).toBe('ok');
    expect(within(band).queryByRole('button', { name: 'Stop test' })).toBeNull();
  });

  it('refuses a second start while the first run is pending and keeps one tracked run', async () => {
    renderLens();
    await suggestedBand();
    const mount = useAppStore.getState().sessionProjectMounts[FIRST.id]?.[0];
    const script = {
      key: TEST_KEY,
      kind: 'manifest' as const,
      name: 'test',
      body: 'vitest run',
      invocation: 'pnpm run test',
      manager: 'pnpm',
      source: 'package-json' as const,
      packageName: 'payments-api',
      relDir: '',
      category: 'other' as const,
      savedId: null,
    };
    const params = {
      sessionId: FIRST.id,
      script,
      mountId: mount?.mountId ?? mountIdOf({ value: 'mount-missing' }),
      worktreePath: FIRST_WORKTREE,
    };

    const first = startRunnableScript(params);
    const firstRunId = runOf()?.runId;
    const second = await startRunnableScript(params);

    expect(second.exitCode).toBe(-1);
    expect(runOf()?.runId).toBe(firstRunId);
    await waitFor(() => expect(invokes('workspace_script_run_adhoc')).toHaveLength(1));

    emitExit({ runId: firstRunId ?? '', exitCode: 0 });
    expect((await first).exitCode).toBe(0);
    expect(runOf()?.status).toBe('ok');
  });

  it('moves over suggested rows with J and K, runs with R and stops with X', async () => {
    renderLens();
    const band = await suggestedBand();

    press({ code: 'KeyJ' });
    const devRow = within(band).getByRole('button', { name: 'Run dev' });
    await waitFor(() => expect(devRow.closest('[data-selected="true"]')).not.toBeNull());
    press({ code: 'KeyJ' });
    const testRow = within(band).getByRole('button', { name: 'Run test' });
    await waitFor(() => expect(testRow.closest('[data-selected="true"]')).not.toBeNull());

    press({ code: 'KeyR' });
    await waitFor(() => expect(invokes('workspace_script_run_adhoc')).toHaveLength(1));
    expect(invokes('workspace_script_run_adhoc')[0]).toMatchObject({ name: 'test' });
    await within(band).findByRole('button', { name: 'Stop test' });

    press({ code: 'KeyX' });
    await waitFor(() => expect(invokes('workspace_script_cancel')).toHaveLength(1));
    expect(runOf()?.status).toBe('cancelled');
  });
});
