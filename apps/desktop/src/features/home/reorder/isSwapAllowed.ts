import type { HomeWidgetId } from '../grid/homeWidgets';
import {
  SWAP_EXIT_PX,
  SWAP_GUARD_MS,
  type LastSwap,
  type Point,
  type RectLike,
} from './reorderTypes';

type Params = {
  readonly last: LastSwap | null;
  readonly targetId: HomeWidgetId;
  readonly now: number;
};

type ExitParams = {
  readonly rect: RectLike;
  readonly pointer: Point;
};

export const isSwapAllowed = ({ last, targetId, now }: Params): boolean =>
  last === null || last.targetId !== targetId || (last.isExited && now - last.at >= SWAP_GUARD_MS);

export const hasLeft = ({ rect, pointer }: ExitParams): boolean =>
  pointer.x < rect.left - SWAP_EXIT_PX ||
  pointer.x > rect.left + rect.width + SWAP_EXIT_PX ||
  pointer.y < rect.top - SWAP_EXIT_PX ||
  pointer.y > rect.top + rect.height + SWAP_EXIT_PX;
