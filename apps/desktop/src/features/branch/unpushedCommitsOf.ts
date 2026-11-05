import type { MountId, SessionId } from '@goodboy/types';
import { branchPushFactsOf } from '../../shared/lib/branchPushState';
import { selectMountStatusRead } from '../../store/slices/history/selectMountStatusRead';
import { selectActiveMountId } from '../../store/slices/project-mounts/selectors';
import type { AppState } from '../../store/types';

type Params = {
  readonly state: AppState;
  readonly sessionId: SessionId;
  readonly mountId: MountId | null;
};

export const unpushedCommitsOf = ({ state, sessionId, mountId }: Params): number => {
  const target = mountId ?? selectActiveMountId({ state, sessionId });
  if (target === null) {
    return 0;
  }
  const status = selectMountStatusRead({ state, sessionId, mountId: target })?.status ?? null;
  return branchPushFactsOf({ status }).toPush;
};
