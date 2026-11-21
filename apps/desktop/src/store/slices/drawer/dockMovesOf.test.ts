import { describe, expect, it } from 'vitest';
import { brandId } from '@goodboy/types';
import type { TerminalTabId } from '../../../shared/types/terminal';
import { dockMovesOf } from './dockMovesOf';
import { EMPTY_DRAWER_GRID, type DrawerGrid, type OpenDrawer } from './state';

const TERMINAL: OpenDrawer = {
  kind: 'terminal',
  sessionId: null,
  payload: { terminalId: brandId<TerminalTabId>({ value: 'tab-harborline' }) },
};

const BROWSER: OpenDrawer = { kind: 'browser', sessionId: null, payload: null };

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
      { at: 'swap', key: 'browser' },
      { at: 'beside', key: 'browser', side: 'before' },
      { at: 'beside', key: 'browser', side: 'after' },
    ]);
  });

  it('marks the moves the dock says would not fit', () => {
    const moves = dockMovesOf({ grid: STACKED, kind: 'terminal', fits: onlyOneColumn });

    expect(moves.filter((move) => move.isFitting).map((move) => move.target)).toEqual([
      { at: 'swap', key: 'browser' },
    ]);
  });
});
