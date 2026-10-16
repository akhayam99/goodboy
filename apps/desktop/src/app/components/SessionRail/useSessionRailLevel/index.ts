import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { isAutoLevelLeft, type RailLevel } from '../../../../store/slices/navigation/railLevel';
import { isBranchlessSession } from '../../../../shared/utils/isBranchlessSession';
import { usePresetRunFocus } from '../../../../features/session/hooks/usePresetRunFocus';
import { useIsOnAutoAgent } from '../useIsOnAutoAgent';

type Params = {
  readonly sessionId: SessionId;
};

export const useSessionRailLevel = ({ sessionId }: Params): RailLevel => {
  const isBranchShown = useAppStore(
    (state) =>
      state.activeLens[sessionId] === 'branch' &&
      !isBranchlessSession({ branch: state.sessionBranches[sessionId] }),
  );
  const runFocus = usePresetRunFocus({ sessionId });
  const isAutoLeft = useAppStore((state) => isAutoLevelLeft({ state }));
  const isOnAutoAgent = useIsOnAutoAgent({ currentSessionId: sessionId });
  if (runFocus !== null) {
    return 'run';
  }
  if (isOnAutoAgent && !isAutoLeft) {
    return 'auto';
  }
  return isBranchShown ? 'worktree' : 'session';
};
