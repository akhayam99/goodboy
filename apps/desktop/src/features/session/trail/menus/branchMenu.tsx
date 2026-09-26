import type { SessionProjectMount, WorktreeStatus } from '@goodboy/types';
import type {
  CrumbMenuAction,
  CrumbMenuGroup,
  CrumbMenuModel,
  CrumbMenuRow,
  CrumbState,
} from '@goodboy/ui';
import { ArrowDown, Cloud, Laptop } from 'lucide-react';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { distanceBehind } from '../../../../shared/lib/gitStatus';
import { DiffStat } from '../../components/DiffStat';

export type BranchStat = {
  readonly additions: number;
  readonly deletions: number;
};

type Params = {
  readonly mounts: ReadonlyArray<SessionProjectMount>;
  readonly currentPath: string | null;
  readonly statOf: (mount: SessionProjectMount) => BranchStat | null;
  readonly statusOf: (mount: SessionProjectMount) => WorktreeStatus | null;
  readonly actions: ReadonlyArray<CrumbMenuAction>;
  readonly onSelect: (mount: SessionProjectMount) => void;
};

export const branchStateOf = ({
  status,
}: {
  readonly status: WorktreeStatus | null;
}): CrumbState | null => {
  if (status === null) {
    return null;
  }
  if (status.upstream === null) {
    return { word: 'Local only', tone: 'warning', glyph: Laptop };
  }
  const behind = distanceBehind({ distance: status.mainDistance });
  if (behind !== null && behind > 0) {
    return { word: `Behind main by ${behind}`, tone: 'warning', glyph: ArrowDown };
  }
  return { word: 'On origin', tone: 'neutral', glyph: Cloud };
};

export const branchMenu = ({
  mounts,
  currentPath,
  statOf,
  statusOf,
  actions,
  onSelect,
}: Params): CrumbMenuModel => {
  const rowOf = (mount: SessionProjectMount): CrumbMenuRow => {
    const stat = statOf(mount);
    const hasChanges = stat !== null && (stat.additions > 0 || stat.deletions > 0);
    return {
      id: mount.worktreePath,
      lead: { kind: 'icon', icon: CONCEPT_ICONS.branch },
      label: mount.branch === '' ? mount.mountName : mount.branch,
      secondary: null,
      metaA:
        stat === null ? null : hasChanges ? (
          <DiffStat additions={stat.additions} deletions={stat.deletions} />
        ) : (
          <span className="text-faint-foreground">No changes</span>
        ),
      state: branchStateOf({ status: statusOf(mount) }),
      isCurrent: mount.worktreePath === currentPath,
      isDisabled: false,
      indent: 0,
      isMiddleTruncated: true,
      onSelect: () => onSelect(mount),
    };
  };
  const repos = [...new Set(mounts.map((mount) => mount.mountName))];
  const groups: ReadonlyArray<CrumbMenuGroup> = repos.map((repo) => ({
    id: repo,
    label: repo,
    rows: mounts.filter((mount) => mount.mountName === repo).map(rowOf),
  }));

  return {
    title: 'Branches',
    context: 'this session',
    count: mounts.length,
    triggerLabel: 'Switch branch',
    groups,
    actions: actions.slice(0, 2),
    width: 'wide',
    filterPlaceholder: 'Filter branches',
  };
};
