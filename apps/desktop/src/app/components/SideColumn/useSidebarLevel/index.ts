import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import {
  isSessionLevelLeft,
  type SidebarLevel,
} from '../../../../store/slices/navigation/sidebarLevel';
import { isBranchlessSession } from '../../../../shared/utils/isBranchlessSession';
import type { ColumnPlace } from '../columnPlace';

type Params = {
  readonly place: ColumnPlace;
  readonly currentSessionId: SessionId | null;
};

export const useSidebarLevel = ({ place, currentSessionId }: Params): SidebarLevel => {
  const isLeft = useAppStore((state) => isSessionLevelLeft({ state }));
  const isBranchShown = useAppStore(
    (state) =>
      currentSessionId !== null &&
      state.activeLens[currentSessionId] === 'branch' &&
      !isBranchlessSession({ branch: state.sessionBranches[currentSessionId] }),
  );
  if (place !== null || currentSessionId === null || isLeft) {
    return 'workspace';
  }
  return isBranchShown ? 'worktree' : 'session';
};
