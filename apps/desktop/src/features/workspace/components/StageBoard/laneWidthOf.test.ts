// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { BOARD_LANE_GAP_REM, BOARD_LANE_MAX_REM } from '@goodboy/ui';
import { boardLanesOf } from './boardLanesOf';
import { laneWidthOf } from './laneWidthOf';
import { scrollLaneRemOf } from './scrollLaneRemOf';

const ROOT_PX = 15;

describe('laneWidthOf, the one width of a stage lane', () => {
  it.each([[1280], [900], [700]])(
    'fills a %ipx board with its lanes and gaps, or scrolls',
    (width) => {
      const layout = boardLanesOf({ width, remPx: ROOT_PX });
      const lane = laneWidthOf({ width, remPx: ROOT_PX });
      const used = (layout.lanes * lane + (layout.lanes - 1) * BOARD_LANE_GAP_REM) * ROOT_PX;

      if (layout.scrolls) {
        expect(lane).toBe(scrollLaneRemOf({ width, remPx: ROOT_PX }));
        expect(used).toBeGreaterThan(width);
        return;
      }
      expect(used).toBeCloseTo(width);
    },
  );

  it('stops growing at the widest lane on a very wide board', () => {
    expect(laneWidthOf({ width: 2600, remPx: ROOT_PX })).toBe(BOARD_LANE_MAX_REM);
    expect(laneWidthOf({ width: Number.POSITIVE_INFINITY, remPx: ROOT_PX })).toBe(
      BOARD_LANE_MAX_REM,
    );
  });

  it('never gives a wider board a narrower lane while the lane count holds', () => {
    let last = 0;
    let lanes = 0;
    for (let width = 769; width <= 2600; width += 1) {
      const layout = boardLanesOf({ width, remPx: ROOT_PX });
      const lane = laneWidthOf({ width, remPx: ROOT_PX });
      if (layout.lanes === lanes) {
        expect(lane).toBeGreaterThanOrEqual(last);
      }
      last = lane;
      lanes = layout.lanes;
    }
  });
});
