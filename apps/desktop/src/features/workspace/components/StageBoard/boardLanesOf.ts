import { BOARD_LANE_GAP_REM, BOARD_LANE_MIN_REM } from '@goodboy/ui';

const DEFAULT_REM_PX = 15;

export type BoardLanes = {
  readonly lanes: 5 | 6;
  readonly stacked: boolean;
  readonly scrolls: boolean;
};

type Params = {
  readonly width: number;
  readonly remPx?: number;
};

export const rootRemPx = (): number => {
  if (typeof document === 'undefined') {
    return DEFAULT_REM_PX;
  }
  const px = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  return Number.isFinite(px) && px > 0 ? px : DEFAULT_REM_PX;
};

const lanesWidth = ({ count, remPx }: { readonly count: number; readonly remPx: number }): number =>
  (count * BOARD_LANE_MIN_REM + (count - 1) * BOARD_LANE_GAP_REM) * remPx;

export const boardLanesOf = ({ width, remPx = DEFAULT_REM_PX }: Params): BoardLanes => {
  if (width >= lanesWidth({ count: 6, remPx })) {
    return { lanes: 6, stacked: false, scrolls: false };
  }
  if (width >= lanesWidth({ count: 5, remPx })) {
    return { lanes: 5, stacked: true, scrolls: false };
  }
  return { lanes: 5, stacked: true, scrolls: true };
};
