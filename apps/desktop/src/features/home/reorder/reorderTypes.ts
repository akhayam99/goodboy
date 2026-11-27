import type { HomeWidgetId } from '../grid/homeWidgets';

export const DRAG_THRESHOLD_PX = 6;

export const SWAP_GUARD_MS = 120;

export const SWAP_EXIT_PX = 8;

export const AUTO_SCROLL_ZONE_PX = 56;

export const AUTO_SCROLL_MAX_PX = 18;

export const DEAD_ZONE_RATIO = 0.2;

export type Point = {
  readonly x: number;
  readonly y: number;
};

export type RectLike = {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
};

export type CellRect = {
  readonly id: HomeWidgetId;
  readonly rect: RectLike;
};

export type LastSwap = {
  readonly targetId: HomeWidgetId;
  readonly at: number;
  readonly isExited: boolean;
};
