import { RIGHT_DRAWER_MIN } from '@goodboy/ui';

const DRAWER_VIEWPORT_PADDING_PX = 32;
const THUMB_GAP_PX = 8;

const STRIP_THUMB_PX = 48;
const NARROWEST_STRIP_PX = RIGHT_DRAWER_MIN - DRAWER_VIEWPORT_PADDING_PX;
const STRIP_SLOTS = Math.floor(
  (NARROWEST_STRIP_PX + THUMB_GAP_PX) / (STRIP_THUMB_PX + THUMB_GAP_PX),
);

type Params = {
  readonly count: number;
};

type Split = {
  readonly shown: number;
  readonly hidden: number;
};

export const splitStripImages = ({ count }: Params): Split => {
  if (count <= STRIP_SLOTS) {
    return { shown: count, hidden: 0 };
  }
  const shown = STRIP_SLOTS - 1;
  return { shown, hidden: count - shown };
};
