// @vitest-environment node

import { describe, expect, it } from 'vitest';
import {
  BOARD_LANE_FADE_PX,
  BOARD_LANE_GAP_REM,
  BOARD_LANE_MIN_REM,
  BOARD_LANE_SCROLL_MIN_REM,
} from '@goodboy/ui';
import { scrollLaneRemOf } from './scrollLaneRemOf';

const ROOT_PX = 15;

type WidthParams = {
  readonly width: number;
};

const firstWholeLaneAt = ({ width }: WidthParams): number => {
  const lanePx = scrollLaneRemOf({ width, remPx: ROOT_PX }) * ROOT_PX;
  const gapPx = BOARD_LANE_GAP_REM * ROOT_PX;
  return width - (4 * lanePx + 3 * gapPx);
};

describe('scrollLaneRemOf', () => {
  it('keeps the full 12.25rem lanes while four of them and the edge fade fit', () => {
    expect(scrollLaneRemOf({ width: 963, remPx: ROOT_PX })).toBe(BOARD_LANE_MIN_REM);
    expect(scrollLaneRemOf({ width: 804, remPx: ROOT_PX })).toBe(BOARD_LANE_MIN_REM);
  });

  it('narrows the lanes at a 1100px window with the right rail, so Running opens whole', () => {
    const width = 760;
    const rem = scrollLaneRemOf({ width, remPx: ROOT_PX });

    expect(rem).toBeLessThan(BOARD_LANE_MIN_REM);
    expect(rem).toBeGreaterThanOrEqual(BOARD_LANE_SCROLL_MIN_REM);
    expect(firstWholeLaneAt({ width })).toBeCloseTo(BOARD_LANE_FADE_PX);
  });

  it('opens every board between the floor and the stack threshold with Running clear of the fade', () => {
    const floor = (4 * BOARD_LANE_SCROLL_MIN_REM + 3 * BOARD_LANE_GAP_REM) * ROOT_PX;
    for (let width = Math.ceil(floor + BOARD_LANE_FADE_PX); width < 964; width += 1) {
      expect(firstWholeLaneAt({ width })).toBeGreaterThanOrEqual(BOARD_LANE_FADE_PX - 0.001);
    }
  });

  it('stops at the 11rem floor on a very narrow board', () => {
    expect(scrollLaneRemOf({ width: 500, remPx: ROOT_PX })).toBe(BOARD_LANE_SCROLL_MIN_REM);
  });
});
