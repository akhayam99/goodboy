import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { branchTabOf } from '../../../../store/slices/session-view/branchTabOf';
import type { BranchTab } from '../../../../store/slices/navigation/types';

type Params = {
  readonly sessionId: SessionId;
  readonly pinned?: BranchTab;
};

export const useBranchTab = ({ sessionId, pinned }: Params): BranchTab =>
  useAppStore((state) => pinned ?? branchTabOf({ state, sessionId }));
