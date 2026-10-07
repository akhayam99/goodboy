import { LayoutDashboard } from 'lucide-react';
import type { CrumbMenuModel } from '@goodboy/ui';
import { switchBranchMount } from '../../../branch/switchBranchMount';
import { openLens } from '../../openLens';
import { branchMenu } from '../../trail/menus/branchMenu';
import type { TrailMenuScope } from './trailMenuScope';

export const diffBranchCrumbMenu = (scope: TrailMenuScope): CrumbMenuModel => {
  const { sessionId, mounts, diffPath, diffStats, branchStatuses, mergedMountIds } = scope;
  const { openRequestHeads } = scope;
  return branchMenu({
    mounts,
    currentPath: diffPath,
    statOf: (mount) => diffStats.get(mount.worktreePath) ?? null,
    statusOf: (mount) => branchStatuses.get(mount.worktreePath) ?? null,
    isRequestMergedOf: (mount) => mergedMountIds.includes(mount.mountId),
    openRequestOf: (mount) => {
      const head = openRequestHeads[mount.mountId];
      return head === undefined ? null : { headSha: head === '' ? null : head };
    },
    actions: [
      {
        id: 'all-branches',
        label: 'All branches in Session',
        icon: LayoutDashboard,
        confirm: null,
        onRun: () => openLens({ sessionId, lens: null }),
      },
    ],
    onSelect: (mount) =>
      switchBranchMount({ sessionId, mountId: mount.mountId, worktreePath: mount.worktreePath }),
  });
};
