import type { HomeWidgetId, WidgetSize } from '../grid/homeWidgets';
import { sizesAvailableOf } from './sizesAvailableOf';

type Params = {
  readonly id: HomeWidgetId;
  readonly size: WidgetSize;
  readonly step: 1 | -1;
  readonly isWrapping: boolean;
};

export const stepSizeOf = ({ id, size, step, isWrapping }: Params): WidgetSize => {
  const sizes = sizesAvailableOf({ id });
  const index = sizes.indexOf(size);
  const next = index + step;
  if (isWrapping) {
    return sizes[(next + sizes.length) % sizes.length] ?? size;
  }
  return sizes[Math.min(Math.max(next, 0), sizes.length - 1)] ?? size;
};
