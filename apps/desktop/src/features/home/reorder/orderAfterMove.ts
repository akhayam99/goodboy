import type { HomeWidgetId } from '../grid/homeWidgets';

type Params = {
  readonly ids: ReadonlyArray<HomeWidgetId>;
  readonly id: HomeWidgetId;
  readonly toIndex: number;
};

export const orderAfterMove = ({ ids, id, toIndex }: Params): ReadonlyArray<HomeWidgetId> => {
  const rest = ids.filter((candidate) => candidate !== id);
  const at = Math.min(Math.max(toIndex, 0), rest.length);
  return [...rest.slice(0, at), id, ...rest.slice(at)];
};
