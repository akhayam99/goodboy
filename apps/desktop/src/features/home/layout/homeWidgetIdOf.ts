import { HOME_WIDGETS, type HomeWidgetId } from '../grid/homeWidgets';

type Params = {
  readonly value: unknown;
};

export const homeWidgetIdOf = ({ value }: Params): HomeWidgetId | null => {
  if (typeof value !== 'string') {
    return null;
  }
  return Object.keys(HOME_WIDGETS).find((id): id is HomeWidgetId => id === value) ?? null;
};
