import type { AutoTreeView } from '../../../store/slices/auto-view/state';
import { isAutoPlanAwaitingApproval } from '../isAutoPlanAwaitingApproval';
import { joinNouns } from '../joinNouns';
import { openRoleNouns } from '../openRoleNouns';
import { refusalNoticeOf } from './refusalNoticeOf';

type Params = {
  readonly view: AutoTreeView;
};

const DECIDING_TEXT = 'Deciding what to do next';

export const waitingTextOf = ({ view }: Params): string | null => {
  const phase = view.tree.phase;
  if (phase === 'deciding') {
    return DECIDING_TEXT;
  }
  if (phase !== 'delegating' && phase !== 'waiting' && phase !== 'merging') {
    return null;
  }
  if (view.pendingRefusal !== null) {
    return refusalNoticeOf({ refusal: view.pendingRefusal });
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
