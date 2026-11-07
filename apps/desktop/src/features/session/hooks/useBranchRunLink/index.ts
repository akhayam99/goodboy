import { useMemo } from 'react';
import type { MountId, Session } from '@goodboy/types';
import { branchRunLinkOf, type BranchRunLink } from '../../branchRunLinkOf';
import { useMountRows } from '../../../../shared/hooks/useMountRows';
import { useSessionRuns } from '../useSessionRuns';

type Params = {
  readonly session: Session;
  readonly mountId: MountId | null;
};

export const useBranchRunLink = ({ session, mountId }: Params): BranchRunLink | null => {
  const runs = useSessionRuns({ session });
  const mountGroups = useMountRows({ sessionId: session.id });
  return useMemo(
    () =>
      mountId === null
        ? null
        : branchRunLinkOf({
            runs,
            mounts: mountGroups.flatMap((group) => [...group.rows, ...group.finishedRows]),
            mountId,
          }),
    [runs, mountGroups, mountId],
  );
};
