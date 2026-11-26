import { useCallback, useMemo, useRef, useState } from 'react';
import type { MountCleanupProposal, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../../store';
import { formatBytes } from '../../../../../shared/utils/formatBytes';
import { uniqueByMount } from '../uniqueByMount';

type Params = {
  readonly sessionId: SessionId;
  readonly mergedMountIds: ReadonlySet<string>;
};

export type RemoveWorktrees = Readonly<{
  targets: ReadonlyArray<MountCleanupProposal>;
  isBusy: boolean;
  sizeLabel: string | null;
  run: (params: RunParams) => Promise<void>;
}>;

type RunParams = {
  readonly mountIds?: ReadonlyArray<string>;
};

export const useRemoveWorktrees = ({ sessionId, mergedMountIds }: Params): RemoveWorktrees => {
  const proposals = useAppStore((state) => state.mountCleanupProposals[sessionId] ?? EMPTY_ARRAY);
  const [busyMountIds, setBusyMountIds] = useState<ReadonlySet<string>>(new Set());
  const inFlight = useRef(false);
  const targets = useMemo(
    () => uniqueByMount({ proposals: proposals.filter((p) => mergedMountIds.has(p.mountId)) }),
    [mergedMountIds, proposals],
  );
  const sizeLabel = useMemo(() => {
    const sizes = targets.flatMap((proposal) =>
      proposal.sizeBytes === null ? [] : [proposal.sizeBytes],
    );
    return sizes.length === 0
      ? null
      : formatBytes({ bytes: sizes.reduce((sum, size) => sum + size, 0) });
  }, [targets]);
  const run = useCallback(
    async ({ mountIds }: RunParams) => {
      if (inFlight.current) {
        return;
      }
      inFlight.current = true;
      const wanted = mountIds === undefined ? null : new Set<string>(mountIds);
      try {
        const { deleteMergedBranches } = await import('../deleteMergedBranches');
        await deleteMergedBranches({
          sessionId,
          proposals: targets.filter((proposal) => wanted === null || wanted.has(proposal.mountId)),
          onBusy: ({ mountId, isBusy }) =>
            setBusyMountIds((current) => {
              const next = new Set(current);
              if (isBusy) {
                next.add(mountId);
                return next;
              }
              next.delete(mountId);
              return next;
            }),
        });
      } finally {
        inFlight.current = false;
      }
    },
    [sessionId, targets],
  );
  return { targets, isBusy: busyMountIds.size > 0, sizeLabel, run };
};
