import type { HomeWidgetId, WidgetSize } from '../grid/homeWidgets';
import type { HomeLayout } from './layoutTypes';

type Params = {
  readonly entries: HomeLayout;
};

export const sizesOf = ({ entries }: Params): Partial<Record<HomeWidgetId, WidgetSize>> => {
  const sizes: Partial<Record<HomeWidgetId, WidgetSize>> = {};
  for (const entry of entries) {
    sizes[entry.id] = entry.size;
  }
  return sizes;
};
