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

const pinIdOf = ({ relDir, name }: { readonly relDir: string; readonly name: string }) =>
  JSON.stringify(['package-json', relDir, name]);

const { state } = vi.hoisted(() => ({
  state: {
    mounts: [] as ReadonlyArray<Mount>,
    saved: [] as ReadonlyArray<Record<string, unknown>>,
    discovered: {} as Record<string, unknown>,
    scans: {} as Record<string, { readonly status: string; readonly error: string | null }>,
    refreshDiscoveredScripts: vi.fn(async () => undefined),
    runs: {} as Record<string, RunRecord>,
    drawer: null as Drawer | null,
    pins: null as Record<string, ReadonlyArray<string>> | null,
    saveScript: vi.fn(async () => undefined),
    deleteScript: vi.fn(async () => undefined),
    cancelScript: vi.fn(async () => undefined),
    runScript: vi.fn(async () => ({ stdout: '', stderr: '', exitCode: 0 })),
    runDiscoveredScript: vi.fn(async () => ({ stdout: '', stderr: '', exitCode: 0 })),
    openDrawer: vi.fn(),
    toggleDrawer: vi.fn(),
    toggleScriptPin: vi.fn(async () => undefined),
  },
}));

vi.mock(
  '../../../session/components/SessionOverviewPane/ProjectMountRows/MountProjectAction',
  () => ({
    MountProjectAction: () => <button type="button">Add project</button>,
  }),
);

vi.mock('../../../../store', () => {
  const settingsOf = () => {
    const byProject: Record<string, Array<string>> = {};
    for (const mount of state.mounts) {
      const groups = (state.discovered[mount.worktreePath] ?? []) as ReadonlyArray<{
        readonly source: string;
        readonly relDir: string;
        readonly scripts: ReadonlyArray<{ readonly name: string }>;
      }>;
      const all = groups.flatMap((entry) =>
        entry.scripts.map((script) => JSON.stringify([entry.source, entry.relDir, script.name])),
      );
      byProject[mount.projectId] = [
        ...(byProject[mount.projectId] ?? []),
        ...(state.pins === null ? all : (state.pins[mount.projectId] ?? [])),
      ];
    }
    return Object.fromEntries(
      Object.entries(byProject).map(([projectId, ids]) => [
        `scripts.pinned.${projectId}`,
        JSON.stringify(ids),
      ]),
    );
  };
  const noPins = async () => undefined;
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
    discoveredScriptScans: { [SESSION]: state.scans },
    scriptRuns: { [SESSION]: state.runs },
    scriptsLensScope: null,
    setScriptsLensScope: vi.fn(),
    loadScripts: vi.fn(async () => undefined),
    loadDiscoveredScripts: vi.fn(async () => undefined),
    refreshDiscoveredScripts: state.refreshDiscoveredScripts,
    saveScript: state.saveScript,
    deleteScript: state.deleteScript,
    cancelScript: state.cancelScript,
    runScript: state.runScript,
    runDiscoveredScript: state.runDiscoveredScript,
    openDrawer: state.openDrawer,
    toggleDrawer: state.toggleDrawer,
    settings: settingsOf(),
    loadScriptPins: noPins,
    toggleScriptPin: state.toggleScriptPin,
    reportError: noPins,
  });
  const useAppStore = <T,>(selector: (storeState: ReturnType<typeof getStoreState>) => T) =>
    selector(getStoreState());
  useAppStore.getState = getStoreState;
  useAppStore.subscribe = () => () => undefined;
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
  state.scans = {};
  state.refreshDiscoveredScripts.mockClear();
  state.drawer = null;
  state.pins = null;
  for (const fn of [
    state.saveScript,
    state.deleteScript,
    state.cancelScript,
    state.runScript,
    state.runDiscoveredScript,
    state.openDrawer,
    state.toggleDrawer,
    state.toggleScriptPin,
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

  it('gives each project one refresh and one overflow per row', () => {
    renderPanel();

    for (const name of ['ledger-core · nw/settlement', 'notify-relay · nw/retry-backoff']) {
      expect(within(group(name)).getAllByRole('button', { name: /scripts again$/ })).toHaveLength(
        1,
      );
    }
    const settlement = group('ledger-core · nw/settlement');
    expect(within(settlement).getAllByRole('button', { name: /^More for / })).toHaveLength(3);
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

  it('copies the workspace-scoped invocation for a nested package, not the package-local one', () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
      configurable: true,
    });
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
      ],
    };
    renderPanel();
    const settlement = group('ledger-core · nw/settlement');
    const web = within(settlement).getByRole('region', { name: '@northwind/web scripts' });

    fireEvent.click(within(web).getByRole('button', { name: 'More for dev' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Copy command' }));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'yarn workspace @northwind/web run dev',
    );
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

    const relay = group('notify-relay · nw/retry-backoff');
    expect(within(relay).getByText('No scripts in notify-relay')).toBeDefined();
    expect(within(relay).queryByText('0')).toBeNull();
    expect(within(relay).queryByRole('button', { name: /Pin a script/ })).toBeNull();
    expect(within(relay).getByRole('button', { name: 'New script in notify-relay' })).toBeDefined();
    cleanup();

    state.mounts = [];
    renderPanel();
    expect(screen.getByRole('heading', { level: 2, name: 'No scripts yet' })).toBeDefined();
    expect(screen.getByText('Scripts run inside a project of this session.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Add project' })).toBeDefined();
  });

  it('says a project could not be read, with the reason and a Retry', () => {
    state.discovered = { ...state.discovered, [RELAY_PATH]: undefined };
    state.scans = {
      [RELAY_PATH]: { status: 'error', error: 'package.json has a trailing comma.' },
    };
    renderPanel();

    const relay = group('notify-relay · nw/retry-backoff');
    const alert = within(relay).getByRole('alert');
    expect(within(alert).getByText("Couldn't read the scripts of notify-relay")).toBeDefined();
    expect(within(alert).getByText('package.json has a trailing comma.')).toBeDefined();
    fireEvent.click(within(alert).getByRole('button', { name: 'Retry' }));

    expect(state.refreshDiscoveredScripts).toHaveBeenCalledWith({
      sessionId: SESSION,
      worktreePath: RELAY_PATH,
    });
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

    fireEvent.click(screen.getByRole('button', { name: 'Clear filter' }));
    expect(screen.queryByText('No scripts match "tset".')).toBeNull();
    expect(screen.getAllByRole('button', { name: /^Show .* output$/ }).length).toBeGreaterThan(1);
    expect((filter as HTMLInputElement).value).toBe('');
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
    const confirm = screen.getByRole('group', { name: `Delete "${REPLAY.name}"?` });
    await act(async () => {
      fireEvent.click(within(confirm).getByRole('button', { name: 'Delete' }));
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
    expect(screen.queryByText('No scripts in notify-relay')).toBeNull();
  });

  it('lists only the scripts pinned for the project when it has more discovered ones', () => {
    state.mounts = [SETTLEMENT];
    state.saved = [];
    state.discovered = {
      [SETTLEMENT_PATH]: manifest([
        { name: 'dev', command: 'pnpm run dev' },
        { name: 'lint', command: 'pnpm run lint' },
        { name: 'test', command: 'pnpm run test' },
        { name: 'knip', command: 'pnpm run knip' },
        { name: 'env:login', command: 'pnpm run env:login' },
      ]),
    };
    state.pins = {
      [LEDGER.id]: [pinIdOf({ relDir: '', name: 'dev' }), pinIdOf({ relDir: '', name: 'lint' })],
    };
    renderPanel();

    const names = within(group('ledger-core · nw/settlement'))
      .getAllByRole('button', { name: /^Show .* output$/ })
      .map((button) => button.getAttribute('aria-label'));
    expect(names).toEqual(['Show dev output', 'Show lint output']);
    expect(screen.queryByRole('button', { name: 'Show knip output' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Pin knip' })).toBeNull();
  });

  it('keeps run, stop and the output drawer working for a pinned script', () => {
    state.mounts = [SETTLEMENT];
    state.saved = [];
    state.pins = { [LEDGER.id]: [pinIdOf({ relDir: '', name: 'test' })] };
    state.runs = {
      [manifestKey({ path: SETTLEMENT_PATH, name: 'test' })]: {
        status: 'pending',
        result: null,
        runId: 'run-1',
        startedAt: Date.now(),
        mountId: SETTLEMENT.mountId,
      },
    };
    renderPanel();

    fireEvent.click(
      within(group('ledger-core · nw/settlement')).getByRole('button', { name: 'Stop test' }),
    );

    expect(state.cancelScript).toHaveBeenCalledWith(
      SESSION,
      manifestKey({ path: SETTLEMENT_PATH, name: 'test' }),
    );
  });

  it('names the empty project and opens its scripts inline to pin one', () => {
    state.mounts = [RELAY_MOUNT];
    state.saved = [];
    state.discovered = {
      [RELAY_PATH]: manifest([
        { name: 'dev', command: 'pnpm run dev' },
        { name: 'test', command: 'pnpm run test' },
      ]),
    };
    state.pins = {};
    renderPanel();

    const relay = group('notify-relay · nw/retry-backoff');
    expect(within(relay).getByText('No scripts in notify-relay')).toBeDefined();
    expect(within(relay).queryByRole('button', { name: /^Show .* output$/ })).toBeNull();
    expect(within(relay).queryByRole('button', { name: /Settings/ })).toBeNull();
    expect(within(relay).queryByRole('region', { name: 'Scripts of notify-relay' })).toBeNull();

    fireEvent.click(within(relay).getByRole('button', { name: 'Pin a script of notify-relay' }));

    const picker = within(relay).getByRole('region', { name: 'Scripts of notify-relay' });
    expect(within(picker).getByRole('button', { name: 'Pin dev' })).toBeDefined();
    fireEvent.click(within(picker).getByRole('button', { name: 'Pin test' }));

    expect(state.toggleScriptPin).toHaveBeenCalledWith({
      projectId: RELAY.id,
      pinId: pinIdOf({ relDir: '', name: 'test' }),
    });
  });

  it('shows the pinned strip only when the session has more than one project', () => {
    state.pins = {
      [LEDGER.id]: [pinIdOf({ relDir: '', name: 'test' })],
    };
    renderPanel();

    const strip = screen.getByRole('region', { name: 'Pinned scripts' });
    expect(within(strip).getByRole('button', { name: 'Run test in ledger-core' })).toBeDefined();
    cleanup();

    state.mounts = [SETTLEMENT];
    renderPanel();

    expect(screen.queryByRole('region', { name: 'Pinned scripts' })).toBeNull();
    expect(
      within(group('ledger-core · nw/settlement')).getByRole('button', {
        name: 'Show test output',
      }),
    ).toBeDefined();
  });
});
