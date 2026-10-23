import type { MountId, SessionId, WorktreeStatus } from '@goodboy/types';
import { selectRebaseStop } from '../../store/slices/history/selectRebaseStop';
import type { AppState } from '../../store/types';

type Params = {
  readonly state: AppState;
  readonly sessionId: SessionId;
  readonly mountId: MountId | null;
  readonly status: Pick<WorktreeStatus, 'inProgress'> | null;
};

export const hasOpenRebaseStopOf = ({ state, sessionId, mountId, status }: Params): boolean => {
  if (status?.inProgress === 'rebase') {
    return true;
  }
  if (mountId === null) {
    return false;
  }
  return selectRebaseStop({ state, sessionId, mountId })?.run.phase === 'stopped';
};
