import { HOME_WIDGETS, type HomeWidgetId, type WidgetSize } from '../grid/homeWidgets';

type Params = {
  readonly id: HomeWidgetId;
  readonly value: unknown;
};

export const widgetSizeOf = ({ id, value }: Params): WidgetSize => {
  const spans = HOME_WIDGETS[id].spans;
  if (value === 'S' && spans.S !== undefined) {
    return 'S';
  }
  if (value === 'M' && spans.M !== undefined) {
    return 'M';
  }
  if (value === 'L' && spans.L !== undefined) {
    return 'L';
  }
  return HOME_WIDGETS[id].defaultSize;
};
