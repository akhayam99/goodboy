import type { HomeWidgetId } from '../grid/homeWidgets';
import type { HomeLayout } from './layoutTypes';

type Params = {
  readonly entries: HomeLayout;
  readonly id: HomeWidgetId;
  readonly beforeId: HomeWidgetId | null;
};

export type MoveResult = {
  readonly entries: HomeLayout;
  readonly beforeId: HomeWidgetId | null;
};

export const moveHomeWidget = ({ entries, id, beforeId }: Params): MoveResult | null => {
  const from = entries.findIndex((entry) => entry.id === id);
  const moved = entries[from];
  if (moved === undefined || beforeId === id) {
    return null;
  }
  const rest = entries.filter((entry) => entry.id !== id);
  const target = beforeId === null ? rest.length : rest.findIndex((entry) => entry.id === beforeId);
  const at = target < 0 ? rest.length : target;
  const next = [...rest.slice(0, at), moved, ...rest.slice(at)];
  if (next.every((entry, index) => entry.id === entries[index]?.id)) {
    return null;
  }
  return { entries: next, beforeId: entries[from + 1]?.id ?? null };
};
