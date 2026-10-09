import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { branchTabOf } from '../../../../store/slices/session-view/branchTabOf';
import type { BranchTab } from '../../../../store/slices/navigation/types';

type Params = {
  readonly sessionId: SessionId;
  readonly mountPath: string | null;
};

export const useBranchTab = ({ sessionId, mountPath }: Params): BranchTab =>
  useAppStore((state) => branchTabOf({ state, sessionId, mountPath }));
