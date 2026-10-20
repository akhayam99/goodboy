import { describe, expect, it } from 'vitest';
import { pickAnchor } from './pickAnchor';

type RowsParams = {
  readonly heights: ReadonlyArray<number>;
  readonly scrollTop: number;
};

const bottomsOf = ({ heights, scrollTop }: RowsParams): ReadonlyArray<number> => {
  let top = -scrollTop;
  return heights.map((height) => {
    top += height;
    return top;
  });
};

const pick = ({ heights, scrollTop }: RowsParams) => {
  const bottoms = bottomsOf({ heights, scrollTop });
  return pickAnchor({
    count: bottoms.length,
    bottomOf: ({ index }) => bottoms[index] ?? 0,
    edge: 0,
  });
};

describe('pickAnchor', () => {
  it('anchors the row that crosses the top edge of the viewport', () => {
    expect(pick({ heights: [100, 100, 100], scrollTop: 150 })).toBe(1);
  });

  it('anchors the first row when the reader is at the top', () => {
    expect(pick({ heights: [100, 100, 100], scrollTop: 0 })).toBe(0);
  });

  it('skips a row whose bottom sits exactly on the edge', () => {
    expect(pick({ heights: [100, 100, 100], scrollTop: 100 })).toBe(1);
  });

  it('finds the row in a long transcript', () => {
    const heights = Array.from({ length: 1000 }, (_, index) => 20 + (index % 7) * 30);
    const bottoms = bottomsOf({ heights, scrollTop: 0 });
    const expected = bottoms.findIndex((bottom) => bottom > 31000);
    expect(pick({ heights, scrollTop: 31000 })).toBe(expected);
  });

  it('has no anchor without rows or past the last row', () => {
    expect(pick({ heights: [], scrollTop: 0 })).toBeNull();
    expect(pick({ heights: [100], scrollTop: 200 })).toBeNull();
  });
});
