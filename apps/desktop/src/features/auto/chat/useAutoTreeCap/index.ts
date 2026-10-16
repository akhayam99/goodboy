import { useCallback } from 'react';
import { formatUsd } from '@goodboy/ui';
import type { AutoTreeId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { setAutoTreeCap } from '../../../../store/slices/auto/setAutoTreeCap';
import { tauriDatabase } from '../../../../shared/lib/db';
import { currentAutoDrivePort } from '../../autoDrivePort';
import { AUTO_LIMIT_COPY } from '../autoLimitCopy';

type Params = {
  readonly sessionId: SessionId;
  readonly treeId: AutoTreeId;
};

type SaveParams = {
  readonly expectedCapUsd: number | null;
  readonly capUsd: number | null;
};

export type AutoTreeCapSave = (params: SaveParams) => Promise<string | null>;

export const useAutoTreeCap = ({ sessionId, treeId }: Params): AutoTreeCapSave => {
  const loadAutoTrees = useAppStore((state) => state.loadAutoTrees);
  const reportError = useAppStore((state) => state.reportError);

  return useCallback(
    async ({ expectedCapUsd, capUsd }: SaveParams): Promise<string | null> => {
      try {
        const outcome = await setAutoTreeCap({
          db: tauriDatabase,
          treeId,
          expectedCapUsd,
          capUsd,
          nowMs: Date.now(),
          drive: currentAutoDrivePort(),
          onDriveError: (error) => {
            void reportError({ title: 'Auto hit a problem', error, sessionId });
          },
        });
        await loadAutoTrees({ sessionId });
        if (outcome.kind === 'applied') {
          return null;
        }
        if (outcome.kind === 'stale') {
          return AUTO_LIMIT_COPY.stale;
        }
        if (outcome.kind === 'below_used') {
          return `Spent and reserved are already ${formatUsd(outcome.usedUsd)}.`;
        }
        return AUTO_LIMIT_COPY.saveFailed;
      } catch {
        return AUTO_LIMIT_COPY.saveFailed;
      }
    },
    [loadAutoTrees, reportError, sessionId, treeId],
  );
};
