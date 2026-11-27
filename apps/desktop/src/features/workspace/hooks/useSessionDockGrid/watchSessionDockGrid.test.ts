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
import { gridAfterOpen } from '../../../../store/slices/drawer/gridAfterOpen';
import {
  EMPTY_DRAWER_GRID,
  type DrawerGrid,
  type DrawerRequest,
} from '../../../../store/slices/drawer/state';
import {
  parseStoredDockGrid,
  storedDockGridOf,
} from '../../../../store/slices/drawer/dockGridMemory/storedDockGrid';
import { panelFocusKeyOf } from '../../../../store/slices/drawer/panelFocusKeyOf';
import { shellPanelsOf } from '../../../../store/slices/drawer/shellPanelsOf';
import type { TerminalTabId } from '../../../../shared/types/terminal';
import { watchSessionDockGrid } from './watchSessionDockGrid';

const WS = brandId<WorkspaceId>({ value: 'ws-harborline' });
const S1 = brandId<SessionId>({ value: 'session-ledger-core' });
const S2 = brandId<SessionId>({ value: 'session-notify-relay' });

const TERMINAL_ID = brandId<TerminalTabId>({ value: 'ws:ws-harborline::t1' });
const TERMINAL_TAB = {
  id: TERMINAL_ID,
  owner: { kind: 'workspace', workspaceId: WS },
  title: 'pnpm dev',
  cwd: null,
  status: 'running',
  createdAt: 0,
} as const;

const TERMINAL: DrawerRequest = {
  kind: 'terminal',
  sessionId: null,
  payload: { terminalId: TERMINAL_ID },
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

const openTools = ({ entries }: { readonly entries: ReadonlyArray<DrawerRequest> }) => {
  store.setState({
    drawerGrid: entries.reduce((grid, entry) => gridAfterOpen({ grid, entry }), EMPTY_DRAWER_GRID),
  });
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
    terminalTabs: { [`ws:${WS}`]: [TERMINAL_TAB] },
    sessions: [aSession({ id: S1, workspaceId: WS }), aSession({ id: S2, workspaceId: WS })],
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
  it('lays the saved columns and widths of the session onto the tools that are open', async () => {
    saveRow({ sessionId: S1, grid: { ...SAVED, columns: [[TERMINAL], [BROWSER]] } });
    openTools({ entries: [BROWSER, TERMINAL] });
    watch();

    await goTo({ sessionId: S1 });

    expect(toolKinds()).toEqual([['terminal'], ['browser']]);
    expect(state().drawerGrid.widths).toEqual({ browser: 760 });
  });

  it('keeps the focus of the window, not the one saved on the session', async () => {
    saveRow({ sessionId: S1, grid: SAVED });
    openTools({ entries: [BROWSER, TERMINAL] });
    store.setState((current) => ({ drawerGrid: { ...current.drawerGrid, focus: { at: 'page' } } }));
    watch();

    await goTo({ sessionId: S1 });

    expect(panelFocusKeyOf({ panels: shellPanelsOf({ state: state() }) })).not.toBe('browser');
  });

  it('still loads a row saved before Scripts and Ask joined the grid', async () => {
    db.rows.set(S1, {
      grid: JSON.stringify({
        version: 1,
        columns: [[BROWSER], [TERMINAL]],
        used: ['browser', 'terminal'],
        focus: { at: 'tool', kind: 'browser' },
        widths: { browser: 760 },
      }),
      savedAt: 1,
    });
    openTools({ entries: [TERMINAL, BROWSER] });
    watch();

    await goTo({ sessionId: S1 });

    expect(toolKinds()).toEqual([['browser'], ['terminal']]);
    expect(state().drawerGrid.widths).toEqual({ browser: 760 });
  });

  it('lays out Scripts and Ask in their own cells', async () => {
    const scripts: DrawerRequest = { kind: 'scripts', sessionId: S1, payload: null };
    const ask: DrawerRequest = { kind: 'ask', sessionId: S1, payload: null };
    saveRow({
      sessionId: S1,
      grid: {
        columns: [[BROWSER], [TERMINAL], [scripts, ask]],
        used: ['browser', 'terminal', 'scripts', 'ask'],
        focus: { at: 'tool', kind: 'ask' },
        widths: {},
        splits: {},
      },
    });
    openTools({ entries: [BROWSER, TERMINAL, scripts, ask] });
    watch();

    await goTo({ sessionId: S1 });

    expect(toolKinds()).toEqual([['browser'], ['terminal'], ['scripts', 'ask']]);
  });

  it('shows the default layout and says so once when the row does not parse', async () => {
    db.rows.set(S1, { grid: '{"version":9,"columns":"?"}', savedAt: 1 });
    watch();

    await goTo({ sessionId: S1 });
    await goTo({ sessionId: S2 });
    await goTo({ sessionId: S1 });

    expect(toolKinds()).toEqual([]);
    expect(reportError).toHaveBeenCalledTimes(1);
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: S1,
        severity: 'warning',
        title: "Couldn't read the saved panels of this session",
      }),
    );
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

  it('keeps the tools open on a session that saved no grid, and on the Board', async () => {
    saveRow({ sessionId: S1, grid: SAVED });
    openTools({ entries: [BROWSER, TERMINAL] });
    watch();
    await goTo({ sessionId: S1 });

    await goTo({ sessionId: S2 });
    expect(toolKinds().flat().sort()).toEqual(['browser', 'terminal']);
    await goTo({ sessionId: null });
    expect(toolKinds().flat().sort()).toEqual(['browser', 'terminal']);
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

  it('gives each session its own layout of the same tools', async () => {
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
    openTools({ entries: [BROWSER, TERMINAL] });
    watch();

    await goTo({ sessionId: S1 });
    expect(toolKinds()).toEqual([['browser'], ['terminal']]);
    await goTo({ sessionId: S2 });
    expect(toolKinds()).toEqual([['terminal'], ['browser']]);
    await goTo({ sessionId: S1 });
    expect(toolKinds()).toEqual([['browser'], ['terminal']]);
  });

  it('opens no tool that the row names and the window has not opened', async () => {
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
    openTools({ entries: [BROWSER] });
    watch();

    await goTo({ sessionId: S1 });

    expect(toolKinds()).toEqual([['browser']]);
  });

  it('keeps Monitor open from one session to the next and back', async () => {
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
    expect(toolKinds().flat()).toContain('monitoring');
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

  it('shows the layout of the window that wrote last when the session opens again', async () => {
    watch();
    await goTo({ sessionId: S1 });
    state().openDrawer(TERMINAL);
    state().openDrawer(BROWSER);
    await settle();
    await goTo({ sessionId: S2 });
    expect(toolKinds()).toEqual([['terminal'], ['browser']]);

    saveRow({
      sessionId: S1,
      grid: { ...SAVED, widths: { browser: 640 } },
      savedAt: Date.now() + 1000,
    });
    await goTo({ sessionId: S1 });

    expect(toolKinds()).toEqual([['browser'], ['terminal']]);
    expect(state().drawerGrid.widths).toEqual({ browser: 640 });
  });

  it('reads the newer layout of another window when this window takes the focus', async () => {
    watch();
    await goTo({ sessionId: S1 });
    state().openDrawer(TERMINAL);
    state().openDrawer(BROWSER);
    await settle();
    expect(toolKinds()).toEqual([['terminal'], ['browser']]);

    saveRow({
      sessionId: S1,
      grid: { ...SAVED, widths: { browser: 640 } },
      savedAt: Date.now() + 1000,
    });
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

  it('merges a panel into another cell, saves the tab list and focuses the panel', async () => {
    await openPair();

    const isMoved = await state().moveDockPanel({
      sessionId: S1,
      kind: 'browser',
      target: { at: 'tab', key: 'terminal' },
    });
    await settle();

    expect(isMoved).toBe(true);
    expect(
      shellPanelsOf({ state: state() }).layout.map((column) => column.map((p) => p.kind)),
    ).toEqual([['terminal']]);
    expect(toolKinds().flat().sort()).toEqual(['browser', 'terminal']);
    expect(state().drawerGrid.tabs).toEqual({
      terminal: { keys: ['terminal', 'browser'], active: 'browser' },
    });
    expect(panelFocusKeyOf({ panels: shellPanelsOf({ state: state() }) })).toBe('browser');
    expect(JSON.parse(db.rows.get(S1)?.grid ?? '{}')).toMatchObject({
      tabs: { terminal: { keys: ['terminal', 'browser'], active: 'browser' } },
    });
  });

  it('tears a tab out of its cell and leaves a plain panel behind', async () => {
    await openPair();
    await state().moveDockPanel({
      sessionId: S1,
      kind: 'browser',
      target: { at: 'tab', key: 'terminal' },
    });
    await settle();

    const isMoved = await state().moveDockPanel({
      sessionId: S1,
      kind: 'browser',
      unit: 'panel',
      target: { at: 'beside', key: 'terminal', side: 'after' },
    });
    await settle();

    expect(isMoved).toBe(true);
    expect(toolKinds()).toEqual([['terminal'], ['browser']]);
    expect(state().drawerGrid.tabs).toBeUndefined();
  });

  it('hands the cell to the next tab when the first one closes', async () => {
    await openPair();
    await state().moveDockPanel({
      sessionId: S1,
      kind: 'browser',
      target: { at: 'tab', key: 'terminal' },
    });
    const terminal = state()
      .drawerGrid.columns.flat()
      .find((panel) => panel.kind === 'terminal');
    if (terminal === undefined) {
      throw new Error('terminal is in the grid');
    }

    state().closeDrawerEntry({ entry: terminal });

    expect(
      shellPanelsOf({ state: state() }).layout.map((column) => column.map((p) => p.kind)),
    ).toEqual([['browser']]);
    expect(state().drawerGrid.tabs).toBeUndefined();
  });

  it('reads a saved tab list back', async () => {
    await openPair();
    await state().moveDockPanel({
      sessionId: S1,
      kind: 'browser',
      target: { at: 'tab', key: 'terminal' },
    });

    const saved = storedDockGridOf({ grid: state().drawerGrid });

    expect(parseStoredDockGrid({ raw: saved })?.tabs).toEqual(state().drawerGrid.tabs);
    expect(
      parseStoredDockGrid({
        raw: saved.replace('"keys":["terminal","browser"]', '"keys":["terminal","files"]'),
      })?.tabs,
    ).toBeUndefined();
  });

  it.each(['scripts', 'ask'] as const)(
    'moves the %s panel and saves the grid on the session the move named',
    async (kind) => {
      await openPair();
      state().openDrawer({ kind, sessionId: S1, payload: null });
      await settle();

      const isMoved = await state().moveDockPanel({
        sessionId: S1,
        kind,
        target: { at: 'beside', key: 'terminal', side: 'before' },
      });
      await settle();

      expect(isMoved).toBe(true);
      expect(toolKinds()[0]).toEqual([kind]);
      const saved: { readonly columns: ReadonlyArray<unknown> } = JSON.parse(
        db.rows.get(S1)?.grid ?? '{"columns":[]}',
      );
      expect(saved.columns[0]).toMatchObject([{ kind, sessionId: S1 }]);
    },
  );

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
    expect(toolKinds()).toEqual(before);
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

describe('a row saved with a face and a detail by an older build', () => {
  it('reads the layout and writes the next row without the face', async () => {
    db.rows.set(S1, {
      grid: JSON.stringify({
        version: 2,
        columns: [[BROWSER]],
        used: ['browser'],
        focus: { at: 'page' },
        widths: { browser: 520 },
        face: 'desk',
        detail: [{ kind: 'transcript', agentId: 'agent-implementer' }],
      }),
      savedAt: 1,
    });
    openTools({ entries: [BROWSER] });
    watch();

    await goTo({ sessionId: S1 });
    state().resizeDockColumn({ kind: 'browser', width: 600 });
    await settle();

    expect(state().drawerGrid.widths).toEqual({ browser: 600 });
    const written = JSON.parse(db.rows.get(S1)?.grid ?? '{}');
    expect(written).not.toHaveProperty('face');
    expect(written).not.toHaveProperty('detail');
    expect(state().drawer?.kind).not.toBe('transcript');
  });

  it('opens no tool and no agent when an Overview row names tools', async () => {
    saveRow({ sessionId: S1, grid: SAVED });
    watch();

    await goTo({ sessionId: S1 });

    expect(toolKinds()).toEqual([]);
    expect(state().drawer).toBeNull();
  });
});
