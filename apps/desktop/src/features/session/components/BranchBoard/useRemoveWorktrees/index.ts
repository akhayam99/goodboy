import { useCallback, useMemo, useRef, useState } from 'react';
import type { MountCleanupProposal, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../../store';
import { formatBytes } from '../../../../../shared/utils/formatBytes';

type Params = {
  readonly sessionId: SessionId;
  readonly mergedMountIds: ReadonlySet<string>;
};

export type WorktreeFailure = Readonly<{
  mountId: string;
  branch: string;
  reason: string;
}>;

export type RemoveWorktrees = Readonly<{
  targets: ReadonlyArray<MountCleanupProposal>;
  failures: ReadonlyArray<WorktreeFailure>;
  isBusy: boolean;
  sizeLabel: string | null;
  run: (params: RunParams) => Promise<void>;
}>;

type RunParams = {
  readonly mountIds?: ReadonlyArray<string>;
};

type ReasonParams = {
  readonly error: unknown;
};

const failureReasonOf = ({ error }: ReasonParams): string =>
  error instanceof Error && error.message !== '' ? error.message : 'It stays where it was.';

export const useRemoveWorktrees = ({ sessionId, mergedMountIds }: Params): RemoveWorktrees => {
  const proposals = useAppStore((state) => state.mountCleanupProposals[sessionId] ?? EMPTY_ARRAY);
  const resolveMountCleanup = useAppStore((state) => state.resolveMountCleanup);
  const [failureByMountId, setFailureByMountId] = useState<ReadonlyMap<string, string>>(new Map());
  const [busyMountIds, setBusyMountIds] = useState<ReadonlySet<string>>(new Set());
  const inFlight = useRef(false);
  const targets = useMemo(
    () => proposals.filter((proposal) => mergedMountIds.has(proposal.mountId)),
    [mergedMountIds, proposals],
  );
  const failures = useMemo(
    () =>
      targets.flatMap((proposal): ReadonlyArray<WorktreeFailure> => {
        const reason = failureByMountId.get(proposal.mountId);
        return reason === undefined
          ? []
          : [{ mountId: proposal.mountId, branch: proposal.branch, reason }];
      }),
    [failureByMountId, targets],
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
      const snapshot = targets.filter(
        (proposal) => wanted === null || wanted.has(proposal.mountId),
      );
      try {
        for (const proposal of snapshot) {
          setBusyMountIds((current) => new Set([...current, proposal.mountId]));
          setFailureByMountId((current) => {
            const next = new Map(current);
            next.delete(proposal.mountId);
            return next;
          });
          try {
            await resolveMountCleanup({
              sessionId,
              requestId: proposal.requestId,
              decision: 'remove',
            });
          } catch (error) {
            setFailureByMountId((current) =>
              new Map(current).set(proposal.mountId, failureReasonOf({ error })),
            );
          }
          setBusyMountIds((current) => {
            const next = new Set(current);
            next.delete(proposal.mountId);
            return next;
          });
        }
      } finally {
        inFlight.current = false;
      }
    },
    [resolveMountCleanup, sessionId, targets],
  );
  return { targets, failures, isBusy: busyMountIds.size > 0, sizeLabel, run };
};
