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
import type { MountId, Project, SessionId, SessionProjectMount, Workspace } from '@goodboy/types';
import { aProject, aSession, aWorkspace } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  openStorySqlite,
  resetStoryStore,
  rowsOf,
  storySpies,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import { ToastProvider } from '../../../../shared/components/Toast';
import { scriptPinsKey } from '../../scriptPinsKey';
import { ProjectScriptsFold } from '../ProjectScriptsFold';
import { ScriptsPanel } from './index';

let useAppStore: StoryStore;

const HARBORLINE: Workspace = aWorkspace({ name: 'Harborline', slug: 'harborline' });
const LEDGER: Project = aProject({
  workspaceId: HARBORLINE.id,
  name: 'ledger-core',
  rootPath: '/repos/ledger-core',
  kind: 'repo',
  baseBranch: 'main',
});
const RELAY: Project = aProject({
  workspaceId: HARBORLINE.id,
  name: 'notify-relay',
  rootPath: '/repos/notify-relay',
  kind: 'repo',
});

const FIRST = aSession({ workspaceId: HARBORLINE.id, goal: 'Round the ledger' });
const SECOND = aSession({ workspaceId: HARBORLINE.id, goal: 'Close the batch' });

const mountOf = ({
  sessionId,
  worktreePath,
}: {
  readonly sessionId: SessionId;
  readonly worktreePath: string;
}): SessionProjectMount => ({
  mountId: `mount-${sessionId}` as MountId,
  sessionId,
  projectId: LEDGER.id,
  mountName: LEDGER.name,
  worktreePath,
  lastWorktreePath: null,
  repoRoot: LEDGER.rootPath,
  branch: 'goodboy/har-212',
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 1,
});

const FIRST_WORKTREE = '/repos/ledger-core/.goodboy/worktrees/har-212';
const SECOND_WORKTREE = '/repos/ledger-core/.goodboy/worktrees/har-240';

const LEDGER_SCRIPTS = [
  {
    source: 'package-json',
    packageName: 'ledger-core',
    relDir: '',
    manager: 'pnpm',
    scripts: [
      { name: 'dev', command: 'pnpm run dev', body: 'vite --port 4310' },
      { name: 'test', command: 'pnpm run test', body: 'vitest run' },
    ],
  },
];

const invokes = (command: string): ReadonlyArray<unknown> =>
  storySpies.tauriInvoke.mock.calls
    .filter(([name]) => String(name) === command)
    .map(([, args]) => args);

const savedPins = async (): Promise<ReadonlyArray<string>> => {
  const rows = await rowsOf<{ readonly value: string }>({
    sql: 'SELECT value FROM settings WHERE key = ?',
    params: [scriptPinsKey({ projectId: LEDGER.id })],
  });
  return rows[0] === undefined ? [] : (JSON.parse(rows[0].value) as ReadonlyArray<string>);
};

const renderLens = (sessionId: SessionId) =>
  render(
    <ToastProvider>
      <ScriptsPanel workspaceId={HARBORLINE.id} sessionId={sessionId} />
    </ToastProvider>,
  );

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  const db = await openStorySqlite();
  await insertWorkspace({ db, workspace: HARBORLINE });
  await insertProject({ db, project: LEDGER });
  await insertProject({ db, project: RELAY });
  useAppStore.setState({
    workspaces: [HARBORLINE],
    currentWorkspaceId: HARBORLINE.id,
    projects: [LEDGER, RELAY],
    sessions: [FIRST, SECOND],
    sessionProjectMounts: {
      [FIRST.id]: [mountOf({ sessionId: FIRST.id, worktreePath: FIRST_WORKTREE })],
      [SECOND.id]: [mountOf({ sessionId: SECOND.id, worktreePath: SECOND_WORKTREE })],
    },
  });
  stubStoryInvoke({
    project_scripts_scan: ({ worktreePath }: { readonly worktreePath: string }) =>
      worktreePath === RELAY.rootPath ? [] : LEDGER_SCRIPTS,
    workspace_script_run_adhoc: 'run-1',
  });
});

afterEach(cleanup);

describe('script pins in the Scripts lens', () => {
  it('lists only what is pinned on the Projects page, and keeps it in a session on another worktree', async () => {
    renderLens(FIRST.id);
    const strip = screen.getByRole('region', { name: 'Pinned scripts' });
    within(strip).getByText(/Pin scripts in Settings, under Projects/);
    await screen.findByText('No pinned scripts');
    expect(screen.queryByRole('button', { name: 'Pin test' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Show test output' })).toBeNull();
    cleanup();

    render(<ProjectScriptsFold project={LEDGER} />);
    fireEvent.click(screen.getByRole('button', { name: 'Scripts of ledger-core' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Pin test' }));
    await waitFor(async () => expect(await savedPins()).toHaveLength(1));
    expect((await savedPins())[0]).not.toContain('worktrees');
    cleanup();

    renderLens(FIRST.id);
    const firstStrip = screen.getByRole('region', { name: 'Pinned scripts' });
    await within(firstStrip).findByRole('button', { name: 'Run test in ledger-core' });
    expect(screen.getByRole('button', { name: 'Unpin test' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(screen.queryByRole('button', { name: 'Show dev output' })).toBeNull();
    cleanup();

    renderLens(SECOND.id);
    const secondStrip = screen.getByRole('region', { name: 'Pinned scripts' });
    fireEvent.click(
      await within(secondStrip).findByRole('button', { name: 'Run test in ledger-core' }),
    );

    await waitFor(() => expect(invokes('workspace_script_run_adhoc')).toHaveLength(1));
    expect(invokes('workspace_script_run_adhoc')[0]).toMatchObject({
      name: 'test',
      cwd: SECOND_WORKTREE,
    });
  });
});

describe('script pins on the Projects page', () => {
  it('reads the project folder only when the row opens and pins from there', async () => {
    render(<ProjectScriptsFold project={LEDGER} />);
    const toggle = screen.getByRole('button', { name: 'Scripts of ledger-core' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(invokes('project_scripts_scan')).toEqual([]);

    fireEvent.click(toggle);

    await screen.findByText(/Scripts on main/);
    expect(invokes('project_scripts_scan')).toEqual([{ worktreePath: LEDGER.rootPath }]);
    fireEvent.click(screen.getByRole('button', { name: 'Pin dev' }));
    await screen.findByText('· 2, 1 pinned');
    await waitFor(async () => expect(await savedPins()).toHaveLength(1));
  });

  it('says plainly when a project has no package.json', async () => {
    render(<ProjectScriptsFold project={RELAY} />);

    fireEvent.click(screen.getByRole('button', { name: 'Scripts of notify-relay' }));

    await screen.findByText('No package.json or composer.json in notify-relay.');
    screen.getByText('· none found');
  });
});
