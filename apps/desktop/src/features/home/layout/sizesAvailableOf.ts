import { HOME_WIDGETS, type HomeWidgetId, type WidgetSize } from '../grid/homeWidgets';

type Params = {
  readonly id: HomeWidgetId;
};

const ORDER: ReadonlyArray<WidgetSize> = ['S', 'M', 'L'];

export const sizesAvailableOf = ({ id }: Params): ReadonlyArray<WidgetSize> =>
  ORDER.filter((size) => HOME_WIDGETS[id].spans[size] !== undefined);
