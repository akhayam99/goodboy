// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';

type Mount = {
  readonly mountId: string;
  readonly projectId: string;
  readonly mountName: string;
  readonly branch: string;
  readonly worktreePath: string;
};

type RunRecord = {
  readonly status: 'idle' | 'pending' | 'ok' | 'error' | 'cancelled';
  readonly result: { stdout: string; stderr: string; exitCode: number } | null;
  readonly runId: string;
  readonly startedAt: number;
  readonly mountId?: string;
};

type Drawer = {
  readonly kind: 'scriptRun';
  readonly sessionId: string;
  readonly payload: { readonly scriptKey: string; readonly mountId: string | null };
  readonly lens: string | null;
};

const SESSION = 'session-1';
const WORKSPACE = 'ws-1';
const SETTLEMENT_PATH = '/work/ledger-core-settlement';
const ROUNDING_PATH = '/work/ledger-core-rounding';
const RELAY_PATH = '/work/notify-relay';

const LEDGER = { id: 'project-ledger', workspaceId: WORKSPACE, name: 'ledger-core' };
const RELAY = { id: 'project-relay', workspaceId: WORKSPACE, name: 'notify-relay' };
const PAYMENTS = { id: 'project-payments', workspaceId: WORKSPACE, name: 'payments-api' };

const SETTLEMENT: Mount = {
  mountId: 'mount-settlement',
  projectId: LEDGER.id,
  mountName: 'ledger-core',
  branch: 'nw/settlement',
  worktreePath: SETTLEMENT_PATH,
};
const ROUNDING: Mount = {
  mountId: 'mount-rounding',
  projectId: LEDGER.id,
  mountName: 'ledger-core',
  branch: 'nw/fix-rounding',
  worktreePath: ROUNDING_PATH,
};
const RELAY_MOUNT: Mount = {
  mountId: 'mount-relay',
  projectId: RELAY.id,
  mountName: 'notify-relay',
  branch: 'nw/retry-backoff',
  worktreePath: RELAY_PATH,
};

const REPLAY = {
  id: 'script-replay',
  projectId: LEDGER.id,
  name: 'Replay settlement batch',
  body: 'set -euo pipefail\npnpm --filter ledger-core exec node ./tools/replay.mjs',
  sortOrder: 0,
};
const ROTATE = {
  id: 'script-rotate',
  projectId: PAYMENTS.id,
  name: 'Rotate signing keys',
  body: 'node ./tools/rotate.mjs',
  sortOrder: 1,
};

const manifestKey = ({ path, name }: { readonly path: string; readonly name: string }) =>
  JSON.stringify([path, 'package-json', '', name]);

const manifest = (
  scripts: ReadonlyArray<{
    readonly name: string;
    readonly command: string;
    readonly body?: string;
  }>,
) => [
  {
    source: 'package-json',
    packageName: 'ledger-core',
    relDir: '',
    manager: 'pnpm',
    scripts: scripts.map(({ name, command, body }) => ({ name, command, body: body ?? command })),
  },
];

const { state } = vi.hoisted(() => ({
  state: {
    mounts: [] as ReadonlyArray<Mount>,
    saved: [] as ReadonlyArray<Record<string, unknown>>,
    discovered: {} as Record<string, unknown>,
    runs: {} as Record<string, RunRecord>,
    drawer: null as Drawer | null,
    saveScript: vi.fn(async () => undefined),
    deleteScript: vi.fn(async () => undefined),
    cancelScript: vi.fn(async () => undefined),
    runScript: vi.fn(async () => ({ stdout: '', stderr: '', exitCode: 0 })),
    runDiscoveredScript: vi.fn(async () => ({ stdout: '', stderr: '', exitCode: 0 })),
    openDrawer: vi.fn(),
    toggleDrawer: vi.fn(),
  },
}));

vi.mock(
  '../../../session/components/SessionOverviewPane/ProjectMountRows/MountProjectAction',
  () => ({
    MountProjectAction: () => <button type="button">Add project</button>,
  }),
);

vi.mock('../../../../store', () => {
  const getStoreState = () => ({
    sessions: [{ id: SESSION, workspaceId: WORKSPACE, activeProjectId: LEDGER.id }],
    currentSessionId: SESSION,
    activeLens: { [SESSION]: 'scripts' },
    drawer: state.drawer,
    projects: [LEDGER, RELAY, PAYMENTS],
    projectScripts: { [WORKSPACE]: state.saved },
    sessionProjectMounts: { [SESSION]: state.mounts },
    sessionActiveProject: {},
    discoveredScripts: { [SESSION]: state.discovered },
    discoveredScriptScans: { [SESSION]: {} },
    scriptRuns: { [SESSION]: state.runs },
    scriptsLensScope: null,
    setScriptsLensScope: vi.fn(),
    loadScripts: vi.fn(async () => undefined),
    loadDiscoveredScripts: vi.fn(async () => undefined),
    refreshDiscoveredScripts: vi.fn(async () => undefined),
    saveScript: state.saveScript,
    deleteScript: state.deleteScript,
    cancelScript: state.cancelScript,
    runScript: state.runScript,
    runDiscoveredScript: state.runDiscoveredScript,
    openDrawer: state.openDrawer,
    toggleDrawer: state.toggleDrawer,
  });
  const useAppStore = <T,>(selector: (storeState: ReturnType<typeof getStoreState>) => T) =>
    selector(getStoreState());
  useAppStore.getState = getStoreState;
  return { EMPTY_ARRAY: [], useAppStore };
});

import { ScriptsPanel } from './index';

const renderPanel = () =>
  render(<ScriptsPanel workspaceId={WORKSPACE as never} sessionId={SESSION as never} />);

const group = (name: string) => screen.getByRole('region', { name });

beforeEach(() => {
  localStorage.clear();
  state.mounts = [SETTLEMENT, ROUNDING, RELAY_MOUNT];
  state.saved = [REPLAY];
  state.discovered = {
    [SETTLEMENT_PATH]: manifest([
      { name: 'lint', command: 'pnpm run lint', body: 'eslint .' },
      { name: 'test', command: 'pnpm run test', body: 'vitest run' },
    ]),
    [ROUNDING_PATH]: manifest([{ name: 'test', command: 'pnpm run test', body: 'vitest run' }]),
    [RELAY_PATH]: [],
  };
  state.runs = {};
  state.drawer = null;
  for (const fn of [
    state.saveScript,
    state.deleteScript,
    state.cancelScript,
    state.runScript,
    state.runDiscoveredScript,
    state.openDrawer,
    state.toggleDrawer,
  ]) {
    fn.mockClear();
  }
});

afterEach(cleanup);

describe('ScriptsPanel', () => {
  it('groups scripts by mount, saved first, with the source on each row', () => {
    renderPanel();

    expect(screen.getByRole('heading', { name: 'Scripts' })).toBeDefined();
    expect(screen.getByText('2 projects')).toBeDefined();
    const settlement = group('ledger-core · nw/settlement');
    const rounding = group('ledger-core · nw/fix-rounding');
    const names = within(settlement)
      .getAllByRole('button', { name: /^Show .* output$/ })
      .map((button) => button.getAttribute('aria-label'));
    expect(names).toEqual([
      'Show Replay settlement batch output',
      'Show test output',
      'Show lint output',
    ]);
    expect(within(settlement).getByText('Saved')).toBeDefined();
    expect(within(settlement).getAllByText('package.json')).toHaveLength(2);
    expect(within(rounding).getByText('Replay settlement batch')).toBeDefined();
  });

  it('splits a monorepo into its packages, root first, and runs each in its folder', () => {
    const dev = [{ name: 'dev', command: 'yarn run dev', body: 'vite --port 3000' }];
    state.discovered = {
      ...state.discovered,
      [SETTLEMENT_PATH]: [
        {
          source: 'package-json',
          packageName: 'northwind',
          relDir: '',
          manager: 'yarn',
          scripts: dev,
        },
        {
          source: 'package-json',
          packageName: '@northwind/web',
          relDir: 'apps/web',
          manager: 'yarn',
          scripts: dev,
        },
        {
          source: 'package-json',
          packageName: '@acme/api',
          relDir: 'apps/api',
          manager: 'yarn',
          scripts: dev,
        },
      ],
    };
    renderPanel();
    const settlement = group('ledger-core · nw/settlement');

    expect(
      within(settlement)
        .getAllByRole('region')
        .map((region) => region.getAttribute('aria-label')),
    ).toEqual([
      'Saved scripts',
      'northwind scripts',
      '@acme/api scripts',
      '@northwind/web scripts',
    ]);
    const web = within(settlement).getByRole('region', { name: '@northwind/web scripts' });
    expect(within(web).getByText('apps/web')).toBeDefined();

    fireEvent.click(within(web).getByRole('button', { name: 'Run dev' }));
    expect(state.runDiscoveredScript).toHaveBeenCalledWith(
      expect.objectContaining({
        scriptId: JSON.stringify([SETTLEMENT_PATH, 'package-json', 'apps/web', 'dev']),
        command: 'yarn run dev',
        cwd: `${SETTLEMENT_PATH}/apps/web`,
      }),
    );

    fireEvent.change(screen.getByRole('searchbox', { name: 'Filter scripts' }), {
      target: { value: '@acme' },
    });
    expect(
      within(group('ledger-core · nw/settlement'))
        .getAllByRole('region')
        .map((region) => region.getAttribute('aria-label')),
    ).toEqual(['@acme/api scripts']);
  });

  it('closes packages beyond six by default, keeps the root open, and the filter opens a match', () => {
    const dev = [{ name: 'dev', command: 'yarn run dev', body: 'vite' }];
    state.discovered = {
      ...state.discovered,
      [SETTLEMENT_PATH]: [
        {
          source: 'package-json',
          packageName: 'northwind',
          relDir: '',
          manager: 'yarn',
          scripts: dev,
        },
        ...Array.from({ length: 7 }, (_, index) => ({
          source: 'package-json' as const,
          packageName: `@northwind/p${index}`,
          relDir: `apps/p${index}`,
          manager: 'yarn',
          scripts: dev,
        })),
      ],
    };
    renderPanel();
    const settlement = group('ledger-core · nw/settlement');

    const root = within(settlement).getByRole('region', { name: 'northwind scripts' });
    expect(within(root).getByRole('button', { expanded: true })).toBeDefined();
    const p3 = within(settlement).getByRole('region', { name: '@northwind/p3 scripts' });
    expect(within(p3).getByRole('button', { expanded: false })).toBeDefined();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Filter scripts' }), {
      target: { value: 'p3' },
    });
    const filtered = within(group('ledger-core · nw/settlement')).getByRole('region', {
      name: '@northwind/p3 scripts',
    });
    expect(within(filtered).getByRole('button', { expanded: true })).toBeDefined();
  });

  it('says why a mount has no scripts and why a session has none', () => {
    renderPanel();

    expect(
      within(group('notify-relay · nw/retry-backoff')).getByText(
        'No package.json or composer.json in notify-relay.',
      ),
    ).toBeDefined();
    cleanup();

    state.mounts = [];
    renderPanel();
    expect(screen.getByText('Scripts run inside a project of this session.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Add project' })).toBeDefined();
  });

  it('names saved scripts of projects that are not in the session', () => {
    state.saved = [REPLAY, ROTATE];
    renderPanel();

    expect(screen.getByText(/1 saved script in payments-api, not in this session\./)).toBeDefined();
  });

  it('filters by name, command or project and says when nothing matches', () => {
    renderPanel();
    const filter = screen.getByRole('searchbox', { name: 'Filter scripts' });

    fireEvent.change(filter, { target: { value: 'eslint' } });
    expect(screen.getAllByRole('button', { name: /^Show .* output$/ })).toHaveLength(1);
    expect(screen.queryByRole('region', { name: 'notify-relay · nw/retry-backoff' })).toBeNull();

    fireEvent.change(filter, { target: { value: 'tset' } });
    expect(screen.getByText('No scripts match "tset".')).toBeDefined();
  });

  it('opens a row in the drawer and runs in the mount of its group', () => {
    renderPanel();
    const rounding = group('ledger-core · nw/fix-rounding');
    const testKey = manifestKey({ path: ROUNDING_PATH, name: 'test' });

    fireEvent.click(within(rounding).getByRole('button', { name: 'Show test output' }));
    expect(state.toggleDrawer).toHaveBeenCalledWith({
      kind: 'scriptRun',
      sessionId: SESSION,
      payload: { scriptKey: testKey, mountId: ROUNDING.mountId },
    });

    fireEvent.click(within(rounding).getByRole('button', { name: 'Run test' }));
    expect(state.openDrawer).toHaveBeenCalledWith({
      kind: 'scriptRun',
      sessionId: SESSION,
      payload: { scriptKey: testKey, mountId: ROUNDING.mountId },
    });
    expect(state.runDiscoveredScript).toHaveBeenCalledWith(
      expect.objectContaining({ scriptId: testKey, cwd: ROUNDING_PATH, mountId: ROUNDING.mountId }),
    );
  });

  it('shows a run only on the mount it ran in and marks the open row', () => {
    state.runs = {
      [REPLAY.id]: {
        status: 'pending',
        result: null,
        runId: 'run-1',
        startedAt: Date.now(),
        mountId: SETTLEMENT.mountId,
      },
    };
    state.drawer = {
      kind: 'scriptRun',
      sessionId: SESSION,
      payload: { scriptKey: REPLAY.id, mountId: SETTLEMENT.mountId },
      lens: 'scripts',
    };
    renderPanel();

    const settlement = group('ledger-core · nw/settlement');
    const rounding = group('ledger-core · nw/fix-rounding');
    expect(screen.getByText('2 projects · 1 running')).toBeDefined();
    expect(within(settlement).getByRole('button', { name: `Stop ${REPLAY.name}` })).toBeDefined();
    expect(within(rounding).getByRole('button', { name: `Run ${REPLAY.name}` })).toBeDefined();
    expect(settlement.querySelectorAll('[data-selected="true"]')).toHaveLength(1);
    expect(rounding.querySelectorAll('[data-selected="true"]')).toHaveLength(0);
  });

  it('creates a script inline at the top of the active mount', async () => {
    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'New script' }));
    const editor = within(group('ledger-core · nw/settlement')).getByRole('region', {
      name: 'New script',
    });
    fireEvent.change(within(editor).getByRole('textbox', { name: 'Script name' }), {
      target: { value: 'Seed sandbox ledger' },
    });
    fireEvent.change(within(editor).getByRole('textbox', { name: 'Script body' }), {
      target: { value: 'node ./tools/seed.mjs' },
    });
    await act(async () => {
      fireEvent.click(within(editor).getByRole('button', { name: 'Save' }));
    });

    expect(state.saveScript).toHaveBeenCalledWith({
      workspaceId: WORKSPACE,
      projectId: LEDGER.id,
      name: 'Seed sandbox ledger',
      body: 'node ./tools/seed.mjs',
    });
    expect(screen.queryByRole('region', { name: 'New script' })).toBeNull();
  });

  it('swaps a saved row for the same editor, and asks before deleting', async () => {
    renderPanel();
    const settlement = group('ledger-core · nw/settlement');

    fireEvent.click(within(settlement).getByRole('button', { name: `More for ${REPLAY.name}` }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
    const editor = within(settlement).getByRole('region', { name: `Edit ${REPLAY.name}` });
    expect(
      (within(editor).getByRole('textbox', { name: 'Script body' }) as HTMLTextAreaElement).value,
    ).toBe(REPLAY.body);
    fireEvent.click(within(editor).getByRole('button', { name: 'Cancel' }));

    fireEvent.click(within(settlement).getByRole('button', { name: `More for ${REPLAY.name}` }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(state.deleteScript).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(within(settlement).getByRole('button', { name: 'Delete' }));
    });

    expect(state.deleteScript).toHaveBeenCalledWith(REPLAY.id, WORKSPACE);
  });

  it('saves a package.json script as an editable one, prefilled with the invocation that runs from the root', () => {
    renderPanel();
    const settlement = group('ledger-core · nw/settlement');

    fireEvent.click(within(settlement).getByRole('button', { name: 'More for lint' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Save as script' }));

    const editor = within(settlement).getByRole('region', { name: 'New script' });
    expect(
      (within(editor).getByRole('textbox', { name: 'Script body' }) as HTMLTextAreaElement).value,
    ).toBe('pnpm run lint');
  });

  it('remembers a collapsed group for the workspace', () => {
    renderPanel();
    const header = within(group('notify-relay · nw/retry-backoff')).getByRole('button', {
      expanded: true,
    });

    fireEvent.click(header);
    cleanup();
    renderPanel();

    expect(
      within(group('notify-relay · nw/retry-backoff')).getByRole('button', { expanded: false }),
    ).toBeDefined();
    expect(screen.queryByText('No package.json or composer.json in notify-relay.')).toBeNull();
  });
});
