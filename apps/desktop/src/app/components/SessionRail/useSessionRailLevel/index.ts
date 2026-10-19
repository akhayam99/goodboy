import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { RailLevel } from '../../../../store/slices/navigation/railLevel';
import { isBranchlessSession } from '../../../../shared/utils/isBranchlessSession';

type Params = {
  readonly sessionId: SessionId;
  readonly isFolded: boolean;
};

export const useSessionRailLevel = ({ sessionId, isFolded }: Params): RailLevel => {
  const isBranchShown = useAppStore(
    (state) =>
      state.activeLens[sessionId] === 'branch' &&
      !isBranchlessSession({ branch: state.sessionBranches[sessionId] }),
  );
  return isFolded && isBranchShown ? 'worktree' : 'session';
};
