import { describe, expect, it } from 'vitest';
import { brandId, type SessionId } from '@goodboy/types';
import type { TerminalTabId } from '../../../../shared/types/terminal';
import { gridAfterOpen } from '../gridAfterOpen';
import { shellPanelsOf } from '../shellPanelsOf';
import { gridWithout } from '../gridWithout';
import { EMPTY_DRAWER_GRID, type DrawerGrid, type OpenDrawer } from '../state';
import { gridWithLayout } from './gridWithLayout';
import { layoutOf } from './layoutOf';
import { tabGroupsOf } from './tabGroupsOf';

const SESSION = brandId<SessionId>({ value: 'session-ledger-core' });

const TERMINAL: OpenDrawer = {
  kind: 'terminal',
  sessionId: null,
  payload: { terminalId: brandId<TerminalTabId>({ value: 'tab-harborline' }) },
};
const BROWSER: OpenDrawer = { kind: 'browser', sessionId: null, payload: null };
const MONITOR: OpenDrawer = { kind: 'monitoring', sessionId: null, payload: null };
const SCRIPTS: OpenDrawer = { kind: 'scripts', sessionId: SESSION, payload: null };
const ASK: OpenDrawer = { kind: 'ask', sessionId: SESSION, payload: null };

const MERGED: DrawerGrid = {
  ...EMPTY_DRAWER_GRID,
  columns: [[TERMINAL, SCRIPTS, ASK], [BROWSER]],
  used: ['browser', 'terminal', 'scripts', 'ask'],
  tabs: { terminal: { keys: ['terminal', 'scripts', 'ask'], active: 'scripts' } },
};

const kindsOf = ({ grid }: { readonly grid: DrawerGrid }) =>
  grid.columns.map((column) => column.map((panel) => panel.kind));

describe('the tab lists of the dock grid', () => {
  it('hides the members of a cell from the layout and keeps them open', () => {
    const layout = layoutOf({ columns: MERGED.columns, tabs: MERGED.tabs });

    expect(layout.columns.map((column) => column.map((panel) => panel.kind))).toEqual([
      ['terminal'],
      ['browser'],
    ]);
    expect(layout.hidden.map((panel) => panel.kind)).toEqual(['scripts', 'ask']);
    expect(tabGroupsOf({ tabs: MERGED.tabs })).toEqual({
      terminal: ['terminal', 'scripts', 'ask'],
    });
  });

  it('writes a moved layout back with each member behind its lead', () => {
    const next = gridWithLayout({
      grid: MERGED,
      layout: {
        columns: [['browser'], ['terminal']],
        groups: { terminal: ['terminal', 'scripts', 'ask'] },
      },
      active: null,
    });

    expect(kindsOf({ grid: next })).toEqual([['browser'], ['terminal', 'scripts', 'ask']]);
    expect(next.tabs?.terminal?.active).toBe('scripts');
  });

  it('keeps no tab list for a cell with one tab', () => {
    const next = gridWithLayout({
      grid: MERGED,
      layout: { columns: [['terminal'], ['browser']], groups: { terminal: ['terminal'] } },
      active: null,
    });

    expect(next.tabs).toBeUndefined();
  });

  it('closes a member and keeps the rest of the cell', () => {
    const next = gridWithout({ grid: MERGED, kinds: ['ask'] });

    expect(next.tabs).toEqual({ terminal: { keys: ['terminal', 'scripts'], active: 'scripts' } });
  });

  it('hands the cell to the next tab when the lead closes, and drops a list of one', () => {
    const handed = gridWithout({ grid: MERGED, kinds: ['terminal'] });
    const plain = gridWithout({ grid: handed, kinds: ['ask'] });

    expect(handed.tabs).toEqual({ scripts: { keys: ['scripts', 'ask'], active: 'scripts' } });
    expect(layoutOf({ columns: handed.columns, tabs: handed.tabs }).columns.flat()[0]?.kind).toBe(
      'scripts',
    );
    expect(plain.tabs).toBeUndefined();
  });

  it('opens a new tool beside the cells, counting a cell with tabs once', () => {
    const next = gridAfterOpen({ grid: MERGED, entry: MONITOR });

    expect(kindsOf({ grid: next })).toEqual([
      ['terminal', 'scripts', 'ask'],
      ['browser'],
      ['monitoring'],
    ]);
    expect(next.tabs).toEqual(MERGED.tabs);
  });

  it('hands a cell to its next tab while a Studio of the lead is the page', () => {
    const panels = shellPanelsOf({
      state: {
        drawer: null,
        drawerBack: null,
        drawerGrid: MERGED,
        currentSessionId: null,
        appStudio: { kind: 'terminal', terminalId: null, sessionId: null },
      },
    });

    expect(panels.layout.map((column) => column.map((panel) => panel.kind))).toEqual([
      ['scripts'],
      ['browser'],
    ]);
    expect(panels.tools.flat().map((panel) => panel.kind)).toEqual(['scripts', 'ask', 'browser']);
    expect(MERGED.tabs).toEqual({
      terminal: { keys: ['terminal', 'scripts', 'ask'], active: 'scripts' },
    });
  });
});
