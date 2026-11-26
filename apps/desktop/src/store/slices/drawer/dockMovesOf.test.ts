import { describe, expect, it } from 'vitest';
import { brandId, type SessionId } from '@goodboy/types';
import type { TerminalTabId } from '../../../shared/types/terminal';
import { dockMovesOf } from './dockMovesOf';
import { EMPTY_DRAWER_GRID, type DrawerGrid, type OpenDrawer } from './state';

const TERMINAL: OpenDrawer = {
  kind: 'terminal',
  sessionId: null,
  payload: { terminalId: brandId<TerminalTabId>({ value: 'tab-harborline' }) },
};

const BROWSER: OpenDrawer = { kind: 'browser', sessionId: null, payload: null };

const SESSION = brandId<SessionId>({ value: 'session-ledger-core' });

const SCRIPTS: OpenDrawer = { kind: 'scripts', sessionId: SESSION, payload: null };

const MONITOR: OpenDrawer = { kind: 'monitoring', sessionId: null, payload: null };

const ASK: OpenDrawer = { kind: 'ask', sessionId: SESSION, payload: null };

const FIVE: DrawerGrid = {
  ...EMPTY_DRAWER_GRID,
  columns: [[TERMINAL], [BROWSER], [SCRIPTS, MONITOR], [ASK]],
};

const STACKED: DrawerGrid = { ...EMPTY_DRAWER_GRID, columns: [[BROWSER, TERMINAL]] };

type FitParams = {
  readonly columns: ReadonlyArray<ReadonlyArray<string>>;
};

const onlyOneColumn = ({ columns }: FitParams): boolean => columns.length === 1;

describe('the moves a panel has', () => {
  it('offers every distinct place once, and never the place it already has', () => {
    const targets = dockMovesOf({ grid: STACKED, kind: 'terminal', fits: () => true }).map(
      (move) => move.target,
    );

    expect(targets).toEqual([
      { at: 'tab', key: 'browser' },
      { at: 'above', key: 'browser' },
      { at: 'beside', key: 'browser', side: 'before' },
      { at: 'beside', key: 'browser', side: 'after' },
    ]);
  });

  it('marks the moves the dock says would not fit', () => {
    const moves = dockMovesOf({ grid: STACKED, kind: 'terminal', fits: onlyOneColumn });

    expect(moves.filter((move) => move.isFitting).map((move) => move.target)).toEqual([
      { at: 'tab', key: 'browser' },
      { at: 'above', key: 'browser' },
    ]);
  });

  it('offers a tab to tear out its own place and to merge into another cell', () => {
    const tabbed: DrawerGrid = {
      ...EMPTY_DRAWER_GRID,
      columns: [[TERMINAL, SCRIPTS], [BROWSER]],
      tabs: { terminal: { keys: ['terminal', 'scripts'], active: 'terminal' } },
    };

    const targets = dockMovesOf({ grid: tabbed, kind: 'scripts', fits: () => true }).map(
      (move) => move.target,
    );

    expect(targets).toEqual(
      expect.arrayContaining([
        { at: 'tab', key: 'browser' },
        { at: 'above', key: 'terminal' },
        { at: 'beside', key: 'terminal', side: 'before' },
      ]),
    );
    expect(targets).not.toContainEqual({ at: 'tab', key: 'terminal' });
  });

  it.each(['terminal', 'browser', 'scripts', 'monitoring', 'ask'] as const)(
    'offers the %s panel moves that name a panel of the grid',
    (kind) => {
      const moves = dockMovesOf({ grid: FIVE, kind, fits: () => true });
      const others = FIVE.columns.flat().map((panel) => panel.kind);

      expect(moves.length).toBeGreaterThan(0);
      for (const { target } of moves) {
        if (target.at !== 'page') {
          expect(others).toContain(target.key);
          expect(target.key).not.toBe(kind);
        }
      }
    },
  );
});
