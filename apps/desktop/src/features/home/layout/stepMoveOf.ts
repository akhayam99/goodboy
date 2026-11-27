import type { HomeWidgetId } from '../grid/homeWidgets';

type Params = {
  readonly ids: ReadonlyArray<HomeWidgetId>;
  readonly id: HomeWidgetId;
  readonly step: 1 | -1;
};

export type StepMove = {
  readonly beforeId: HomeWidgetId | null;
  readonly position: number;
};

export const stepMoveOf = ({ ids, id, step }: Params): StepMove | null => {
  const index = ids.indexOf(id);
  const to = index + step;
  if (index < 0 || to < 0 || to >= ids.length) {
    return null;
  }
  const beforeId = step === -1 ? (ids[to] ?? null) : (ids[to + 1] ?? null);
  return { beforeId, position: to + 1 };
};
