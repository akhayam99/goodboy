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

type TargetsParams = {
  readonly windowWidth: number;
};

const fittingTargets = ({ windowWidth }: TargetsParams) =>
  dockMovesOf({ grid: STACKED, kind: 'terminal', windowWidth, detail: null })
    .filter((move) => move.isFitting)
    .map((move) => move.target);

describe('the moves a panel has', () => {
  it('offers every distinct place once, and the stack it already has never', () => {
    const targets = dockMovesOf({
      grid: STACKED,
      kind: 'terminal',
      windowWidth: 1920,
      detail: null,
    }).map((move) => move.target);

    expect(targets).toEqual([
      { at: 'swap', key: 'browser' },
      { at: 'beside', key: 'browser', side: 'before' },
      { at: 'beside', key: 'browser', side: 'after' },
    ]);
  });

  it('keeps the side by side moves on a wide window', () => {
    expect(fittingTargets({ windowWidth: 1920 })).toContainEqual({
      at: 'beside',
      key: 'browser',
      side: 'after',
    });
  });

  it('drops the side by side moves where the page would lose its room', () => {
    [1280, 1440, 1600].forEach((windowWidth) => {
      expect(fittingTargets({ windowWidth })).toEqual([{ at: 'swap', key: 'browser' }]);
    });
  });
});
