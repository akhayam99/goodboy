import type { AutoTreeView } from '../../../store/slices/auto-view/state';
import { isAutoPlanAwaitingApproval } from '../isAutoPlanAwaitingApproval';
import { joinNouns } from '../joinNouns';
import { openRoleNouns } from '../openRoleNouns';
import { refusalNoticeOf } from './refusalNoticeOf';
import { shownRefusalOf } from './shownRefusalOf';

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
  const refusal = shownRefusalOf({ view });
  if (refusal !== null) {
    return refusalNoticeOf({ refusal });
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
