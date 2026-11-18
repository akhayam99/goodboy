import { useCallback } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { branchPlace } from '../../../../store/slices/navigation/place';
import type { BranchTab } from '../../../../store/slices/navigation/types';

type Params = {
  readonly sessionId: SessionId;
  readonly mountPath: string | null;
  readonly tab: BranchTab;
};

export const useSelectBranchTab = ({ sessionId, mountPath, tab }: Params) => {
  const navigate = useAppStore((s) => s.navigate);
  return useCallback(
    (next: BranchTab): void => {
      if (next === tab) {
        return;
      }
      navigate({ to: branchPlace({ sessionId, mountPath, tab: next }), mode: 'replace' });
    },
    [mountPath, navigate, sessionId, tab],
  );
};
