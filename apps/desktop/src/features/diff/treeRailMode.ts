import { COLUMN_FRAME } from '@goodboy/ui';

export type TreeRailMode = 'docked' | 'strip' | 'button';

export const TREE_STRIP_WIDTH = 44;

const RAIL_CLEARANCE = 24;
const STRIP_CLEARANCE = 16;

type PaneParams = {
  readonly paneWidth: number;
};

type ModeParams = PaneParams & {
  readonly railWidth: number;
};

export const treeRailMarginOf = ({ paneWidth }: PaneParams): number =>
  (paneWidth - COLUMN_FRAME) / 2;

export const dockedRailLimitOf = ({ paneWidth }: PaneParams): number =>
  Math.floor(treeRailMarginOf({ paneWidth }) - RAIL_CLEARANCE);

export const treeRailModeOf = ({ paneWidth, railWidth }: ModeParams): TreeRailMode => {
  const margin = treeRailMarginOf({ paneWidth });
  if (railWidth + RAIL_CLEARANCE <= margin) {
    return 'docked';
  }
  if (TREE_STRIP_WIDTH + STRIP_CLEARANCE <= margin) {
    return 'strip';
  }
  return 'button';
};
