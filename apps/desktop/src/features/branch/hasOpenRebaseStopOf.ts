import type { MountId, SessionId, WorktreeStatus } from '@goodboy/types';
import { selectMountStatusRead } from '../../store/slices/history/selectMountStatusRead';
import { selectRebaseStop } from '../../store/slices/history/selectRebaseStop';
import type { AppState } from '../../store/types';

type Params = {
  readonly state: AppState;
  readonly sessionId: SessionId;
  readonly mountId: MountId | null;
  readonly status?: Pick<WorktreeStatus, 'inProgress'> | null;
};

export const hasOpenRebaseStopOf = ({
  state,
  sessionId,
  mountId,
  status = null,
}: Params): boolean => {
  if (mountId === null) {
    return status?.inProgress === 'rebase';
  }
  const known = status ?? selectMountStatusRead({ state, sessionId, mountId })?.status ?? null;
  if (known?.inProgress === 'rebase') {
    return true;
  }
  return selectRebaseStop({ state, sessionId, mountId })?.run.phase === 'stopped';
};
