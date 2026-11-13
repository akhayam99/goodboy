// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionId, Workspace, WorkspaceId } from '@goodboy/types';
import type { Location } from '../navigation/types';
import type { LaunchReads } from '../workspaces/launchReads';

const h = vi.hoisted(() => ({
  settings: new Map<string, string>(),
  label: 'main',
  hash: '',
  titles: [] as string[],
}));

vi.mock('@goodboy/db', async () =>
  (await import('../../../test/dbMock')).createDbMock({
    getSetting: vi.fn(async (_db: unknown, key: string) => h.settings.get(key) ?? null),
    setSetting: vi.fn(async (_db: unknown, key: string, value: string) => {
      h.settings.set(key, value);
    }),
    deleteSetting: vi.fn(async (_db: unknown, key: string) => {
      h.settings.delete(key);
    }),
    listSettingsWithPrefix: vi.fn(async (_db: unknown, prefix: string) =>
      [...h.settings.entries()]
        .filter(([key]) => key.startsWith(prefix))
        .map(([key, value]) => ({ key, value })),
    ),
  }),
);
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));
vi.mock('../../../features/workspace/window', () => ({
  MAIN_WINDOW_LABEL: 'main',
  isMainWindow: () => h.label === 'main',
  restoreKeyFromHash: () => new URLSearchParams(h.hash).get('restore'),
  targetWorkspaceFromHash: () => new URLSearchParams(h.hash).get('ws'),
  setWindowTitle: vi.fn(async (title: string) => {
    h.titles.push(title);
  }),
}));

import { restoreLaunchLayout } from './restoreLaunchLayout';

const WS_A = 'ws-harborline' as WorkspaceId;
const WS_B = 'ws-northwind' as WorkspaceId;
const WORKSPACES = [
  { id: WS_A, name: 'harborline' },
  { id: WS_B, name: 'northwind' },
] as unknown as ReadonlyArray<Workspace>;
const LAUNCH: LaunchReads = { projects: [], liveRunIds: new Set() };

const locationIn = (workspaceId: WorkspaceId, sessionId: string): Location => ({
  workspaceId,
  place: {
    at: 'session',
    sessionId: sessionId as SessionId,
    view: { lens: 'review', agentId: null, target: null },
  },
  studio: null,
  focus: {
    drawer: null,
    scroll: { queue: 80 },
  },
});

const saveLayout = (label: string, workspaceId: WorkspaceId, sessionId: string) =>
  h.settings.set(
    `window.layout.${label}`,
    JSON.stringify({ workspaceId, location: locationIn(workspaceId, sessionId), at: Date.now() }),
  );

type SwitchError = {
  readonly workspaceId: WorkspaceId;
  readonly message: string;
};

type BuildParams = {
  readonly failure?: SwitchError;
};

const buildGet = ({ failure }: BuildParams = {}) => {
  const state = {
    workspaceSwitchError: failure ?? null,
    boardReady: failure === undefined,
  };
  const setCurrentWorkspace = vi.fn(async () => undefined);
  const restoreLocation = vi.fn();
  const set = vi.fn();
  const get = (() => ({ ...state, setCurrentWorkspace, restoreLocation })) as never;
  return { get, set, setCurrentWorkspace, restoreLocation };
};

beforeEach(() => {
  h.settings.clear();
  h.label = 'main';
  h.hash = '';
  h.titles = [];
});

describe('restoreLaunchLayout', () => {
  it('reopens the main window where it was and lists every other window to reopen', async () => {
    saveLayout('main', WS_A, 'session-ledger');
    saveLayout('win-old', WS_B, 'session-relay');
    h.settings.set('restart.reason', JSON.stringify({ reason: 'update', at: Date.now() }));
    const store = buildGet();

    const layout = await restoreLaunchLayout({
      set: store.set,
      get: store.get,
      workspaces: WORKSPACES,
      isReopenLast: false,
      launch: LAUNCH,
    });

    expect(layout.isRestored).toBe(true);
    expect(store.setCurrentWorkspace).toHaveBeenCalledWith(WS_A, LAUNCH);
    expect(store.restoreLocation).toHaveBeenCalledWith({
      location: locationIn(WS_A, 'session-ledger'),
    });
    expect(layout.secondary).toEqual([
      expect.objectContaining({ label: 'win-old', workspaceId: WS_B, title: 'northwind' }),
    ]);
  });

  it('keeps the launcher and drops old windows on a plain launch with Reopen last off', async () => {
    saveLayout('main', WS_A, 'session-ledger');
    saveLayout('win-old', WS_B, 'session-relay');
    const store = buildGet();

    const layout = await restoreLaunchLayout({
      set: store.set,
      get: store.get,
      workspaces: WORKSPACES,
      isReopenLast: false,
      launch: LAUNCH,
    });

    expect(layout).toEqual({ isRestored: false, secondary: [] });
    expect(store.setCurrentWorkspace).not.toHaveBeenCalled();
    expect(h.settings.has('window.layout.win-old')).toBe(false);
  });

  it('never opens the same workspace twice', async () => {
    saveLayout('main', WS_A, 'session-ledger');
    saveLayout('win-dup', WS_A, 'session-other');
    const store = buildGet();

    const layout = await restoreLaunchLayout({
      set: store.set,
      get: store.get,
      workspaces: WORKSPACES,
      isReopenLast: true,
      launch: LAUNCH,
    });

    expect(layout.secondary).toEqual([]);
    expect(h.settings.has('window.layout.win-dup')).toBe(false);
  });

  it('lets a reopened window take its own saved place and forget the old key', async () => {
    saveLayout('win-old', WS_B, 'session-relay');
    h.label = 'win-new';
    h.hash = `ws=${WS_B}&restore=win-old`;
    const store = buildGet();

    const layout = await restoreLaunchLayout({
      set: store.set,
      get: store.get,
      workspaces: WORKSPACES,
      isReopenLast: false,
      launch: LAUNCH,
    });

    expect(layout.isRestored).toBe(true);
    expect(store.setCurrentWorkspace).toHaveBeenCalledWith(WS_B, LAUNCH);
    expect(store.restoreLocation).toHaveBeenCalledWith({
      location: locationIn(WS_B, 'session-relay'),
    });
    expect(h.settings.has('window.layout.win-old')).toBe(false);
    expect(h.titles).toEqual(['northwind']);
  });

  it('shows the shell for the saved workspace and takes it down when that workspace fails to open', async () => {
    saveLayout('main', WS_A, 'session-ledger');
    h.settings.set('restart.reason', JSON.stringify({ reason: 'update', at: Date.now() }));
    const store = buildGet({ failure: { workspaceId: WS_A, message: 'harborline unreadable' } });

    await restoreLaunchLayout({
      set: store.set,
      get: store.get,
      workspaces: WORKSPACES,
      isReopenLast: false,
      launch: LAUNCH,
    });

    expect(store.set).toHaveBeenNthCalledWith(1, {
      currentWorkspaceId: WS_A,
      switchingToWorkspaceId: null,
      boardReady: false,
      isShellReady: true,
    });
    expect(store.set).toHaveBeenLastCalledWith({
      currentWorkspaceId: null,
      boardReady: true,
      isShellReady: false,
    });
    expect(store.restoreLocation).not.toHaveBeenCalled();
  });
});
