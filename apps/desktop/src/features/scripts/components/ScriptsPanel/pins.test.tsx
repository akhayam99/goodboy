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
import { autoChecksKey } from '../../autoChecksKey';
import { parseScriptPins } from '../../parseScriptPins';
import { scriptPinsKey } from '../../scriptPinsKey';
import { ProjectScriptsField } from '../ProjectScriptsField';
import { ObjectMenuProvider } from '../../../actions/components/ObjectMenuProvider';
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
      <ObjectMenuProvider>
        <ScriptsPanel workspaceId={HARBORLINE.id} sessionId={sessionId} onClose={vi.fn()} />
      </ObjectMenuProvider>
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
    monitor_watched_ports: [],
    monitor_snapshot: { listeners: [], processes: [], takenAt: 1, isPlatformSupported: true },
    process_ledger_list: [],
    workspace_script_list_live: [],
  });
});

afterEach(cleanup);

describe('script pins in the Scripts lens', () => {
  it('pins from the Suggested band, shows the script once, and keeps it in a session on another worktree', async () => {
    renderLens(FIRST.id);
    const suggested = await screen.findByRole('region', { name: /^Suggested of /u });
    expect(screen.queryByRole('region', { name: 'Pinned scripts' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Show test output' })).toBeNull();
    expect(within(suggested).getByText('dev')).toBeDefined();

    fireEvent.click(within(suggested).getByRole('button', { name: 'Pin test' }));

    await waitFor(async () => expect(await savedPins()).toHaveLength(1));
    expect((await savedPins())[0]).not.toContain('worktrees');
    expect(await screen.findAllByRole('button', { name: 'Show test output' })).toHaveLength(1);
    expect(screen.queryByRole('region', { name: 'Pinned scripts' })).toBeNull();
    expect(screen.queryByRole('region', { name: /^Suggested of /u })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Show dev output' })).toBeNull();
    cleanup();

    renderLens(SECOND.id);
    expect(await screen.findAllByRole('button', { name: 'Show test output' })).toHaveLength(1);
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Show test output' }));
    expect(await screen.findByRole('menuitem', { name: 'Unpin' })).toBeDefined();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Run test' }));

    await waitFor(() => expect(invokes('workspace_script_run_adhoc')).toHaveLength(1));
    expect(invokes('workspace_script_run_adhoc')[0]).toMatchObject({
      name: 'test',
      cwd: SECOND_WORKTREE,
    });
  });
});

describe('script pins in the project editor card', () => {
  it('reads the project folder when the card mounts and pins from there', async () => {
    render(<ProjectScriptsField project={LEDGER} />);

    await screen.findByText(/On main\. Pinned scripts show on a session's Scripts page/);
    expect(invokes('project_scripts_scan')).toEqual([{ worktreePath: LEDGER.rootPath }]);
    screen.getByText('Scripts');
    fireEvent.click(screen.getByRole('button', { name: 'Pin dev' }));
    await screen.findByText('Scripts · 1 pinned');
    await waitFor(async () => expect(await savedPins()).toHaveLength(1));
  });

  const savedChecks = async (): Promise<ReadonlyArray<string>> => {
    const rows = await rowsOf<{ readonly value: string }>({
      sql: 'SELECT value FROM settings WHERE key = ?',
      params: [autoChecksKey({ projectId: LEDGER.id })],
    });
    return parseScriptPins({ raw: rows[0]?.value });
  };

  it('ticks a script as an Auto check apart from its pin, and unticks it again', async () => {
    render(<ProjectScriptsField project={LEDGER} />);
    await screen.findByText(/On main\. Pinned scripts show on a session's Scripts page/);

    fireEvent.click(screen.getByRole('button', { name: 'Use test as an Auto check' }));
    await waitFor(async () => expect(await savedChecks()).toHaveLength(1));
    expect(await savedPins()).toEqual([]);
    const unticked = await screen.findByRole('button', {
      name: 'Stop using test as an Auto check',
    });
    expect(unticked.getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(unticked);
    await waitFor(async () => expect(await savedChecks()).toEqual([]));
    await screen.findByRole('button', { name: 'Use test as an Auto check' });
  });

  it('says plainly when a project has no package.json', async () => {
    render(<ProjectScriptsField project={RELAY} />);

    await screen.findByText('No package.json or composer.json in notify-relay.');
    screen.getByText('Scripts');
  });

  it('shows a failed scan as a notice and retries it', async () => {
    let attempts = 0;
    stubStoryInvoke({
      project_scripts_scan: () => {
        attempts += 1;
        if (attempts === 1) {
          throw new Error('permission denied');
        }
        return LEDGER_SCRIPTS;
      },
    });
    render(<ProjectScriptsField project={LEDGER} />);

    const notice = await screen.findByRole('alert');
    within(notice).getByText("Couldn't read the scripts");
    fireEvent.click(within(notice).getByRole('button', { name: 'Retry' }));

    await screen.findByRole('button', { name: 'Pin dev' });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(invokes('project_scripts_scan')).toHaveLength(2);
  });
});
