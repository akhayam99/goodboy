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

  it('keeps the open tools on a session that saved no grid, and on the Board', async () => {
    saveRow({ sessionId: S1, grid: SAVED });
    watch();
    await goTo({ sessionId: S1 });

    await goTo({ sessionId: S2 });
    expect(toolKinds()).toEqual([['browser'], ['terminal']]);
    await goTo({ sessionId: null });
    expect(toolKinds()).toEqual([['browser'], ['terminal']]);
  });

  it('gives each session its own grid', async () => {
    saveRow({ sessionId: S1, grid: SAVED });
    saveRow({
      sessionId: S2,
      grid: { columns: [[TERMINAL]], used: ['terminal'], focus: { at: 'page' }, widths: {} },
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
      },
    });
    watch();

    await goTo({ sessionId: S1 });

    expect(toolKinds()).toEqual([['browser']]);
  });

  it('brings Monitor back when the session opens again in the same run', async () => {
    saveRow({
      sessionId: S2,
      grid: { columns: [[TERMINAL]], used: ['terminal'], focus: { at: 'page' }, widths: {} },
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
});
