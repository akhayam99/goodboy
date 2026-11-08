import { treeIndentPx } from '@goodboy/ui';

const CHAR_PX = 6.8;
const TOGGLE_SLOT_PX = 22;
const STATUS_PX = 20;
const CHIP_PX = 36;
const DELTA_PX = 88;
const GUTTER_PX = 24;

type Params = {
  readonly depth: number;
  readonly count: number;
  readonly railWidth: number;
  readonly hasDelta: boolean;
};

export const nameLengthOf = ({ depth, count, railWidth, hasDelta }: Params): number | null => {
  if (railWidth === 0) {
    return null;
  }
  const fixed =
    treeIndentPx({ depth }) +
    TOGGLE_SLOT_PX +
    STATUS_PX +
    GUTTER_PX +
    (count > 0 ? CHIP_PX : 0) +
    (hasDelta ? DELTA_PX : 0);
  return Math.max(10, Math.floor((railWidth - fixed) / CHAR_PX));
};
