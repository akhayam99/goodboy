// @vitest-environment happy-dom
const db = vi.hoisted(() => {
  const heldLoads: Array<() => void> = [];
  return {
    rows: new Map<string, { readonly grid: string; readonly savedAt: number }>(),
    failSaves: false,
    holdLoads: false,
    heldLoads,
  };
});

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../store/storyHarness')).dbModuleMock({
    getSessionDockGrid: vi.fn(async ({ sessionId }: { readonly sessionId: string }) => {
      if (db.holdLoads) {
        await new Promise<void>((resolve) => db.heldLoads.push(resolve));
      }
      return db.rows.get(sessionId)?.grid ?? null;
    }),
    saveSessionDockGrid: vi.fn(
      async ({
        sessionId,
        grid,
        savedAt,
      }: {
        readonly sessionId: string;
        readonly grid: string;
        readonly savedAt: number;
      }) => {
        if (db.failSaves) {
          throw new Error('disk full');
        }
        const row = db.rows.get(sessionId);
        if (row === undefined || savedAt >= row.savedAt) {
          db.rows.set(sessionId, { grid, savedAt });
        }
      },
    ),
  }),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { brandId, type SessionId, type WorkspaceId } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { BOARD_PLACE, sessionPlace } from '../../../../store/slices/navigation/place';
import type { DrawerGrid, DrawerRequest } from '../../../../store/slices/drawer/state';
import { storedDockGridOf } from '../../../../store/slices/drawer/storedDockGrid';
import { panelFocusKeyOf } from '../../../../store/slices/drawer/panelFocusKeyOf';
import { shellPanelsOf } from '../../../../store/slices/drawer/shellPanelsOf';
import type { TerminalTabId } from '../../../../shared/types/terminal';
import { watchSessionDockGrid } from './watchSessionDockGrid';

const WS = brandId<WorkspaceId>({ value: 'ws-harborline' });
const S1 = brandId<SessionId>({ value: 'session-ledger-core' });
const S2 = brandId<SessionId>({ value: 'session-notify-relay' });

const TERMINAL: DrawerRequest = {
  kind: 'terminal',
  sessionId: null,
  payload: { terminalId: brandId<TerminalTabId>({ value: 'tab-harborline-dev' }) },
};
const BROWSER: DrawerRequest = { kind: 'browser', sessionId: S1, payload: null };
const MONITOR: DrawerRequest = { kind: 'monitoring', sessionId: null, payload: null };

const SAVED: DrawerGrid = {
  columns: [[BROWSER], [TERMINAL]],
  used: ['browser', 'terminal'],
  focus: { at: 'tool', kind: 'browser' },
  widths: { browser: 760 },
  splits: {},
};

let store: StoryStore;
let stop: (() => void) | null = null;
const reportError = vi.fn(async () => undefined);

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const state = () => store.getState();

const settle = async () => {
  await vi.advanceTimersByTimeAsync(10);
};

const toolKinds = () => state().drawerGrid.columns.map((column) => column.map((p) => p.kind));

type SaveParams = {
  readonly sessionId: SessionId;
  readonly grid: DrawerGrid;
  readonly savedAt?: number;
};

const saveRow = ({ sessionId, grid, savedAt = 1 }: SaveParams) => {
  db.rows.set(sessionId, { grid: storedDockGridOf({ grid }), savedAt });
};

const goTo = async ({ sessionId }: { readonly sessionId: SessionId | null }) => {
  state().navigate({ to: sessionId === null ? BOARD_PLACE : sessionPlace({ sessionId }) });
  await settle();
};

const watch = () => {
  stop = watchSessionDockGrid({ store, delayMs: 0 });
};

beforeEach(async () => {
  vi.useFakeTimers();
  db.rows.clear();
  db.failSaves = false;
  db.holdLoads = false;
  db.heldLoads.splice(0, db.heldLoads.length);
  reportError.mockClear();
  await resetStoryStore();
  store.setState({
    currentWorkspaceId: WS,
    currentSessionId: null,
    sessions: [aSession({ id: S1 }), aSession({ id: S2 })],
    setCurrentSession: async (id: SessionId | null) => {
      store.setState({ currentSessionId: id });
    },
    selectAgent: async () => undefined,
    reportError,
  });
});

afterEach(() => {
  stop?.();
  stop = null;
  vi.useRealTimers();
});

describe('the dock grid saved on the session', () => {
  it('brings back the panels, the columns, the widths and the focus of the session', async () => {
    saveRow({ sessionId: S1, grid: SAVED });
    watch();

    await goTo({ sessionId: S1 });

    expect(toolKinds()).toEqual([['browser'], ['terminal']]);
    expect(state().drawerGrid.widths).toEqual({ browser: 760 });
    expect(panelFocusKeyOf({ panels: shellPanelsOf({ state: state() }) })).toBe('browser');
  });

  it('saves a change on the session it was made on, even after a move', async () => {
    watch();
    await goTo({ sessionId: S1 });

    state().openDrawer(TERMINAL);
    state().resizeDockColumn({ kind: 'terminal', width: 432.4 });
    state().navigate({ to: sessionPlace({ sessionId: S2 }) });
    await settle();

    const saved = db.rows.get(S1)?.grid ?? '';
    expect(JSON.parse(saved)).toMatchObject({
      columns: [[{ kind: 'terminal' }]],
      widths: { terminal: 432 },
    });
    expect(db.rows.has(S2)).toBe(false);
  });

  it('parks the tools of a session on a session that saved no grid, and on the Board', async () => {
    saveRow({ sessionId: S1, grid: SAVED });
    watch();
    await goTo({ sessionId: S1 });

    await goTo({ sessionId: S2 });
    expect(toolKinds()).toEqual([]);
    await goTo({ sessionId: null });
    expect(toolKinds()).toEqual([]);
    await goTo({ sessionId: S1 });
    expect(toolKinds()).toEqual([['browser'], ['terminal']]);
  });

  it('writes no grid when the window only passes through the sessions', async () => {
    saveRow({ sessionId: S1, grid: SAVED });
    watch();
    await goTo({ sessionId: S1 });
    await goTo({ sessionId: S2 });
    await goTo({ sessionId: null });
    await goTo({ sessionId: S1 });

    expect(db.rows.get(S1)?.grid).toBe(storedDockGridOf({ grid: SAVED }));
    expect(db.rows.has(S2)).toBe(false);
  });

  it('gives each session its own grid', async () => {
    saveRow({ sessionId: S1, grid: SAVED });
    saveRow({
      sessionId: S2,
      grid: {
        columns: [[TERMINAL]],
        used: ['terminal'],
        focus: { at: 'page' },
        widths: {},
        splits: {},
      },
    });
    watch();

    await goTo({ sessionId: S1 });
    expect(toolKinds()).toEqual([['browser'], ['terminal']]);
    await goTo({ sessionId: S2 });
    expect(toolKinds()).toEqual([['terminal']]);
    await goTo({ sessionId: S1 });
    expect(toolKinds()).toEqual([['browser'], ['terminal']]);
  });

  it('leaves Monitor closed when a session saved before a restart opens', async () => {
    saveRow({
      sessionId: S1,
      grid: {
        columns: [[BROWSER], [MONITOR]],
        used: ['browser', 'monitoring'],
        focus: { at: 'tool', kind: 'monitoring' },
        widths: {},
        splits: {},
      },
    });
    watch();

    await goTo({ sessionId: S1 });

    expect(toolKinds()).toEqual([['browser']]);
  });

  it('brings Monitor back when the session opens again in the same run', async () => {
    saveRow({
      sessionId: S2,
      grid: {
        columns: [[TERMINAL]],
        used: ['terminal'],
        focus: { at: 'page' },
        widths: {},
        splits: {},
      },
    });
    watch();
    await goTo({ sessionId: S1 });
    state().openDrawer(MONITOR);
    await settle();

    await goTo({ sessionId: S2 });
    expect(toolKinds().flat()).not.toContain('monitoring');
    await goTo({ sessionId: S1 });

    expect(toolKinds().flat()).toContain('monitoring');
  });

  it('keeps the previous grid when a save fails, and says so on the session', async () => {
    saveRow({ sessionId: S1, grid: SAVED });
    watch();
    await goTo({ sessionId: S1 });

    db.failSaves = true;
    state().openDrawer(MONITOR);
    await settle();
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: S1, title: "Couldn't save the panels of this session" }),
    );
    expect(db.rows.get(S1)?.grid).toBe(storedDockGridOf({ grid: SAVED }));

    db.failSaves = false;
    await goTo({ sessionId: S2 });
    state().clearDrawer();
    await goTo({ sessionId: S1 });
    expect(toolKinds().flat()).not.toContain('monitoring');
  });

  it('drops a grid that comes back after the window left the session', async () => {
    saveRow({ sessionId: S1, grid: SAVED });
    watch();
    db.holdLoads = true;

    await goTo({ sessionId: S1 });
    await goTo({ sessionId: null });
    db.heldLoads.forEach((release) => release());
    await settle();

    expect(toolKinds()).toEqual([]);
  });

  it('reads no grid for a session the window left before the read started', async () => {
    saveRow({ sessionId: S1, grid: SAVED });
    watch();

    state().navigate({ to: sessionPlace({ sessionId: S1 }) });
    state().navigate({ to: BOARD_PLACE });
    await settle();

    expect(toolKinds()).toEqual([]);
  });

  it('drops a grid that comes back after the user opened a tool', async () => {
    saveRow({ sessionId: S1, grid: SAVED });
    watch();
    db.holdLoads = true;

    await goTo({ sessionId: S1 });
    state().openDrawer(MONITOR);
    db.heldLoads.forEach((release) => release());
    await settle();

    expect(toolKinds()).toEqual([['monitoring']]);
  });

  it('shows the grid of the window that wrote last when the session opens again', async () => {
    watch();
    await goTo({ sessionId: S1 });
    state().openDrawer(TERMINAL);
    await settle();
    await goTo({ sessionId: S2 });

    saveRow({ sessionId: S1, grid: SAVED, savedAt: Date.now() + 1000 });
    await goTo({ sessionId: S1 });

    expect(toolKinds()).toEqual([['browser'], ['terminal']]);
  });

  it('reads the newer grid of another window when this window takes the focus', async () => {
    watch();
    await goTo({ sessionId: S1 });
    state().openDrawer(TERMINAL);
    await settle();

    saveRow({ sessionId: S1, grid: SAVED, savedAt: Date.now() + 1000 });
    window.dispatchEvent(new Event('focus'));
    await settle();

    expect(toolKinds()).toEqual([['browser'], ['terminal']]);
    expect(toolKinds().flat()).toHaveLength(new Set(toolKinds().flat()).size);
  });
});

describe('moving a panel and resetting the layout', () => {
  const openPair = async () => {
    watch();
    await goTo({ sessionId: S1 });
    state().openDrawer(TERMINAL);
    state().openDrawer(BROWSER);
    await settle();
  };

  it('moves a panel, saves the grid on the session and focuses the panel', async () => {
    await openPair();

    const isMoved = await state().moveDockPanel({
      sessionId: S1,
      kind: 'browser',
      target: { at: 'above', key: 'terminal' },
    });
    await settle();

    expect(isMoved).toBe(true);
    expect(toolKinds()).toEqual([['browser', 'terminal']]);
    expect(panelFocusKeyOf({ panels: shellPanelsOf({ state: state() }) })).toBe('browser');
    expect(JSON.parse(db.rows.get(S1)?.grid ?? '{}')).toMatchObject({
      columns: [[{ kind: 'browser' }, { kind: 'terminal' }]],
    });
  });

  it('does nothing for a panel that already left the grid', async () => {
    await openPair();
    const terminal = state()
      .drawerGrid.columns.flat()
      .find((panel) => panel.kind === 'terminal');
    if (terminal === undefined) {
      throw new Error('terminal is in the grid');
    }
    state().closeDrawerEntry({ entry: terminal });
    const before = state().drawerGrid;

    const isMoved = await state().moveDockPanel({
      sessionId: S1,
      kind: 'terminal',
      target: { at: 'above', key: 'browser' },
    });

    expect(isMoved).toBe(false);
    expect(state().drawerGrid).toBe(before);
  });

  it('drops a move that lands after the window left the session it named', async () => {
    await openPair();
    const before = toolKinds();

    const moving = state().moveDockPanel({
      sessionId: S1,
      kind: 'browser',
      target: { at: 'above', key: 'terminal' },
    });
    state().navigate({ to: sessionPlace({ sessionId: S2 }) });

    expect(await moving).toBe(false);
    await settle();
    expect(toolKinds()).toEqual([]);
    await goTo({ sessionId: S1 });
    expect(toolKinds()).toEqual(before);
  });

  it('rejects a move that names another session than the one on screen', async () => {
    await openPair();
    const before = state().drawerGrid;
    db.rows.delete(S2);

    const isMoved = await state().moveDockPanel({
      sessionId: S2,
      kind: 'browser',
      target: { at: 'above', key: 'terminal' },
    });
    await settle();

    expect(isMoved).toBe(false);
    expect(state().drawerGrid).toBe(before);
    expect(db.rows.has(S2)).toBe(false);
  });

  it('rejects Reset layout and its Undo once the window left the session', async () => {
    await openPair();
    await state().moveDockPanel({ sessionId: S1, kind: 'browser', target: { at: 'page' } });
    await state().resetDockGrid({ sessionId: S1 });
    await settle();
    await goTo({ sessionId: S2 });
    const before = state().drawerGrid;
    const saved = db.rows.get(S1)?.grid;

    expect(await state().undoLastOperation()).toBe(false);
    await settle();

    expect(state().drawerGrid).toBe(before);
    expect(db.rows.get(S1)?.grid).toBe(saved);
  });

  it('skips the save of a queued move once a panel closed under it', async () => {
    await openPair();
    const terminal = state()
      .drawerGrid.columns.flat()
      .find((panel) => panel.kind === 'terminal');
    if (terminal === undefined) {
      throw new Error('terminal is in the grid');
    }

    const moving = state().moveDockPanel({
      sessionId: S1,
      kind: 'browser',
      target: { at: 'above', key: 'terminal' },
    });
    state().closeDrawerEntry({ entry: terminal });

    expect(await moving).toBe(false);
    await settle();
    expect(JSON.parse(db.rows.get(S1)?.grid ?? '{}').columns).toEqual([
      [expect.objectContaining({ kind: 'browser' })],
    ]);
  });

  it('keeps the panels where they were when the save fails, and says so', async () => {
    await openPair();
    const before = state().drawerGrid;
    db.failSaves = true;

    const isMoved = await state().moveDockPanel({
      sessionId: S1,
      kind: 'browser',
      target: { at: 'page' },
    });

    expect(isMoved).toBe(false);
    expect(state().drawerGrid).toBe(before);
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: S1, title: "Couldn't move the panel" }),
    );
  });

  it('resets the layout and Undo brings back the panels and their sizes', async () => {
    await openPair();
    await state().moveDockPanel({
      sessionId: S1,
      kind: 'browser',
      target: { at: 'above', key: 'terminal' },
    });
    state().resizeDockRow({ kinds: ['browser', 'terminal'], share: 0.3 });
    await settle();
    const arranged = state().drawerGrid;

    const isReset = await state().resetDockGrid({ sessionId: S1 });
    await settle();

    expect(isReset).toBe(true);
    expect(toolKinds()).toEqual([['terminal'], ['browser']]);
    expect(state().drawerGrid.splits).toEqual({});
    expect(state().undoNotices.at(-1)?.toast.message).toBe('Panel layout reset');

    expect(await state().undoLastOperation()).toBe(true);
    await settle();

    expect(toolKinds()).toEqual([['browser', 'terminal']]);
    expect(state().drawerGrid.splits).toEqual(arranged.splits);
  });

  it('undoes nothing once the panels changed after the reset', async () => {
    await openPair();
    await state().moveDockPanel({ sessionId: S1, kind: 'browser', target: { at: 'page' } });
    await state().resetDockGrid({ sessionId: S1 });
    state().openDrawer(MONITOR);
    await settle();
    const after = state().drawerGrid;

    expect(await state().undoLastOperation()).toBe(false);
    expect(state().drawerGrid).toBe(after);
  });

  it('resets nothing when the panels already sit where they open', async () => {
    await openPair();
    const before = state().drawerGrid;

    expect(await state().resetDockGrid({ sessionId: S1 })).toBe(false);
    expect(state().drawerGrid).toBe(before);
  });
});

describe('the face saved with the grid', () => {
  it('saves the Desk face of a session inside its grid row', async () => {
    watch();
    await goTo({ sessionId: S1 });

    state().setSessionFace({ sessionId: S1, face: 'desk' });
    await settle();

    expect(JSON.parse(db.rows.get(S1)?.grid ?? '{}')).toMatchObject({ version: 1, face: 'desk' });
    expect(db.rows.has(S2)).toBe(false);
  });

  it('keeps the face on screen when its save fails, says so, and the next switch saves it', async () => {
    watch();
    await goTo({ sessionId: S1 });
    db.failSaves = true;

    state().setSessionFace({ sessionId: S1, face: 'desk' });
    await settle();

    expect(state().sessionFace[S1]).toBe('desk');
    expect(db.rows.has(S1)).toBe(false);
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: S1, title: "Couldn't save the panels of this session" }),
    );

    db.failSaves = false;
    state().setSessionFace({ sessionId: S1, face: 'overview' });
    await settle();
    state().setSessionFace({ sessionId: S1, face: 'desk' });
    await settle();

    expect(JSON.parse(db.rows.get(S1)?.grid ?? '{}')).toMatchObject({ face: 'desk' });
  });

  it('reopens each session on the face it was left on', async () => {
    saveRow({ sessionId: S1, grid: SAVED });
    db.rows.set(S2, { grid: storedDockGridOf({ grid: SAVED, face: 'desk' }), savedAt: 1 });
    watch();

    await goTo({ sessionId: S2 });
    expect(state().sessionFace[S2]).toBe('desk');
    await goTo({ sessionId: S1 });
    expect(state().sessionFace[S1]).toBe('overview');
  });

  it('reads the face of a session that is not open', async () => {
    db.rows.set(S2, { grid: storedDockGridOf({ grid: SAVED, face: 'desk' }), savedAt: 1 });
    watch();
    await goTo({ sessionId: S1 });

    expect(await state().recallSessionFace({ sessionId: S2 })).toBe('desk');
    expect(state().sessionFace[S2]).toBe('desk');
    expect(state().currentSessionId).toBe(S1);
  });

  it('reads a row saved without the face as the overview', async () => {
    saveRow({ sessionId: S1, grid: SAVED });
    watch();

    await goTo({ sessionId: S1 });

    expect(state().sessionFace[S1]).toBe('overview');
    expect(JSON.parse(db.rows.get(S1)?.grid ?? '{}')).not.toHaveProperty('face');
  });

  it('keeps a face picked while the row was still loading', async () => {
    saveRow({ sessionId: S1, grid: SAVED });
    db.holdLoads = true;
    watch();
    await goTo({ sessionId: S1 });

    state().setSessionFace({ sessionId: S1, face: 'desk' });
    db.heldLoads.splice(0).forEach((release) => release());
    await settle();

    expect(state().sessionFace[S1]).toBe('desk');
  });

  it('keeps the Overview picked while a Desk row was loading, even with no face set before', async () => {
    db.rows.set(S1, { grid: storedDockGridOf({ grid: SAVED, face: 'desk' }), savedAt: 1 });
    db.holdLoads = true;
    watch();
    await goTo({ sessionId: S1 });

    state().setSessionFace({ sessionId: S1, face: 'overview' });
    db.heldLoads.splice(0).forEach((release) => release());
    await settle();

    expect(state().sessionFace[S1] ?? 'overview').toBe('overview');
  });

  it('keeps a face picked away and back while the row was loading', async () => {
    db.rows.set(S2, { grid: storedDockGridOf({ grid: SAVED }), savedAt: 1 });
    watch();
    await goTo({ sessionId: S1 });
    state().setSessionFace({ sessionId: S2, face: 'desk' });
    db.holdLoads = true;

    const read = state().recallSessionFace({ sessionId: S2 });
    state().setSessionFace({ sessionId: S2, face: 'overview' });
    state().setSessionFace({ sessionId: S2, face: 'desk' });
    await settle();
    db.heldLoads.splice(0).forEach((release) => release());

    expect(await read).toBeNull();
    expect(state().sessionFace[S2]).toBe('desk');
  });

  it('saves the Overview picked right after a Desk row came back', async () => {
    db.rows.set(S1, { grid: storedDockGridOf({ grid: SAVED, face: 'desk' }), savedAt: 1 });
    stop = watchSessionDockGrid({ store, delayMs: 300 });
    await goTo({ sessionId: S1 });
    expect(state().sessionFace[S1]).toBe('desk');

    state().setSessionFace({ sessionId: S1, face: 'overview' });
    await vi.advanceTimersByTimeAsync(400);

    expect(JSON.parse(db.rows.get(S1)?.grid ?? '{}')).not.toHaveProperty('face');
  });

  it('keeps the Desk face in the row a move or a reset writes', async () => {
    watch();
    await goTo({ sessionId: S1 });
    state().openDrawer(TERMINAL);
    state().openDrawer(BROWSER);
    state().setSessionFace({ sessionId: S1, face: 'desk' });
    await settle();

    await state().moveDockPanel({ sessionId: S1, kind: 'browser', target: { at: 'page' } });
    expect(JSON.parse(db.rows.get(S1)?.grid ?? '{}')).toMatchObject({ face: 'desk' });

    await state().resetDockGrid({ sessionId: S1 });
    expect(JSON.parse(db.rows.get(S1)?.grid ?? '{}')).toMatchObject({ face: 'desk' });
  });

  it('keeps the face it had when the row cannot be read, and says so', async () => {
    watch();
    await goTo({ sessionId: S1 });
    state().setSessionFace({ sessionId: S1, face: 'desk' });
    db.holdLoads = false;
    const { getSessionDockGrid } = await import('@goodboy/db');
    vi.mocked(getSessionDockGrid).mockRejectedValueOnce(new Error('disk gone'));

    expect(await state().recallSessionFace({ sessionId: S1 })).toBeNull();
    expect(state().sessionFace[S1]).toBe('desk');
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: S1,
        title: "Couldn't load the last view of this session",
      }),
    );
  });
});
