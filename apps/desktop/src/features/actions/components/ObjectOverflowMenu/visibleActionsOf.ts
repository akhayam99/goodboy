import { overflowCutOf } from '../../overflowCutOf';
import type { ResolvedAction } from '../../types';

type Params = {
  readonly actions: ReadonlyArray<ResolvedAction>;
  readonly omit: ReadonlyArray<string>;
  readonly only: ReadonlyArray<string> | null;
  readonly relabel: ReadonlyMap<string, string> | null;
  readonly cuts?: ReadonlyArray<string>;
};

export const visibleActionsOf = ({
  actions,
  omit,
  only,
  relabel,
  cuts = [],
}: Params): ReadonlyArray<ResolvedAction> => {
  const listed = actions.filter(
    (action) => !omit.includes(action.id) && (only === null || only.includes(action.id)),
  );
  const cut = overflowCutOf({ actions: listed, cuts });
  return listed
    .filter((action) => !cut.includes(action.id))
    .map((action) => {
      const label = relabel?.get(action.id);
      return label === undefined ? action : { ...action, label };
    });
};
