// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { boardLanesOf, type BoardLanes } from './boardLanesOf';

const SIX_LANES_AT = 1308;
const FIVE_LANES_AT = 1088;

const SIX: BoardLanes = { lanes: 6, stacked: false, scrolls: false };
const STACKED: BoardLanes = { lanes: 5, stacked: true, scrolls: false };
const SCROLLING: BoardLanes = { lanes: 5, stacked: true, scrolls: true };

describe('boardLanesOf', () => {
  it.each([
    [900, SCROLLING],
    [1000, SCROLLING],
    [1087, SCROLLING],
    [1088, STACKED],
    [1100, STACKED],
    [1200, STACKED],
    [1307, STACKED],
    [1308, SIX],
    [1440, SIX],
    [1920, SIX],
    [2048, SIX],
    [2600, SIX],
  ])('lays out a board %ipx wide', (width, expected) => {
    expect(boardLanesOf({ width })).toEqual(expected);
  });

  it('puts the six lane threshold at six 208px lanes and five 12px gaps', () => {
    expect(6 * 208 + 5 * 12).toBe(SIX_LANES_AT);
    expect(boardLanesOf({ width: SIX_LANES_AT - 1 })).toEqual(STACKED);
    expect(boardLanesOf({ width: SIX_LANES_AT })).toEqual(SIX);
    expect(boardLanesOf({ width: SIX_LANES_AT + 1 })).toEqual(SIX);
  });

  it('puts the scroll threshold at five 208px lanes and four 12px gaps', () => {
    expect(5 * 208 + 4 * 12).toBe(FIVE_LANES_AT);
    expect(boardLanesOf({ width: FIVE_LANES_AT - 1 })).toEqual(SCROLLING);
    expect(boardLanesOf({ width: FIVE_LANES_AT })).toEqual(STACKED);
    expect(boardLanesOf({ width: FIVE_LANES_AT + 1 })).toEqual(STACKED);
  });

  it('never gives a wider board fewer lanes, a stack or a scroll the narrower one did not have', () => {
    const results = Array.from({ length: 1701 }, (_, index) =>
      boardLanesOf({ width: 900 + index }),
    );
    results.forEach((wider, index) => {
      const narrower = results[index - 1];
      if (narrower === undefined) {
        return;
      }
      expect(wider.lanes).toBeGreaterThanOrEqual(narrower.lanes);
      expect(Number(wider.stacked)).toBeLessThanOrEqual(Number(narrower.stacked));
      expect(Number(wider.scrolls)).toBeLessThanOrEqual(Number(narrower.scrolls));
    });
  });

  it('only scrolls while the lanes are stacked', () => {
    for (let width = 900; width <= 2600; width += 1) {
      const result = boardLanesOf({ width });
      expect(!result.scrolls || result.stacked).toBe(true);
    }
  });
});
