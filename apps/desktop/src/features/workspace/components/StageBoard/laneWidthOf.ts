import { BOARD_LANE_GAP_REM, BOARD_LANE_MAX_REM, BOARD_LANE_MIN_REM } from '@goodboy/ui';
import { boardLanesOf } from './boardLanesOf';
import { scrollLaneRemOf } from './scrollLaneRemOf';

type Params = {
  readonly width: number;
  readonly remPx: number;
};

export const laneWidthOf = ({ width, remPx }: Params): number => {
  const layout = boardLanesOf({ width, remPx });
  if (layout.scrolls) {
    return scrollLaneRemOf({ width, remPx });
  }
  const fitted = (width / remPx - (layout.lanes - 1) * BOARD_LANE_GAP_REM) / layout.lanes;
  return Math.min(BOARD_LANE_MAX_REM, Math.max(BOARD_LANE_MIN_REM, fitted));
};
