// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionId, Workspace, WorkspaceId } from '@goodboy/types';
import type { Location } from '../navigation/types';

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

const locationIn = (workspaceId: WorkspaceId, sessionId: string): Location => ({
  workspaceId,
  place: {
    at: 'session',
    sessionId: sessionId as SessionId,
    view: { lens: 'review', agentId: null, studio: null, target: null },
  },
  studio: null,
  focus: {
    drawer: null,
    selection: {},
    scroll: { queue: 80 },
    revealed: [],
  },
});

const saveLayout = (label: string, workspaceId: WorkspaceId, sessionId: string) =>
  h.settings.set(
    `window.layout.${label}`,
    JSON.stringify({ workspaceId, location: locationIn(workspaceId, sessionId), at: Date.now() }),
  );

const buildGet = () => {
  const setCurrentWorkspace = vi.fn(async () => undefined);
  const restoreLocation = vi.fn();
  const get = (() => ({ setCurrentWorkspace, restoreLocation })) as never;
  return { get, setCurrentWorkspace, restoreLocation };
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
      get: store.get,
      workspaces: WORKSPACES,
      isReopenLast: false,
    });

    expect(layout.isRestored).toBe(true);
    expect(store.setCurrentWorkspace).toHaveBeenCalledWith(WS_A);
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
      get: store.get,
      workspaces: WORKSPACES,
      isReopenLast: false,
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
      get: store.get,
      workspaces: WORKSPACES,
      isReopenLast: true,
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
      get: store.get,
      workspaces: WORKSPACES,
      isReopenLast: false,
    });

    expect(layout.isRestored).toBe(true);
    expect(store.setCurrentWorkspace).toHaveBeenCalledWith(WS_B);
    expect(store.restoreLocation).toHaveBeenCalledWith({
      location: locationIn(WS_B, 'session-relay'),
    });
    expect(h.settings.has('window.layout.win-old')).toBe(false);
    expect(h.titles).toEqual(['northwind']);
  });
});
