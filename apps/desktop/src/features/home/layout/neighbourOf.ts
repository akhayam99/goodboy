import type { HomeWidgetId } from '../grid/homeWidgets';

type Params = {
  readonly ids: ReadonlyArray<HomeWidgetId>;
  readonly id: HomeWidgetId;
};

export const neighbourOf = ({ ids, id }: Params): HomeWidgetId | null => {
  const index = ids.indexOf(id);
  return ids[index + 1] ?? ids[index - 1] ?? null;
};
