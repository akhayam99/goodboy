import { useCallback, useState } from 'react';
import type { AutoTreeId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { tauriDatabase } from '../../../../shared/lib/db';
import { NOTHING_CHANGED } from '../../../../store/slices/notifications/errorRecovery';
import { dropAutoPlan } from '../dropAutoPlan';

type Params = {
  readonly sessionId: SessionId;
};

type DropParams = {
  readonly treeId: AutoTreeId;
  readonly artifactId: string;
};

export type DropAutoPlan = Readonly<{
  isDropping: boolean;
  drop: (params: DropParams) => Promise<void>;
}>;

export const useDropAutoPlan = ({ sessionId }: Params): DropAutoPlan => {
  const loadAutoTrees = useAppStore((state) => state.loadAutoTrees);
  const reportError = useAppStore((state) => state.reportError);
  const [isDropping, setIsDropping] = useState(false);
  const drop = useCallback(
    async ({ treeId, artifactId }: DropParams): Promise<void> => {
      setIsDropping(true);
      try {
        await dropAutoPlan({ db: tauriDatabase, treeId, artifactId });
        await loadAutoTrees({ sessionId });
      } catch (error) {
        await reportError({
          recovery: NOTHING_CHANGED,
          title: "Couldn't drop the plan",
          error,
          sessionId,
        });
      } finally {
        setIsDropping(false);
      }
    },
    [loadAutoTrees, reportError, sessionId],
  );
  return { isDropping, drop };
};
