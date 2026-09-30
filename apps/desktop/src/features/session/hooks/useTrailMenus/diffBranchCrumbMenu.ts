import { LayoutDashboard } from 'lucide-react';
import type { CrumbMenuModel } from '@goodboy/ui';
import { openLens } from '../../openLens';
import { branchMenu } from '../../trail/menus/branchMenu';
import type { TrailMenuScope } from './trailMenuScope';

export const diffBranchCrumbMenu = (scope: TrailMenuScope): CrumbMenuModel => {
  const { sessionId, mounts, diffPath, diffStats, branchStatuses, mergedMountIds } = scope;
  return branchMenu({
    mounts,
    currentPath: diffPath,
    statOf: (mount) => diffStats.get(mount.worktreePath) ?? null,
    statusOf: (mount) => branchStatuses.get(mount.worktreePath) ?? null,
    isRequestMergedOf: (mount) => mergedMountIds.includes(mount.mountId),
    actions: [
      {
        id: 'all-branches',
        label: 'All branches in Overview',
        icon: LayoutDashboard,
        confirm: null,
        onRun: () => openLens({ sessionId, lens: null }),
      },
    ],
    onSelect: (mount) => scope.openMountDiff(sessionId, mount.worktreePath),
  });
};
