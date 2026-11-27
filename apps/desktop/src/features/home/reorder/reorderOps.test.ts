import { describe, expect, it } from 'vitest';
import { HOME_WIDGETS, type HomeWidgetId } from '../grid/homeWidgets';
import { moveHomeWidget } from '../layout/moveHomeWidget';
import { resizeHomeWidget } from '../layout/resizeHomeWidget';
import { sizesAvailableOf } from '../layout/sizesAvailableOf';
import { snapSizeOf } from '../layout/snapSizeOf';
import { stepMoveOf } from '../layout/stepMoveOf';
import { stepSizeOf } from '../layout/stepSizeOf';
import { autoScrollSpeedOf } from './autoScrollSpeedOf';
import { dropTargetOf } from './dropTargetOf';
import { hasLeft, isSwapAllowed } from './isSwapAllowed';
import { nearestInDirectionOf } from './nearestInDirectionOf';
import { orderAfterMove } from './orderAfterMove';
import type { CellRect } from './reorderTypes';

const IDS: ReadonlyArray<HomeWidgetId> = ['needsYou', 'spend', 'providerLimits', 'tasksInbox'];

const entriesOf = (ids: ReadonlyArray<HomeWidgetId>) =>
  ids.map((id) => ({ id, size: HOME_WIDGETS[id].defaultSize }));

describe('moveHomeWidget', () => {
  it('puts a card before another, or last, and gives back the neighbour Undo needs', () => {
    const moved = moveHomeWidget({ entries: entriesOf(IDS), id: 'tasksInbox', beforeId: 'spend' });

    expect(moved?.entries.map((entry) => entry.id)).toEqual([
      'needsYou',
      'tasksInbox',
      'spend',
      'providerLimits',
    ]);
    expect(moved?.beforeId).toBeNull();
    const last = moveHomeWidget({ entries: entriesOf(IDS), id: 'needsYou', beforeId: null });
    expect(last?.entries.map((entry) => entry.id)).toEqual([
      'spend',
      'providerLimits',
      'tasksInbox',
      'needsYou',
    ]);
    expect(last?.beforeId).toBe('spend');
  });

  it('is a no-op for the same place and for an unknown card', () => {
    expect(
      moveHomeWidget({ entries: entriesOf(IDS), id: 'spend', beforeId: 'providerLimits' }),
    ).toBeNull();
    expect(moveHomeWidget({ entries: entriesOf(IDS), id: 'spend', beforeId: 'spend' })).toBeNull();
    expect(
      moveHomeWidget({ entries: entriesOf(IDS), id: 'runningNow', beforeId: null }),
    ).toBeNull();
  });
});

describe('resize ops', () => {
  it('resizes to a supported size and remembers the old one', () => {
    const result = resizeHomeWidget({ entries: entriesOf(IDS), id: 'spend', size: 'L' });

    expect(result?.previous).toBe(HOME_WIDGETS.spend.defaultSize);
    expect(result?.entries.find((entry) => entry.id === 'spend')?.size).toBe('L');
  });

  it('refuses a size the card does not offer and a size it already has', () => {
    expect(sizesAvailableOf({ id: 'longRunning' })).not.toContain('L');
    expect(
      resizeHomeWidget({ entries: entriesOf(['longRunning']), id: 'longRunning', size: 'L' }),
    ).toBeNull();
    expect(
      resizeHomeWidget({
        entries: entriesOf(IDS),
        id: 'spend',
        size: HOME_WIDGETS.spend.defaultSize,
      }),
    ).toBeNull();
  });

  it('cycles with a wrap and steps without one', () => {
    const sizes = sizesAvailableOf({ id: 'needsYou' });
    const first = sizes[0] ?? 'S';
    const last = sizes[sizes.length - 1] ?? 'L';

    expect(stepSizeOf({ id: 'needsYou', size: last, step: 1, isWrapping: true })).toBe(first);
    expect(stepSizeOf({ id: 'needsYou', size: last, step: 1, isWrapping: false })).toBe(last);
    expect(stepSizeOf({ id: 'needsYou', size: first, step: -1, isWrapping: true })).toBe(last);
    expect(stepSizeOf({ id: 'needsYou', size: first, step: -1, isWrapping: false })).toBe(first);
  });
});

describe('snapSizeOf', () => {
  it('snaps to S, M and L with a hysteresis of a quarter column on each boundary', () => {
    const snap = (span: number, current: 'S' | 'M' | 'L') =>
      snapSizeOf({ id: 'needsYou', columns: 4, span, current });

    expect(snap(1, 'M')).toBe('S');
    expect(snap(2, 'S')).toBe('M');
    expect(snap(3.2, 'M')).toBe('M');
    expect(snap(3.3, 'M')).toBe('L');
    expect(snap(2.8, 'L')).toBe('L');
    expect(snap(2.7, 'L')).toBe('M');
  });

  it('stops at the largest size a card offers', () => {
    expect(snapSizeOf({ id: 'longRunning', columns: 4, span: 4, current: 'M' })).toBe('M');
  });

  it('treats M and L as one footprint on two columns', () => {
    expect(snapSizeOf({ id: 'needsYou', columns: 2, span: 2, current: 'M' })).toBe('M');
    expect(snapSizeOf({ id: 'needsYou', columns: 2, span: 2, current: 'L' })).toBe('L');
  });
});

describe('stepMoveOf', () => {
  it('names the neighbour a card goes before, and its new position', () => {
    expect(stepMoveOf({ ids: IDS, id: 'spend', step: -1 })).toEqual({
      beforeId: 'needsYou',
      position: 1,
    });
    expect(stepMoveOf({ ids: IDS, id: 'spend', step: 1 })).toEqual({
      beforeId: 'tasksInbox',
      position: 3,
    });
    expect(stepMoveOf({ ids: IDS, id: 'providerLimits', step: 1 })).toEqual({
      beforeId: null,
      position: 4,
    });
    expect(stepMoveOf({ ids: IDS, id: 'needsYou', step: -1 })).toBeNull();
  });
});

describe('orderAfterMove', () => {
  it('moves one id to an index', () => {
    expect(orderAfterMove({ ids: IDS, id: 'needsYou', toIndex: 2 })).toEqual([
      'spend',
      'providerLimits',
      'needsYou',
      'tasksInbox',
    ]);
    expect(orderAfterMove({ ids: IDS, id: 'tasksInbox', toIndex: -4 })[0]).toBe('tasksInbox');
  });
});

const cell = (
  id: HomeWidgetId,
  left: number,
  top: number,
  width: number,
  height: number,
): CellRect => ({
  id,
  rect: { left, top, width, height },
});

describe('dropTargetOf', () => {
  const cells = [
    cell('needsYou', 0, 0, 100, 100),
    cell('spend', 112, 0, 100, 100),
    cell('providerLimits', 0, 112, 212, 100),
  ];

  it('swaps only inside the inner 60% of a card', () => {
    const at = (x: number, y: number) =>
      dropTargetOf({
        cells,
        ids: ['needsYou', 'spend', 'providerLimits'],
        draggedId: 'needsYou',
        pointer: { x, y },
        gridWidth: 212,
      });

    expect(at(162, 50)).toBe('spend');
    expect(at(116, 50)).toBeNull();
    expect(at(162, 3)).toBeNull();
  });

  it('never targets the card that is dragged', () => {
    expect(
      dropTargetOf({
        cells,
        ids: ['needsYou', 'spend', 'providerLimits'],
        draggedId: 'needsYou',
        pointer: { x: 50, y: 50 },
        gridWidth: 212,
      }),
    ).toBeNull();
  });

  it('decides a full width card by its vertical middle, on the side the pointer came from', () => {
    const ids: ReadonlyArray<HomeWidgetId> = ['needsYou', 'spend', 'providerLimits'];
    const down = (y: number) =>
      dropTargetOf({ cells, ids, draggedId: 'needsYou', pointer: { x: 20, y }, gridWidth: 212 });
    const up = (y: number) =>
      dropTargetOf({
        cells,
        ids,
        draggedId: 'providerLimits',
        pointer: { x: 20, y },
        gridWidth: 212,
      });

    expect(down(120)).toBeNull();
    expect(down(170)).toBe('providerLimits');
    expect(up(40)).toBe('needsYou');
  });
});

describe('the swap guard', () => {
  const swap = { targetId: 'spend', at: 1000, isExited: false } as const;

  it('allows another card at once and the same card only after the pointer left it and 120 ms passed', () => {
    expect(isSwapAllowed({ last: null, targetId: 'spend', now: 1000 })).toBe(true);
    expect(isSwapAllowed({ last: swap, targetId: 'tasksInbox', now: 1010 })).toBe(true);
    expect(isSwapAllowed({ last: swap, targetId: 'spend', now: 5000 })).toBe(false);
    expect(isSwapAllowed({ last: { ...swap, isExited: true }, targetId: 'spend', now: 1100 })).toBe(
      false,
    );
    expect(isSwapAllowed({ last: { ...swap, isExited: true }, targetId: 'spend', now: 1120 })).toBe(
      true,
    );
  });

  it('counts the pointer as gone after 8px outside the card', () => {
    const rect = { left: 100, top: 100, width: 100, height: 100 };

    expect(hasLeft({ rect, pointer: { x: 95, y: 150 } })).toBe(false);
    expect(hasLeft({ rect, pointer: { x: 91, y: 150 } })).toBe(true);
    expect(hasLeft({ rect, pointer: { x: 150, y: 209 } })).toBe(true);
  });
});

describe('autoScrollSpeedOf', () => {
  const box = { top: 0, bottom: 600 };

  it('ramps from 0 at the zone edge to 18px a frame at the page edge, and is 0 elsewhere', () => {
    expect(autoScrollSpeedOf({ pointerY: 300, ...box })).toBe(0);
    expect(autoScrollSpeedOf({ pointerY: 544, ...box })).toBe(0);
    expect(autoScrollSpeedOf({ pointerY: 600, ...box })).toBe(18);
    expect(autoScrollSpeedOf({ pointerY: 0, ...box })).toBe(-18);
    expect(autoScrollSpeedOf({ pointerY: 572, ...box })).toBeCloseTo(4.5);
  });
});

describe('nearestInDirectionOf', () => {
  const cells = [
    cell('needsYou', 0, 0, 100, 100),
    cell('spend', 112, 0, 100, 100),
    cell('providerLimits', 0, 112, 100, 100),
    cell('tasksInbox', 112, 112, 100, 100),
  ];

  it('finds the card directly under or over, and none at the edge of the grid', () => {
    expect(nearestInDirectionOf({ cells, id: 'needsYou', direction: 'down' })).toBe(
      'providerLimits',
    );
    expect(nearestInDirectionOf({ cells, id: 'tasksInbox', direction: 'up' })).toBe('spend');
    expect(nearestInDirectionOf({ cells, id: 'needsYou', direction: 'up' })).toBeNull();
  });
});
