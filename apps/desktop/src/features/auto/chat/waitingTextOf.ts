import type { AutoTreeView } from '../../../store/slices/auto-view/state';
import { isAutoPlanAwaitingApproval } from '../isAutoPlanAwaitingApproval';
import { joinNouns } from '../joinNouns';
import { openRoleNouns } from '../openRoleNouns';

type Params = {
  readonly view: AutoTreeView;
};

export const waitingTextOf = ({ view }: Params): string | null => {
  const phase = view.tree.phase;
  if (phase !== 'delegating' && phase !== 'waiting' && phase !== 'merging') {
    return null;
  }
  if (isAutoPlanAwaitingApproval({ view })) {
    return null;
  }
  const nouns = openRoleNouns({ delegations: view.delegations });
  if (phase === 'merging' || nouns.length === 0) {
    return 'Auto is reading the results';
  }
  return `Waiting for ${joinNouns({ nouns })}`;
};
