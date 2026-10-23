import type { MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import { branchPlace } from '../../store/slices/navigation/place';
import type { BranchTab } from '../../store/slices/navigation/types';
import { branchLandingTabOf } from './branchLandingTab';

type Params = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly worktreePath: string;
  readonly mode?: 'push' | 'replace';
  readonly tab?: BranchTab;
};

export const switchBranchMount = async ({
  sessionId,
  mountId,
  worktreePath,
  mode = 'replace',
  tab,
}: Params): Promise<void> => {
  const before = useAppStore.getState();
  try {
    await before.setSessionActiveMount({ sessionId, mountId });
  } catch (error) {
    void before.reportError({ title: "Couldn't switch to that branch", error, sessionId });
    return;
  }
  useAppStore.getState().navigate({
    to: branchPlace({
      sessionId,
      mountPath: worktreePath,
      tab: tab ?? branchLandingTabOf({ deepLink: null }),
    }),
    mode,
  });
};
