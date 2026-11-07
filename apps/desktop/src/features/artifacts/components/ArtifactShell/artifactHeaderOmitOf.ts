import { overflowCutOf } from '../../../actions/overflowCutOf';
import type { ResolvedAction } from '../../../actions/types';

const REACHABLE_IN_PAGE = 'artifact.showInFinder';

type Params = {
  readonly actions: ReadonlyArray<ResolvedAction>;
};

export const artifactHeaderOmitOf = ({ actions }: Params): ReadonlyArray<string> =>
  overflowCutOf({
    actions,
    cuts: [
      ...[
        actions.find((action) => action.slot === 'secondary'),
        actions.find((action) => action.slot === 'primary'),
      ].flatMap((shown) => (shown === undefined ? [] : [shown.id])),
      REACHABLE_IN_PAGE,
    ],
  });
