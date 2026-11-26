import { describe, expect, it } from 'vitest';
import { dockLayoutAfterMove, type DockGroups } from '../dockLayoutAfterMove';
import type { DockMoveTarget, DockMoveUnit } from '../dockMoveTarget';

type Columns = ReadonlyArray<ReadonlyArray<string>>;

type MoveParams = {
  readonly columns: Columns;
  readonly groups?: DockGroups;
  readonly key: string;
  readonly unit?: DockMoveUnit;
  readonly target: DockMoveTarget;
};

const move = ({ columns, groups = {}, key, unit = 'cell', target }: MoveParams) =>
  dockLayoutAfterMove({ columns, groups, key, unit, target });

const PAIR: Columns = [['terminal'], ['browser']];

const TABBED: DockGroups = { terminal: ['terminal', 'scripts', 'ask'] };

describe('a cell merged into another', () => {
  it('takes the panel as a tab and leaves its old column', () => {
    expect(move({ columns: PAIR, key: 'browser', target: { at: 'tab', key: 'terminal' } })).toEqual(
      { columns: [['terminal']], groups: { terminal: ['terminal', 'browser'] } },
    );
  });

  it('brings every tab of a merged cell along', () => {
    expect(
      move({
        columns: [['terminal'], ['browser']],
        groups: { browser: ['browser', 'monitoring'] },
        key: 'browser',
        target: { at: 'tab', key: 'terminal' },
      }),
    ).toEqual({
      columns: [['terminal']],
      groups: { terminal: ['terminal', 'browser', 'monitoring'] },
    });
  });

  it('adds to the tab list a cell already holds', () => {
    expect(
      move({
        columns: [['terminal'], ['browser']],
        groups: TABBED,
        key: 'browser',
        target: { at: 'tab', key: 'terminal' },
      })?.groups,
    ).toEqual({ terminal: ['terminal', 'scripts', 'ask', 'browser'] });
  });

  it('refuses a merge into itself', () => {
    expect(
      move({ columns: PAIR, key: 'terminal', target: { at: 'tab', key: 'terminal' } }),
    ).toBeNull();
  });
});

describe('a tab torn out of a cell', () => {
  it('goes to a column of its own and leaves the other tabs together', () => {
    expect(
      move({
        columns: [['terminal'], ['browser']],
        groups: TABBED,
        key: 'ask',
        unit: 'panel',
        target: { at: 'beside', key: 'browser', side: 'after' },
      }),
    ).toEqual({
      columns: [['terminal'], ['browser'], ['ask']],
      groups: { terminal: ['terminal', 'scripts'] },
    });
  });

  it('leaves a plain cell when one tab is left', () => {
    expect(
      move({
        columns: [['terminal'], ['browser']],
        groups: { terminal: ['terminal', 'scripts'] },
        key: 'scripts',
        unit: 'panel',
        target: { at: 'below', key: 'browser' },
      }),
    ).toEqual({ columns: [['terminal'], ['browser', 'scripts']], groups: {} });
  });

  it('hands the cell to the next tab when the first one leaves', () => {
    expect(
      move({
        columns: [['terminal'], ['browser']],
        groups: TABBED,
        key: 'terminal',
        unit: 'panel',
        target: { at: 'below', key: 'browser' },
      }),
    ).toEqual({
      columns: [['scripts'], ['browser', 'terminal']],
      groups: { scripts: ['scripts', 'ask'] },
    });
  });

  it('can be placed above its own cell', () => {
    expect(
      move({
        columns: [['terminal'], ['browser']],
        groups: TABBED,
        key: 'ask',
        unit: 'panel',
        target: { at: 'above', key: 'terminal' },
      }),
    ).toEqual({
      columns: [['ask', 'terminal'], ['browser']],
      groups: { terminal: ['terminal', 'scripts'] },
    });
  });

  it('merges into another cell', () => {
    expect(
      move({
        columns: [['terminal'], ['browser']],
        groups: TABBED,
        key: 'ask',
        unit: 'panel',
        target: { at: 'tab', key: 'browser' },
      }),
    ).toEqual({
      columns: [['terminal'], ['browser']],
      groups: { terminal: ['terminal', 'scripts'], browser: ['browser', 'ask'] },
    });
  });

  it('does not swap and does not merge back into its own cell', () => {
    const own = { columns: PAIR, groups: TABBED, key: 'ask', unit: 'panel' } as const;
    expect(move({ ...own, target: { at: 'swap', key: 'browser' } })).toBeNull();
    expect(move({ ...own, target: { at: 'tab', key: 'terminal' } })).toBeNull();
  });

  it('moves the whole cell with its tabs when the unit is the cell', () => {
    expect(
      move({
        columns: PAIR,
        groups: TABBED,
        key: 'terminal',
        target: { at: 'swap', key: 'browser' },
      }),
    ).toEqual({ columns: [['browser'], ['terminal']], groups: TABBED });
  });
});

describe('a merge that keeps the tabs the solver folded into its target', () => {
  it('lands the dragged cell in the target cell with the folded tabs, and nowhere else', () => {
    const after = dockLayoutAfterMove({
      columns: [['browser'], ['monitoring'], ['terminal']],
      groups: {},
      key: 'terminal',
      unit: 'cell',
      target: { at: 'tab', key: 'monitoring', keeps: ['browser'] },
    });

    expect(after).toEqual({
      columns: [['monitoring']],
      groups: { monitoring: ['monitoring', 'browser', 'terminal'] },
    });
  });

  it('is the plain merge when nothing is folded into the target', () => {
    const after = dockLayoutAfterMove({
      columns: [['browser'], ['monitoring'], ['terminal']],
      groups: {},
      key: 'terminal',
      unit: 'cell',
      target: { at: 'tab', key: 'monitoring' },
    });

    expect(after?.columns).toEqual([['browser'], ['monitoring']]);
    expect(after?.groups).toEqual({ monitoring: ['monitoring', 'terminal'] });
  });
});
