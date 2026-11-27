import type { HomeWidgetId, WidgetSize } from '../grid/homeWidgets';
import type { HomeLayout } from './layoutTypes';

type Params = {
  readonly entries: HomeLayout;
  readonly id: HomeWidgetId;
};

export type HideResult = {
  readonly entries: HomeLayout;
  readonly index: number;
  readonly size: WidgetSize;
};

export const hideHomeWidget = ({ entries, id }: Params): HideResult | null => {
  const index = entries.findIndex((entry) => entry.id === id);
  const hidden = entries[index];
  if (hidden === undefined) {
    return null;
  }
  return {
    entries: entries.filter((entry) => entry.id !== id),
    index,
    size: hidden.size,
  };
};
