const LANE_MIN_WIDTH = 208;
const LANE_GAP = 12;
const SIX_LANES_WIDTH = 6 * LANE_MIN_WIDTH + 5 * LANE_GAP;
const FIVE_LANES_WIDTH = 5 * LANE_MIN_WIDTH + 4 * LANE_GAP;

export type BoardLanes = {
  readonly lanes: 5 | 6;
  readonly stacked: boolean;
  readonly scrolls: boolean;
};

type Params = {
  readonly width: number;
};

export const boardLanesOf = ({ width }: Params): BoardLanes => {
  if (width >= SIX_LANES_WIDTH) {
    return { lanes: 6, stacked: false, scrolls: false };
  }
  if (width >= FIVE_LANES_WIDTH) {
    return { lanes: 5, stacked: true, scrolls: false };
  }
  return { lanes: 5, stacked: true, scrolls: true };
};
