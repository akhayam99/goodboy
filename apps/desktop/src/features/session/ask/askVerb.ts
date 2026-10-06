import type { AppStore } from '../../../store/store';
import { bindTarget } from '../../actions/registry';
import type { ObjectTarget, ResolvedAction } from '../../actions/types';

type Params = {
  readonly state: AppStore;
  readonly target: ObjectTarget;
  readonly actionId: string;
};

export const askVerb = ({ state, target, actionId }: Params): ResolvedAction | null => {
  const action = bindTarget({ state, target })
    ?.resolve()
    .find((candidate) => candidate.id === actionId);
  return action === undefined || action.blockedReason !== null ? null : action;
};
