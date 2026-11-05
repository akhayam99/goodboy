import { RIGHT_DRAWER_MIN } from '@goodboy/ui';

export type StripSize = 'default' | 'compact';

type SizeSpec = {
  readonly thumbPx: number;
  readonly gapPx: number;
  readonly fallbackSlots: number;
};

const DRAWER_VIEWPORT_PADDING_PX = 32;
const THUMB_GAP_PX = 8;

const STRIP_THUMB_PX = 48;
const TILE_PITCH_PX = STRIP_THUMB_PX + THUMB_GAP_PX;
const NARROWEST_STRIP_PX = RIGHT_DRAWER_MIN - DRAWER_VIEWPORT_PADDING_PX;
const FALLBACK_SLOTS = Math.floor((NARROWEST_STRIP_PX + THUMB_GAP_PX) / TILE_PITCH_PX);

const COMPACT_THUMB_PX = 24;
const COMPACT_GAP_PX = 4;
const COMPACT_FALLBACK_SLOTS = 2;

const SIZE_SPECS = {
  default: { thumbPx: STRIP_THUMB_PX, gapPx: THUMB_GAP_PX, fallbackSlots: FALLBACK_SLOTS },
  compact: {
    thumbPx: COMPACT_THUMB_PX,
    gapPx: COMPACT_GAP_PX,
    fallbackSlots: COMPACT_FALLBACK_SLOTS,
  },
} as const satisfies Record<StripSize, SizeSpec>;

type Params = {
  readonly count: number;
  readonly width: number | null;
  readonly canFold: boolean;
  readonly size?: StripSize;
};

type Split = {
  readonly shown: number;
  readonly hidden: number;
  readonly desiredWidth: number;
};

type WidthParams = {
  readonly tiles: number;
  readonly spec: SizeSpec;
};

const widthOfTiles = ({ tiles, spec }: WidthParams): number =>
  tiles === 0 ? 0 : tiles * (spec.thumbPx + spec.gapPx) - spec.gapPx;

export const splitStripImages = ({ count, width, canFold, size = 'default' }: Params): Split => {
  const spec = SIZE_SPECS[size];
  const desiredWidth = widthOfTiles({ tiles: Math.min(count, spec.fallbackSlots), spec });
  if (!canFold) {
    return { shown: count, hidden: 0, desiredWidth };
  }
  const slots =
    width === null || width <= 0
      ? spec.fallbackSlots
      : Math.max(Math.floor((width + spec.gapPx) / (spec.thumbPx + spec.gapPx)), 1);
  if (count <= slots) {
    return { shown: count, hidden: 0, desiredWidth };
  }
  const shown = slots - 1;
  return { shown, hidden: count - shown, desiredWidth };
};
