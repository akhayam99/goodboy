import type { HomeWidgetId } from '../grid/homeWidgets';
import { DEAD_ZONE_RATIO, type CellRect, type Point } from './reorderTypes';

type Params = {
  readonly cells: ReadonlyArray<CellRect>;
  readonly ids: ReadonlyArray<HomeWidgetId>;
  readonly draggedId: HomeWidgetId;
  readonly pointer: Point;
  readonly gridWidth: number;
};

const FULL_WIDTH_RATIO = 0.9;

export const dropTargetOf = ({
  cells,
  ids,
  draggedId,
  pointer,
  gridWidth,
}: Params): HomeWidgetId | null => {
  const hit = cells.find(
    ({ id, rect }) =>
      id !== draggedId &&
      pointer.x >= rect.left &&
      pointer.x <= rect.left + rect.width &&
      pointer.y >= rect.top &&
      pointer.y <= rect.top + rect.height,
  );
  if (hit === undefined) {
    return null;
  }
  const { rect } = hit;
  if (rect.width >= gridWidth * FULL_WIDTH_RATIO) {
    const middle = rect.top + rect.height / 2;
    const isForward = ids.indexOf(draggedId) < ids.indexOf(hit.id);
    const isPast = isForward ? pointer.y >= middle : pointer.y <= middle;
    return isPast ? hit.id : null;
  }
  const insetX = rect.width * DEAD_ZONE_RATIO;
  const insetY = rect.height * DEAD_ZONE_RATIO;
  const isInside =
    pointer.x >= rect.left + insetX &&
    pointer.x <= rect.left + rect.width - insetX &&
    pointer.y >= rect.top + insetY &&
    pointer.y <= rect.top + rect.height - insetY;
  return isInside ? hit.id : null;
};
