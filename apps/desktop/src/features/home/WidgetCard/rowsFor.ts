import type { WidgetSize } from '../grid/homeWidgets';

type Params = {
  readonly size: WidgetSize;
};

export const rowsFor = ({ size }: Params): number => {
  if (size === 'S') {
    return 0;
  }
  return size === 'M' ? 2 : 4;
};
