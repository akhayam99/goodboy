import { HOME_WIDGETS, type HomeWidgetId, type WidgetSize } from '../grid/homeWidgets';
import { sizesAvailableOf } from './sizesAvailableOf';

export const SNAP_HYSTERESIS_COLUMNS = 0.25;

type Params = {
  readonly id: HomeWidgetId;
  readonly columns: number;
  readonly span: number;
  readonly current: WidgetSize;
};

type AtParams = {
  readonly at: number;
};

type ColsParams = {
  readonly id: HomeWidgetId;
  readonly size: WidgetSize;
  readonly columns: number;
};

const colsOf = ({ id, size, columns }: ColsParams): number =>
  Math.min(HOME_WIDGETS[id].spans[size]?.cols ?? 1, columns);

export const snapSizeOf = ({ id, columns, span, current }: Params): WidgetSize => {
  const sizes = sizesAvailableOf({ id });
  const steps = sizes.filter(
    (size, index) =>
      size === current ||
      index === 0 ||
      colsOf({ id, size, columns }) > colsOf({ id, size: sizes[index - 1] ?? size, columns }),
  );
  let index = Math.max(steps.indexOf(current), 0);
  const colsAt = ({ at }: AtParams): number => colsOf({ id, size: steps[at] ?? current, columns });
  while (index + 1 < steps.length) {
    const middle = (colsAt({ at: index }) + colsAt({ at: index + 1 })) / 2;
    if (span <= middle + SNAP_HYSTERESIS_COLUMNS) {
      break;
    }
    index += 1;
  }
  while (index > 0) {
    const middle = (colsAt({ at: index - 1 }) + colsAt({ at: index })) / 2;
    if (span >= middle - SNAP_HYSTERESIS_COLUMNS) {
      break;
    }
    index -= 1;
  }
  return steps[index] ?? current;
};
