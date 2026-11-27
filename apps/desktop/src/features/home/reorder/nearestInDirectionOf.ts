import type { HomeWidgetId } from '../grid/homeWidgets';
import type { CellRect } from './reorderTypes';

type Params = {
  readonly cells: ReadonlyArray<CellRect>;
  readonly id: HomeWidgetId;
  readonly direction: 'up' | 'down';
};

export const nearestInDirectionOf = ({ cells, id, direction }: Params): HomeWidgetId | null => {
  const from = cells.find((cell) => cell.id === id)?.rect;
  if (from === undefined) {
    return null;
  }
  const overlapping = cells.filter(
    ({ id: other, rect }) =>
      other !== id && rect.left < from.left + from.width && rect.left + rect.width > from.left,
  );
  const candidates =
    direction === 'down'
      ? overlapping.filter(({ rect }) => rect.top >= from.top + from.height - 1)
      : overlapping.filter(({ rect }) => rect.top + rect.height <= from.top + 1);
  const sorted = [...candidates].sort((a, b) =>
    direction === 'down' ? a.rect.top - b.rect.top : b.rect.top - a.rect.top,
  );
  return sorted[0]?.id ?? null;
};
