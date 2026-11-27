import { describe, expect, it } from 'vitest';
import { cellTabsOf } from '../dockCellTabsOf';
import { dockMergedCellOf } from '../dockMergedCellOf';
import { unmeasuredDockGridOf } from '../unmeasuredDockGridOf';
import type { DockGridCell, DockGridSpec } from '../dockGridSpec';
import { dockLayoutOf, type DockColumn, type DockPane } from '../dockLayout';
import { READER_DRAWER_DEFAULT, RIGHT_DRAWER_DEFAULT } from '../drawerGeometry';

const TERMINAL_CELL: DockGridCell = {
  key: 'terminal',
  sizing: 'side',
  rowMin: 200,
  label: 'Terminal',
};
const SCRIPTS_CELL: DockGridCell = {
  key: 'scripts',
  sizing: 'side',
  rowMin: 180,
  label: 'Scripts',
};
const BROWSER_CELL: DockGridCell = {
  key: 'browser',
  sizing: 'browser',
  rowMin: 240,
  label: 'Browser',
  savedWidth: READER_DRAWER_DEFAULT,
};

const TABBED: DockGridCell = {
  ...TERMINAL_CELL,
  tabs: { keys: ['terminal', 'scripts'], active: 'scripts', members: [SCRIPTS_CELL] },
};

const specOf = (columns: DockGridSpec['columns']): DockGridSpec => ({
  columns,
  focus: 'page',
  onFocus: () => undefined,
});

const paneOf = (cell: DockGridCell): DockPane => ({
  id: cell.key,
  sizing: cell.sizing,
  savedWidth: cell.savedWidth ?? RIGHT_DRAWER_DEFAULT,
  ...(cell.rowMin !== undefined && { rowMin: cell.rowMin }),
  ...(cell.tabs !== undefined && { tabs: cell.tabs.keys }),
});

const deskOf = (columns: ReadonlyArray<DockColumn>) =>
  dockLayoutOf({
    windowWidth: 1800,
    windowHeight: 900,
    top: 0,
    leftRailWidth: 0,
    toolRailWidth: 0,
    detail: null,
    columns,
  });

describe('a cell with a chosen tab list', () => {
  it('keeps the chosen tabs in its pane when nothing folds', () => {
    const layout = deskOf([{ panes: [paneOf(dockMergedCellOf({ cell: TABBED }))] }]);

    expect(layout.mode).toBe('push');
    expect(layout.columns.map((column) => column.panes.map((pane) => pane.tabs))).toEqual([
      [['terminal', 'scripts']],
    ]);
  });

  it('takes the widest sizing and the tallest row minimum of its members', () => {
    const wide: DockGridCell = {
      ...TERMINAL_CELL,
      tabs: { keys: ['terminal', 'browser'], active: 'terminal', members: [BROWSER_CELL] },
    };

    const merged = dockMergedCellOf({ cell: wide });

    expect(merged).toMatchObject({
      sizing: 'browser',
      rowMin: 240,
      savedWidth: READER_DRAWER_DEFAULT,
    });
  });

  it('keeps the width the cell saved, not the width of a member', () => {
    const wide: DockGridCell = {
      ...TERMINAL_CELL,
      savedWidth: 430,
      tabs: { keys: ['terminal', 'browser'], active: 'terminal', members: [BROWSER_CELL] },
    };

    expect(dockMergedCellOf({ cell: wide }).savedWidth).toBe(430);
  });

  it('adds a fold on top of the chosen tabs, never in place of them', () => {
    const monitor: DockPane = {
      id: 'monitoring',
      sizing: 'side',
      savedWidth: RIGHT_DRAWER_DEFAULT,
    };
    const layout = dockLayoutOf({
      windowWidth: 800,
      windowHeight: 900,
      top: 0,
      leftRailWidth: 0,
      toolRailWidth: 0,
      foldOrder: ['monitoring', 'browser', 'terminal'],
      detail: null,
      columns: [
        { panes: [paneOf(dockMergedCellOf({ cell: TABBED }))] },
        { panes: [paneOf(BROWSER_CELL)] },
        { panes: [monitor] },
      ],
    });

    const tabs = layout.columns.flatMap((column) => column.panes.map((pane) => pane.tabs ?? []));
    const holder = tabs.find((list) => list.includes('terminal'));
    expect(holder).toEqual(expect.arrayContaining(['terminal', 'scripts']));
    expect(tabs.flat()).toEqual(expect.arrayContaining(['monitoring', 'browser']));
  });
});

describe('cellTabsOf', () => {
  const spec = specOf([[TABBED], [BROWSER_CELL]]);

  it('lists the tabs of the cell, the one the user chose shown while focus is elsewhere', () => {
    const view = cellTabsOf({
      spec,
      pane: { key: 'terminal', tabs: ['terminal', 'scripts'] },
      focus: 'page',
    });

    expect(view).toMatchObject({
      keys: ['terminal', 'scripts'],
      count: 2,
      shown: 'scripts',
      isTabbed: true,
      isDerived: false,
    });
    expect(view.options.map((option) => option.label)).toEqual(['Terminal', 'Scripts']);
  });

  it('follows the focus into a tab of the cell before the chosen one', () => {
    const view = cellTabsOf({
      spec,
      pane: { key: 'terminal', tabs: ['terminal', 'scripts'] },
      focus: 'terminal',
    });

    expect(view.shown).toBe('terminal');
  });

  it('drops a key that is no longer in the grid, and falls back to the cell key', () => {
    const closed = specOf([
      [
        {
          ...TERMINAL_CELL,
          tabs: { keys: ['terminal', 'scripts'], active: 'scripts', members: [] },
        },
      ],
    ]);

    const view = cellTabsOf({
      spec: closed,
      pane: { key: 'terminal', tabs: ['terminal', 'scripts'] },
      focus: 'page',
    });

    expect(view).toMatchObject({
      keys: ['terminal'],
      count: 1,
      shown: 'terminal',
      isTabbed: false,
    });
  });

  it('calls a tab the solver folded derived, and a chosen one not', () => {
    const derived = cellTabsOf({
      spec: specOf([[TERMINAL_CELL, SCRIPTS_CELL]]),
      pane: { key: 'terminal', tabs: ['terminal', 'scripts'] },
      focus: 'page',
    });

    expect(derived.isDerived).toBe(true);
  });

  it('marks a tab with activity unless it is the shown one', () => {
    const busy = specOf([
      [
        {
          ...TERMINAL_CELL,
          tabs: {
            keys: ['terminal', 'scripts'],
            active: 'terminal',
            members: [{ ...SCRIPTS_CELL, hasActivity: true }],
          },
        },
      ],
    ]);

    const view = cellTabsOf({
      spec: busy,
      pane: { key: 'terminal', tabs: ['terminal', 'scripts'] },
      focus: 'page',
    });

    expect(view.options.map((option) => option.badge !== undefined)).toEqual([false, true]);
  });
});

describe('a grid not measured yet', () => {
  it('draws the chosen tabs of a cell from the first frame', () => {
    const frame = unmeasuredDockGridOf({
      columns: [[dockMergedCellOf({ cell: TABBED })], [BROWSER_CELL]],
      savedWidthOf: () => 420,
      detail: { width: 0, dragMax: 0 },
      placement: 'auto',
    });

    expect(frame.columns.map((column) => column.panes.map((pane) => pane.tabs))).toEqual([
      [['terminal', 'scripts']],
      [undefined],
    ]);
  });
});
