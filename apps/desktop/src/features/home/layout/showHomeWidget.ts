import type { HomeWidgetId, WidgetSize } from '../grid/homeWidgets';
import type { HomeLayout } from './layoutTypes';

type Params = {
  readonly entries: HomeLayout;
  readonly id: HomeWidgetId;
  readonly size: WidgetSize;
  readonly index?: number;
};

export const showHomeWidget = ({ entries, id, size, index }: Params): HomeLayout | null => {
  if (entries.some((entry) => entry.id === id)) {
    return null;
  }
  const at = index === undefined ? entries.length : Math.min(Math.max(index, 0), entries.length);
  return [...entries.slice(0, at), { id, size }, ...entries.slice(at)];
};
