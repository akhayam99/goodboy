import { useMemo, useState } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { branchesMetaOf } from '../branches/branchesMetaOf';
import type { BranchScope } from '../branches/branchScope';
import { classifyBranchScan } from '../branches/classifyBranchScan';
import { isListedBranch } from '../branches/classifyBranch';
import { useBranchProjects } from '../hooks/useBranchProjects';

type Params = {
  readonly workspaceId: WorkspaceId;
};

export const useBranchesMeta = ({ workspaceId }: Params): string | undefined => {
  const scope = useMemo<BranchScope>(() => ({ kind: 'workspace', id: workspaceId }), [workspaceId]);
  const projects = useBranchProjects({ scope });
  const scans = useAppStore((state) => state.branchScans);
  const [now] = useState(() => Date.now());
  const entries = useMemo(
    () =>
      projects
        .flatMap((project) => classifyBranchScan({ scan: scans[project.id], now }))
        .filter((entry) => isListedBranch({ entry })),
    [projects, scans, now],
  );
  const isReady = projects.some((project) => scans[project.id]?.status === 'ready');
  return isReady ? branchesMetaOf({ entries }) : undefined;
};
