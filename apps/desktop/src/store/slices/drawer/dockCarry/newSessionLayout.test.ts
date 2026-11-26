import { brandId, type IsoDateTime, type SessionId, type WorkspaceId } from '@goodboy/types';
import { describe, expect, it } from 'vitest';
import { sessionFixture, WORKSPACE } from '../../../../__tests__/helpers/actionFixtures';
import type { TerminalTabId } from '../../../../shared/types/terminal';
import { BOARD_PLACE, sessionPlace } from '../../navigation/place';
import { workspaceTerminalOwner } from '../../terminal/terminalOwner';
import { dockAfterPlace } from '../dockAfterPlace';
import { gridAfterOpen } from '../gridAfterOpen';
import { dockScopeInitialState, type DockScopeState } from '../dockScopeState';
import { EMPTY_DRAWER_GRID, type DrawerGrid, type OpenDrawer } from '../state';

const LEDGER = brandId<SessionId>({ value: 'session-ledger-core' });
const NOTIFY = brandId<SessionId>({ value: 'session-notify-relay' });
const PAYMENTS = brandId<SessionId>({ value: 'session-payments-api' });
const OTHER_WORKSPACE = brandId<WorkspaceId>({ value: 'ws-northwind' });

const NOW = Date.parse('2026-11-26T10:00:00.000Z');

const justNow = (): IsoDateTime =>
  brandId<IsoDateTime>({ value: new Date(NOW - 10_000).toISOString() });

const SESSIONS = [
  sessionFixture({ id: LEDGER }),
  sessionFixture({ id: NOTIFY, createdAt: justNow() }),
  sessionFixture({ id: PAYMENTS, workspaceId: OTHER_WORKSPACE, createdAt: justNow() }),
];

const TERMINAL_ID = brandId<TerminalTabId>({ value: `ws:${WORKSPACE}::t1` });

const TERMINAL_TAB = {
  id: TERMINAL_ID,
  owner: workspaceTerminalOwner({ workspaceId: WORKSPACE }),
  title: 'pnpm dev',
  cwd: null,
  status: 'running',
  createdAt: 0,
} as const;

const PANELS: ReadonlyArray<OpenDrawer> = [
  { kind: 'browser', sessionId: LEDGER, payload: null },
  { kind: 'scripts', sessionId: LEDGER, payload: null },
  { kind: 'ask', sessionId: LEDGER, payload: null },
  { kind: 'terminal', sessionId: null, payload: { terminalId: TERMINAL_ID } },
];

const LEDGER_GRID: DrawerGrid = PANELS.reduce(
  (grid, entry) => gridAfterOpen({ grid, entry }),
  EMPTY_DRAWER_GRID,
);

type StateParams = {
  readonly scope: DockScopeState['dockScope'];
  readonly grid: DrawerGrid;
  readonly parked?: DockScopeState['parkedDockGrids'];
  readonly last?: DrawerGrid | null;
  readonly hasTerminal?: boolean;
};

const stateOf = ({ scope, grid, parked = {}, last = null, hasTerminal = true }: StateParams) => ({
  ...dockScopeInitialState,
  dockScope: scope,
  drawerGrid: grid,
  parkedDockGrids: parked,
  lastDockGrid: last,
  sessions: SESSIONS,
  terminalTabs: hasTerminal ? { [`ws:${WORKSPACE}`]: [TERMINAL_TAB] } : {},
});

const kindsOf = ({ grid }: { readonly grid: DrawerGrid | undefined }): ReadonlyArray<string> =>
  (grid?.columns ?? []).flat().map((panel) => panel.kind);

describe('a session that has no layout of its own starts from the last layout of the window', () => {
  it('opens the new session with the panels the last one left, bound to the new session', () => {
    const left = dockAfterPlace({
      state: stateOf({ scope: LEDGER, grid: LEDGER_GRID }),
      place: sessionPlace({ sessionId: NOTIFY }),
      drawer: null,
      back: null,
      now: NOW,
    });

    expect(left.lastDockGrid).toBe(LEDGER_GRID);
    const next = left.drawerGrid;
    expect([...kindsOf({ grid: next })].sort()).toEqual(['ask', 'browser', 'scripts', 'terminal']);
    expect(
      (next?.columns ?? [])
        .flat()
        .filter((panel) => panel.sessionId !== null && panel.kind !== 'terminal')
        .every((panel) => panel.sessionId === NOTIFY),
    ).toBe(true);
    expect(next?.focus).toEqual({ at: 'page' });
  });

  it('keeps the columns, the tab lists and the splits of the last layout', () => {
    const merged: DrawerGrid = {
      ...LEDGER_GRID,
      tabs: { browser: { keys: ['browser', 'ask'], active: 'ask' } },
      splits: { 'browser/scripts': 0.4 },
    };

    const next = dockAfterPlace({
      state: stateOf({ scope: LEDGER, grid: merged }),
      place: sessionPlace({ sessionId: NOTIFY }),
      drawer: null,
      back: null,
      now: NOW,
    }).drawerGrid;

    expect(next?.columns.map((column) => column.map((panel) => panel.kind))).toEqual(
      merged.columns.map((column) => column.map((panel) => panel.kind)),
    );
    expect(next?.tabs).toEqual(merged.tabs);
    expect(next?.splits).toEqual(merged.splits);
  });

  it('drops a terminal that belongs to another workspace and keeps the rest of the layout', () => {
    const next = dockAfterPlace({
      state: stateOf({ scope: LEDGER, grid: LEDGER_GRID }),
      place: sessionPlace({ sessionId: PAYMENTS }),
      drawer: null,
      back: null,
      now: NOW,
    }).drawerGrid;

    expect([...kindsOf({ grid: next })].sort()).toEqual(['ask', 'browser', 'scripts']);
  });

  it('drops a terminal whose tab is gone', () => {
    const next = dockAfterPlace({
      state: stateOf({ scope: LEDGER, grid: LEDGER_GRID, hasTerminal: false }),
      place: sessionPlace({ sessionId: NOTIFY }),
      drawer: null,
      back: null,
      now: NOW,
    }).drawerGrid;

    expect(kindsOf({ grid: next })).not.toContain('terminal');
  });

  it('starts a session opened from the board from the last session layout, not from the board', () => {
    const toBoard = dockAfterPlace({
      state: stateOf({ scope: LEDGER, grid: LEDGER_GRID }),
      place: BOARD_PLACE,
      drawer: null,
      back: null,
      now: NOW,
    });
    const boardState = {
      ...stateOf({ scope: null, grid: toBoard.drawerGrid ?? EMPTY_DRAWER_GRID }),
      lastDockGrid: toBoard.lastDockGrid ?? null,
      parkedDockGrids: toBoard.parkedDockGrids,
    };

    const next = dockAfterPlace({
      state: boardState,
      place: sessionPlace({ sessionId: NOTIFY }),
      drawer: null,
      back: null,
      now: NOW,
    });

    expect([...kindsOf({ grid: next.drawerGrid })].sort()).toEqual([
      'ask',
      'browser',
      'scripts',
      'terminal',
    ]);
    expect(next.lastDockGrid).toBe(toBoard.lastDockGrid);
  });

  it('gives a session its own parked layout before the last one', () => {
    const own: DrawerGrid = gridAfterOpen({
      grid: EMPTY_DRAWER_GRID,
      entry: { kind: 'ask', sessionId: NOTIFY, payload: null },
    });

    const next = dockAfterPlace({
      state: stateOf({
        scope: LEDGER,
        grid: LEDGER_GRID,
        parked: { [NOTIFY]: own },
      }),
      place: sessionPlace({ sessionId: NOTIFY }),
      drawer: null,
      back: null,
      now: NOW,
    });

    expect(next.drawerGrid).toEqual(own);
  });

  it('keeps a layout the user emptied empty when the session comes back', () => {
    const leaving = dockAfterPlace({
      state: stateOf({ scope: NOTIFY, grid: EMPTY_DRAWER_GRID, last: LEDGER_GRID }),
      place: sessionPlace({ sessionId: LEDGER }),
      drawer: null,
      back: null,
      now: NOW,
    });

    expect(leaving.parkedDockGrids?.[NOTIFY]).toBe(EMPTY_DRAWER_GRID);
    const back = dockAfterPlace({
      state: {
        ...stateOf({ scope: LEDGER, grid: LEDGER_GRID }),
        parkedDockGrids: leaving.parkedDockGrids ?? {},
        lastDockGrid: leaving.lastDockGrid ?? null,
      },
      place: sessionPlace({ sessionId: NOTIFY }),
      drawer: null,
      back: null,
      now: NOW,
    });

    expect(kindsOf({ grid: back.drawerGrid })).toEqual([]);
  });

  it('leaves a session that is not new empty, as before', () => {
    const next = dockAfterPlace({
      state: stateOf({ scope: NOTIFY, grid: LEDGER_GRID }),
      place: sessionPlace({ sessionId: LEDGER }),
      drawer: null,
      back: null,
      now: NOW,
    });

    expect(kindsOf({ grid: next.drawerGrid })).toEqual([]);
    expect(next.lastDockGrid).toBe(LEDGER_GRID);
  });

  it('starts empty when no session has been laid out yet', () => {
    const next = dockAfterPlace({
      state: stateOf({ scope: null, grid: EMPTY_DRAWER_GRID }),
      place: sessionPlace({ sessionId: NOTIFY }),
      drawer: null,
      back: null,
      now: NOW,
    });

    expect(kindsOf({ grid: next.drawerGrid })).toEqual([]);
  });

  it('writes nothing while the same place stays', () => {
    const next = dockAfterPlace({
      state: stateOf({ scope: LEDGER, grid: LEDGER_GRID, last: EMPTY_DRAWER_GRID }),
      place: sessionPlace({ sessionId: LEDGER }),
      drawer: null,
      back: null,
      now: NOW,
    });

    expect(next.lastDockGrid).toBe(EMPTY_DRAWER_GRID);
    expect(next.drawerGrid).toBeUndefined();
  });
});
