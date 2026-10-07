import { describe, expect, it } from 'vitest';
import {
  RAIL_COUNT_RADIUS,
  railColumnX,
  type RailRow,
  type RailSegment,
} from '../../../workTreeModel/railGeometry';
import { rowSlotWidth } from './rowSlotWidth';

const RAIL_WIDTH = 48;

const railAt = ({
  column,
  segments = [],
}: {
  readonly column: number;
  readonly segments?: ReadonlyArray<RailSegment>;
}): RailRow => ({
  id: 'row',
  height: 32,
  segments,
  joins: [],
  markerColumn: column,
  markerY: 16,
});

const columnShift = ({ column }: { readonly column: number }): number =>
  railColumnX({ column }) - railColumnX({ column: 0 });

describe('rowSlotWidth', () => {
  it('keeps a top row on the global rail width', () => {
    expect(
      rowSlotWidth({ rail: railAt({ column: 0 }), railWidth: RAIL_WIDTH, isNested: false }),
    ).toBe(RAIL_WIDTH);
  });

  it.each([1, 2, 3])('moves a row on column %i right by that many columns', (column) => {
    expect(rowSlotWidth({ rail: railAt({ column }), railWidth: RAIL_WIDTH, isNested: true })).toBe(
      RAIL_WIDTH + columnShift({ column }),
    );
  });

  it('puts a fold row on the same x as the rows of its set', () => {
    const rail = railAt({ column: 1 });

    expect(
      rowSlotWidth({
        rail,
        railWidth: RAIL_WIDTH,
        isNested: true,
        markerRadius: RAIL_COUNT_RADIUS,
      }),
    ).toBe(rowSlotWidth({ rail, railWidth: RAIL_WIDTH, isNested: true }));
  });

  it('pushes a row past a deeper lane that runs through it', () => {
    const lane: RailSegment = {
      column: 3,
      laneId: 'lane',
      identityIndex: 0,
      isMuted: false,
      dash: 'solid',
      fromY: 0,
      toY: 32,
    };
    const clear = rowSlotWidth({
      rail: railAt({ column: 1 }),
      railWidth: RAIL_WIDTH,
      isNested: true,
    });

    expect(
      rowSlotWidth({
        rail: railAt({ column: 1, segments: [lane] }),
        railWidth: RAIL_WIDTH,
        isNested: true,
      }),
    ).toBeGreaterThan(clear);
  });
});
