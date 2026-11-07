import type { SessionId } from '@goodboy/types';
import type { GroupBy, SessionGroupingState } from './state';

export const GROUP_BY_BRANCH_FLOOR = 2;

type Params = {
  readonly state: Pick<SessionGroupingState, 'groupBySession'>;
  readonly sessionId: SessionId;
  readonly branchCount: number;
  readonly stored?: GroupBy | null;
};

export const selectGroupBy = ({
  state,
  sessionId,
  branchCount,
  stored = null,
}: Params): GroupBy => {
  if (branchCount < GROUP_BY_BRANCH_FLOOR) {
    return 'state';
  }
  return state.groupBySession[sessionId] ?? stored ?? 'branch';
};
