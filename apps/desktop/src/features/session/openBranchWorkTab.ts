import type { MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import { branchPlace } from '../../store/slices/navigation/place';
import { branchPageMountOf } from './branchPageMountOf';

type Params = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
};

export const openBranchWorkTab = ({ sessionId, mountId }: Params): void => {
  const state = useAppStore.getState();
  const mount = branchPageMountOf({ mounts: state.sessionProjectMounts[sessionId] ?? [], mountId });
  if (mount === null) {
    return;
  }
  state.navigate({ to: branchPlace({ sessionId, mountPath: mount.worktreePath, tab: 'work' }) });
};
