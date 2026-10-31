import { RIGHT_DRAWER_MIN } from '@goodboy/ui';

const DRAWER_VIEWPORT_PADDING_PX = 32;
const THUMB_GAP_PX = 8;

const STRIP_THUMB_PX = 48;
const TILE_PITCH_PX = STRIP_THUMB_PX + THUMB_GAP_PX;
const NARROWEST_STRIP_PX = RIGHT_DRAWER_MIN - DRAWER_VIEWPORT_PADDING_PX;
const FALLBACK_SLOTS = Math.floor((NARROWEST_STRIP_PX + THUMB_GAP_PX) / TILE_PITCH_PX);

type Params = {
  readonly count: number;
  readonly width: number | null;
  readonly canFold: boolean;
};

type Split = {
  readonly shown: number;
  readonly hidden: number;
  readonly desiredWidth: number;
};

type WidthParams = {
  readonly tiles: number;
};

const widthOfTiles = ({ tiles }: WidthParams): number =>
  tiles === 0 ? 0 : tiles * TILE_PITCH_PX - THUMB_GAP_PX;

export const splitStripImages = ({ count, width, canFold }: Params): Split => {
  const desiredWidth = widthOfTiles({ tiles: Math.min(count, FALLBACK_SLOTS) });
  if (!canFold) {
    return { shown: count, hidden: 0, desiredWidth };
  }
  const slots =
    width === null || width <= 0
      ? FALLBACK_SLOTS
      : Math.max(Math.floor((width + THUMB_GAP_PX) / TILE_PITCH_PX), 1);
  if (count <= slots) {
    return { shown: count, hidden: 0, desiredWidth };
  }
  const shown = slots - 1;
  return { shown, hidden: count - shown, desiredWidth };
};
