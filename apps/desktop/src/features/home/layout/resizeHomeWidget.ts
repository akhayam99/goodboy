import type { HomeWidgetId, WidgetSize } from '../grid/homeWidgets';
import type { HomeLayout } from './layoutTypes';
import { sizesAvailableOf } from './sizesAvailableOf';

type Params = {
  readonly entries: HomeLayout;
  readonly id: HomeWidgetId;
  readonly size: WidgetSize;
};

export type ResizeResult = {
  readonly entries: HomeLayout;
  readonly previous: WidgetSize;
};

export const resizeHomeWidget = ({ entries, id, size }: Params): ResizeResult | null => {
  const entry = entries.find((candidate) => candidate.id === id);
  if (entry === undefined || entry.size === size || !sizesAvailableOf({ id }).includes(size)) {
    return null;
  }
  return {
    entries: entries.map((candidate) => (candidate.id === id ? { id, size } : candidate)),
    previous: entry.size,
  };
};
