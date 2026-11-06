import { useMemo } from 'react';
import { Button } from '@goodboy/ui';
import type { MountId, Session } from '@goodboy/types';
import { branchRunLinkOf } from '../../session/branchRunLinkOf';
import { useSessionRuns } from '../../session/hooks/useSessionRuns';
import { openBranchRuns } from '../../session/openBranchRuns';
import { useMountRows } from '../../session/components/SessionOverviewPane/ProjectMountRows/useMountRows';

type Props = {
  readonly session: Session;
  readonly mountId: MountId;
  readonly mountPath: string | null;
};

export const BranchRunsLine = ({ session, mountId, mountPath }: Props) => {
  const runs = useSessionRuns({ session });
  const mountGroups = useMountRows({ sessionId: session.id });
  const link = useMemo(
    () =>
      branchRunLinkOf({
        runs,
        mounts: mountGroups.flatMap((group) => [...group.rows, ...group.finishedRows]),
        mountId,
      }),
    [runs, mountGroups, mountId],
  );
  if (link === null) {
    return null;
  }
  return (
    <p data-branch-runs-line="" className="flex min-w-0 items-center gap-2 text-ui">
      <span className="text-muted-foreground">On this branch</span>
      <Button
        variant="quiet"
        size="xs"
        onClick={() =>
          openBranchRuns({ sessionId: session.id, groupKey: link.groupKey, mountPath })
        }
      >
        {link.label}
      </Button>
    </p>
  );
};
