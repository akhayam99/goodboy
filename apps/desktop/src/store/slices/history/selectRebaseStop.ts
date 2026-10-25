import type { MountId, SessionId } from '@goodboy/types';
import { rebaseStopOf, type RebaseStop } from '../../../features/history/rebaseStopOf';
import type { AppState } from '../../types';
import { resolveMountBaseBranch, selectMountById } from '../project-mounts/selectors';
import { selectMountStatusRead } from './selectMountStatusRead';

type Params = {
  readonly state: AppState;
  readonly sessionId: SessionId;
  readonly mountId: MountId;
};

export const selectRebaseStop = ({ state, sessionId, mountId }: Params): RebaseStop | null => {
  const mount = selectMountById({ state, sessionId, mountId });
  const baseBranch = resolveMountBaseBranch({ mount, projects: state.projects });
  return rebaseStopOf({
    sessionId,
    mountId,
    run: state.historyRuns[mountId],
    events: state.sessionEvents?.[sessionId],
    settledStopIds: state.settledRebaseStops[sessionId],
    baseBranch: baseBranch ?? 'main',
    read: selectMountStatusRead({ state, sessionId, mountId }),
  });
};
