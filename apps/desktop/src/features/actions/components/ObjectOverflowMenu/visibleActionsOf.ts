import type { ActionListOf, ResolvedAction } from '../../types';

type Params = {
  readonly actions: ReadonlyArray<ResolvedAction>;
  readonly omit: ReadonlyArray<string>;
  readonly only: ReadonlyArray<string> | null;
  readonly relabel: ReadonlyMap<string, string> | null;
  readonly onlyOf?: ActionListOf;
};

export const visibleActionsOf = ({
  actions,
  omit,
  only,
  relabel,
  onlyOf,
}: Params): ReadonlyArray<ResolvedAction> => {
  const listed = actions.filter(
    (action) => !omit.includes(action.id) && (only === null || only.includes(action.id)),
  );
  const chosen = onlyOf?.({ actions: listed }) ?? null;
  return listed
    .filter((action) => chosen === null || chosen.includes(action.id))
    .map((action) => {
      const label = relabel?.get(action.id);
      return label === undefined ? action : { ...action, label };
    });
};
