import type { MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import { branchPlace } from '../../store/slices/navigation/place';

type Params = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly worktreePath: string;
};

export const switchBranchMount = ({ sessionId, mountId, worktreePath }: Params): void => {
  const state = useAppStore.getState();
  void state.setSessionActiveMount({ sessionId, mountId }).catch(() => undefined);
  state.navigate({
    to: branchPlace({
      sessionId,
      mountPath: worktreePath,
      tab: state.branchTab?.[sessionId] ?? 'comments',
    }),
    mode: 'replace',
  });
};
