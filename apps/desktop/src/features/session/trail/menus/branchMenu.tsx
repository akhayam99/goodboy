import type { SessionProjectMount, WorktreeStatus } from '@goodboy/types';
import type {
  CrumbMenuAction,
  CrumbMenuGroup,
  CrumbMenuModel,
  CrumbMenuRow,
  CrumbState,
} from '@goodboy/ui';
import { ArrowDown, Cloud, CloudOff, GitMerge, Laptop } from 'lucide-react';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import {
  branchPresenceOf,
  branchPriorityOf,
  isBranchMergedOf,
  mainPresenceOf,
  type BranchPriorityKind,
} from '../../../../shared/lib/branchPresence';
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

type BranchLook = Pick<CrumbState, 'tone' | 'glyph'>;

const PRIORITY_LOOK = {
  merged: { tone: 'merged', glyph: GitMerge },
  'gone-on-origin': { tone: 'danger', glyph: CloudOff },
  'local-only': { tone: 'warning', glyph: Laptop },
  'behind-main': { tone: 'warning', glyph: ArrowDown },
  'on-origin': { tone: 'neutral', glyph: Cloud },
} satisfies Record<BranchPriorityKind, BranchLook>;

export type BranchPlace = Pick<SessionProjectMount, 'baseBranch' | 'worktreePath' | 'repoRoot'>;

type BranchStateParams = {
  readonly status: WorktreeStatus | null;
  readonly mount: BranchPlace | null;
};

export const branchStateOf = ({ status, mount }: BranchStateParams): CrumbState | null => {
  if (status === null) {
    return null;
  }
  const isMerged =
    mount !== null &&
    isBranchMergedOf({
      status,
      baseBranch: mount.baseBranch,
      isMainCheckout: mount.worktreePath === mount.repoRoot,
      isRequestMerged: false,
    });
  const priority = branchPriorityOf({
    presence: branchPresenceOf({ status, isMerged }),
    main: mainPresenceOf({ status, isRebasingAgent: false }),
  });
  return { word: priority.word, ...PRIORITY_LOOK[priority.kind] };
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
      state: branchStateOf({ status: statusOf(mount), mount }),
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
