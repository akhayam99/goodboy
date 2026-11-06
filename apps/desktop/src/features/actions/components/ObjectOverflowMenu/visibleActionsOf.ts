import type { ResolvedAction } from '../../types';

type Params = {
  readonly actions: ReadonlyArray<ResolvedAction>;
  readonly omit: ReadonlyArray<string>;
  readonly only: ReadonlyArray<string> | null;
  readonly relabel: ReadonlyMap<string, string> | null;
};

export const visibleActionsOf = ({
  actions,
  omit,
  only,
  relabel,
}: Params): ReadonlyArray<ResolvedAction> =>
  actions
    .filter((action) => !omit.includes(action.id) && (only === null || only.includes(action.id)))
    .map((action) => {
      const label = relabel?.get(action.id);
      return label === undefined ? action : { ...action, label };
    });
