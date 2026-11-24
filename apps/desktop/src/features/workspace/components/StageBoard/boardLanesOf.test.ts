// @vitest-environment node

import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { BOARD_LANE_GAP_REM, BOARD_LANE_MIN_REM, PANE_RHYTHM } from '@goodboy/ui';
import { boardLanesOf, type BoardLanes } from './boardLanesOf';

const ROOT_PX = 15;
const FIVE_LANES_AT = 963.75;
const FOUR_LANES_AT = 768.75;

const FIVE: BoardLanes = { lanes: 5, stacked: false, scrolls: false };
const STACKED: BoardLanes = { lanes: 4, stacked: true, scrolls: false };
const SCROLLING: BoardLanes = { lanes: 4, stacked: true, scrolls: true };

describe('boardLanesOf', () => {
  it.each([
    [700, SCROLLING],
    [768, SCROLLING],
    [769, STACKED],
    [900, STACKED],
    [963, STACKED],
    [963.75, FIVE],
    [1440, FIVE],
    [1920, FIVE],
    [2600, FIVE],
  ])('lays out a board %ipx wide', (width, expected) => {
    expect(boardLanesOf({ width })).toEqual(expected);
  });

  it('puts the five lane threshold at five 12.25rem lanes and four 0.75rem gaps of the 15px root', () => {
    expect((5 * BOARD_LANE_MIN_REM + 4 * BOARD_LANE_GAP_REM) * ROOT_PX).toBe(FIVE_LANES_AT);
    expect(boardLanesOf({ width: FIVE_LANES_AT - 0.5 })).toEqual(STACKED);
    expect(boardLanesOf({ width: FIVE_LANES_AT })).toEqual(FIVE);
    expect(boardLanesOf({ width: FIVE_LANES_AT + 1 })).toEqual(FIVE);
  });

  it('puts the scroll threshold at four 12.25rem lanes and three 0.75rem gaps of the 15px root', () => {
    expect((4 * BOARD_LANE_MIN_REM + 3 * BOARD_LANE_GAP_REM) * ROOT_PX).toBe(FOUR_LANES_AT);
    expect(boardLanesOf({ width: FOUR_LANES_AT - 1 })).toEqual(SCROLLING);
    expect(boardLanesOf({ width: FOUR_LANES_AT })).toEqual(STACKED);
    expect(boardLanesOf({ width: FOUR_LANES_AT + 1 })).toEqual(STACKED);
  });

  it('follows the root font size, so the rule never drifts from the rem lanes', () => {
    expect(boardLanesOf({ width: 800, remPx: 16 })).toEqual(SCROLLING);
    expect(boardLanesOf({ width: 800, remPx: 15 })).toEqual(STACKED);
    expect(boardLanesOf({ width: 1000, remPx: 16 })).toEqual(STACKED);
    expect(boardLanesOf({ width: 1000, remPx: 15 })).toEqual(FIVE);
  });

  it('takes its rem values from the same constants the lane classes are written with', () => {
    expect(PANE_RHYTHM.board.laneGap).toBe('gap-3');
    expect(BOARD_LANE_GAP_REM).toBe(3 * 0.25);
  });

  it('keeps the root font size at the 15px the thresholds assume', () => {
    const css = readFileSync(join(__dirname, '..', '..', '..', '..', 'styles.css'), 'utf8');
    expect(css).toMatch(/html \{\s*font-size: 15px;/);
  });

  it('never gives a wider board fewer lanes, a stack or a scroll the narrower one did not have', () => {
    const results = Array.from({ length: 1901 }, (_, index) =>
      boardLanesOf({ width: 700 + index }),
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
    for (let width = 700; width <= 2600; width += 1) {
      const result = boardLanesOf({ width });
      expect(!result.scrolls || result.stacked).toBe(true);
    }
  });
});
