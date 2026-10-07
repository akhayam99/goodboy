// @vitest-environment node

import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { BOARD_LANE_GAP_REM, BOARD_LANE_MIN_REM, PANE_RHYTHM } from '@goodboy/ui';
import { boardLanesOf, type BoardLanes } from './boardLanesOf';

const ROOT_PX = 15;
const SIX_LANES_AT = 1226.25;
const FIVE_LANES_AT = 1020;

const SIX: BoardLanes = { lanes: 6, stacked: false, scrolls: false };
const STACKED: BoardLanes = { lanes: 5, stacked: true, scrolls: false };
const SCROLLING: BoardLanes = { lanes: 5, stacked: true, scrolls: true };

describe('boardLanesOf', () => {
  it.each([
    [900, SCROLLING],
    [1000, SCROLLING],
    [1019, SCROLLING],
    [1020, STACKED],
    [1100, STACKED],
    [1200, STACKED],
    [1226, STACKED],
    [1226.25, SIX],
    [1440, SIX],
    [1920, SIX],
    [2048, SIX],
    [2600, SIX],
  ])('lays out a board %ipx wide', (width, expected) => {
    expect(boardLanesOf({ width })).toEqual(expected);
  });

  it('puts the six lane threshold at six 13rem lanes and five 0.75rem gaps of the 15px root', () => {
    expect((6 * BOARD_LANE_MIN_REM + 5 * BOARD_LANE_GAP_REM) * ROOT_PX).toBe(SIX_LANES_AT);
    expect(boardLanesOf({ width: SIX_LANES_AT - 0.5 })).toEqual(STACKED);
    expect(boardLanesOf({ width: SIX_LANES_AT })).toEqual(SIX);
    expect(boardLanesOf({ width: SIX_LANES_AT + 1 })).toEqual(SIX);
  });

  it('puts the scroll threshold at five 13rem lanes and four 0.75rem gaps of the 15px root', () => {
    expect((5 * BOARD_LANE_MIN_REM + 4 * BOARD_LANE_GAP_REM) * ROOT_PX).toBe(FIVE_LANES_AT);
    expect(boardLanesOf({ width: FIVE_LANES_AT - 1 })).toEqual(SCROLLING);
    expect(boardLanesOf({ width: FIVE_LANES_AT })).toEqual(STACKED);
    expect(boardLanesOf({ width: FIVE_LANES_AT + 1 })).toEqual(STACKED);
  });

  it('follows the root font size, so the rule never drifts from the rem lanes', () => {
    expect(boardLanesOf({ width: 1080, remPx: 16 })).toEqual(SCROLLING);
    expect(boardLanesOf({ width: 1080, remPx: 15 })).toEqual(STACKED);
    expect(boardLanesOf({ width: 1080, remPx: 14 })).toEqual(STACKED);
    expect(boardLanesOf({ width: 1300, remPx: 14 })).toEqual(SIX);
  });

  it('fits six lanes from 1227px where the grid really needs 1226.25px, not from 1308px', () => {
    expect(boardLanesOf({ width: 1250 })).toEqual(SIX);
    expect(boardLanesOf({ width: 1307 })).toEqual(SIX);
  });

  it('takes its rem values from the same constants the lane classes are written with', () => {
    expect(PANE_RHYTHM.board.lanesSix).toContain(`minmax(${BOARD_LANE_MIN_REM}rem,`);
    expect(PANE_RHYTHM.board.lanesFive).toContain(`minmax(${BOARD_LANE_MIN_REM}rem,`);
    expect(PANE_RHYTHM.board.lanesScroll).toContain(`${BOARD_LANE_MIN_REM}rem`);
    expect(PANE_RHYTHM.board.laneGap).toBe('gap-3');
    expect(BOARD_LANE_GAP_REM).toBe(3 * 0.25);
  });

  it('keeps the root font size at the 15px the thresholds assume', () => {
    const css = readFileSync(join(__dirname, '..', '..', '..', '..', 'styles.css'), 'utf8');
    expect(css).toMatch(/html \{\s*font-size: 15px;/);
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
