import { brandId, type SessionId, type WorkspaceId } from '@goodboy/types';
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

const SESSIONS = [
  sessionFixture({ id: LEDGER }),
  sessionFixture({ id: NOTIFY }),
  sessionFixture({ id: PAYMENTS, workspaceId: OTHER_WORKSPACE }),
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
  readonly hasTerminal?: boolean;
};

const stateOf = ({ scope, grid, hasTerminal = true }: StateParams) => ({
  ...dockScopeInitialState,
  dockScope: scope,
  drawerGrid: grid,
  sessions: SESSIONS,
  activeTerminalTab: {},
  terminalTabs: hasTerminal ? { [`ws:${WORKSPACE}`]: [TERMINAL_TAB] } : {},
});

const kindsOf = ({ grid }: { readonly grid: DrawerGrid | undefined }): ReadonlyArray<string> =>
  (grid?.columns ?? []).flat().map((panel) => panel.kind);

const enter = ({
  from,
  grid,
  to,
  hasTerminal,
}: {
  readonly from: DockScopeState['dockScope'];
  readonly grid: DrawerGrid;
  readonly to: SessionId | null;
  readonly hasTerminal?: boolean;
}) =>
  dockAfterPlace({
    state: stateOf({ scope: from, grid, hasTerminal }),
    place: to === null ? BOARD_PLACE : sessionPlace({ sessionId: to }),
    drawer: null,
    back: null,
  });

describe('the tools belong to the window, not to the place', () => {
  it('keeps every open tool when a session opens, bound to the new session', () => {
    const next = enter({ from: LEDGER, grid: LEDGER_GRID, to: NOTIFY }).drawerGrid;

    expect([...kindsOf({ grid: next })].sort()).toEqual(['ask', 'browser', 'scripts', 'terminal']);
    expect(
      (next?.columns ?? [])
        .flat()
        .filter((panel) => panel.sessionId !== null && panel.kind !== 'terminal')
        .every((panel) => panel.sessionId === NOTIFY),
    ).toBe(true);
  });

  it('keeps the tools open on Home and rebinds them to no session', () => {
    const next = enter({ from: LEDGER, grid: LEDGER_GRID, to: null }).drawerGrid;

    expect([...kindsOf({ grid: next })].sort()).toEqual(['ask', 'browser', 'scripts', 'terminal']);
    expect((next?.columns ?? []).flat().every((panel) => panel.sessionId === null)).toBe(true);
  });

  it('opens nothing and closes nothing on the way from Home into a session and back', () => {
    const home = gridAfterOpen({
      grid: EMPTY_DRAWER_GRID,
      entry: { kind: 'scripts', sessionId: null, payload: null },
    });
    const inside = enter({ from: null, grid: home, to: NOTIFY }).drawerGrid ?? EMPTY_DRAWER_GRID;
    const out = enter({ from: NOTIFY, grid: inside, to: null }).drawerGrid;

    expect(kindsOf({ grid: inside })).toEqual(['scripts']);
    expect(kindsOf({ grid: out })).toEqual(['scripts']);
  });

  it('keeps the columns, the tab lists and the splits', () => {
    const merged: DrawerGrid = {
      ...LEDGER_GRID,
      tabs: { browser: { keys: ['browser', 'ask'], active: 'ask' } },
      splits: { 'browser/scripts': 0.4 },
    };

    const next = enter({ from: LEDGER, grid: merged, to: NOTIFY }).drawerGrid;

    expect(next?.columns.map((column) => column.map((panel) => panel.kind))).toEqual(
      merged.columns.map((column) => column.map((panel) => panel.kind)),
    );
    expect(next?.tabs).toEqual(merged.tabs);
    expect(next?.splits).toEqual(merged.splits);
  });

  it('opens nothing in a session when the window has no tool open', () => {
    const next = enter({ from: null, grid: EMPTY_DRAWER_GRID, to: NOTIFY });

    expect(kindsOf({ grid: next.drawerGrid })).toEqual([]);
  });

  it('closes a terminal that belongs to another workspace and keeps the rest', () => {
    const next = enter({ from: LEDGER, grid: LEDGER_GRID, to: PAYMENTS }).drawerGrid;

    expect([...kindsOf({ grid: next })].sort()).toEqual(['ask', 'browser', 'scripts']);
  });

  it('closes a terminal whose tab is gone', () => {
    const next = enter({
      from: LEDGER,
      grid: LEDGER_GRID,
      to: NOTIFY,
      hasTerminal: false,
    }).drawerGrid;

    expect(kindsOf({ grid: next })).not.toContain('terminal');
  });

  it('shows the workspace shell when the terminal pointed at a shell of the session left', () => {
    const sessionShell = brandId<TerminalTabId>({ value: `${LEDGER}::t1` });
    const grid = gridAfterOpen({
      grid: EMPTY_DRAWER_GRID,
      entry: { kind: 'terminal', sessionId: null, payload: { terminalId: sessionShell } },
    });
    const tab = {
      ...TERMINAL_TAB,
      id: sessionShell,
      owner: { kind: 'session', sessionId: LEDGER },
    } as const;
    const next = dockAfterPlace({
      state: {
        ...stateOf({ scope: LEDGER, grid }),
        terminalTabs: { [`ws:${WORKSPACE}`]: [TERMINAL_TAB], [LEDGER]: [tab] },
      },
      place: BOARD_PLACE,
      drawer: null,
      back: null,
    }).drawerGrid?.columns.flat()[0];

    expect(next).toEqual({
      kind: 'terminal',
      sessionId: null,
      payload: { terminalId: TERMINAL_ID },
    });
  });

  it('writes nothing while the same place stays', () => {
    const next = enter({ from: LEDGER, grid: LEDGER_GRID, to: LEDGER });

    expect(next.drawerGrid).toBeUndefined();
  });
});
