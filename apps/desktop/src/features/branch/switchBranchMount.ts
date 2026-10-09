import type { MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import { mountRequestOf } from '../../store/slices/project-mounts/mountRowModel';
import { branchPlace } from '../../store/slices/navigation/place';
import { branchLandingTabOf } from './branchLandingTab';

type Params = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly worktreePath: string;
  readonly mode?: 'push' | 'replace';
};

export const switchBranchMount = async ({
  sessionId,
  mountId,
  worktreePath,
  mode = 'replace',
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
      tab: branchLandingTabOf({
        hasPullRequest: mountRequestOf({ state, mountId }) !== null,
        deepLink: null,
      }),
    }),
    mode,
  });
};
