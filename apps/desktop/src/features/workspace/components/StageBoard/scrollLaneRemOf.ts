import {
  BOARD_LANE_FADE_PX,
  BOARD_LANE_GAP_REM,
  BOARD_LANE_MIN_REM,
  BOARD_LANE_SCROLL_MIN_REM,
} from '@goodboy/ui';

const LANES_AT_END = 4;

type Params = {
  readonly width: number;
  readonly remPx: number;
};

export const scrollLaneRemOf = ({ width, remPx }: Params): number => {
  const fitted =
    ((width - BOARD_LANE_FADE_PX) / remPx - (LANES_AT_END - 1) * BOARD_LANE_GAP_REM) / LANES_AT_END;
  return Math.min(BOARD_LANE_MIN_REM, Math.max(BOARD_LANE_SCROLL_MIN_REM, fitted));
};
