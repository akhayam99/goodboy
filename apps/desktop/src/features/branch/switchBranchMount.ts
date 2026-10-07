import type { MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import { branchPlace } from '../../store/slices/navigation/place';

type Params = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly worktreePath: string;
};

export const switchBranchMount = async ({
  sessionId,
  mountId,
  worktreePath,
}: Params): Promise<void> => {
  const before = useAppStore.getState();
  try {
    await before.setSessionActiveMount({ sessionId, mountId });
  } catch (error) {
    void before.reportError({ title: "Couldn't switch to that branch", error, sessionId });
    return;
  }
  const state = useAppStore.getState();
  state.navigate({
    to: branchPlace({
      sessionId,
      mountPath: worktreePath,
      tab: state.branchTab?.[sessionId] ?? 'comments',
    }),
    mode: 'replace',
  });
};
