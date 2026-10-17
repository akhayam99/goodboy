import { useId } from 'react';
import { ChevronDown } from 'lucide-react';
import { Reveal, SelectableRow, cn } from '@goodboy/ui';
import type { SessionId, WorktreeStatus } from '@goodboy/types';
import type { MountProjectGroup } from '../../../../store/slices/project-mounts/mountRowModel';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { countSlotText } from '../../../../shared/utils/countSlotText';
import type { EntryDiffStat } from '../../../../features/branch/worktreeEntryFacts';
import type { RailTreeNode, RailTreeOpen } from './useRailTreeOpen';
import { WorktreeRow } from './WorktreeRow';

type Props = {
  readonly sessionId: SessionId;
  readonly group: MountProjectGroup;
  readonly tree: RailTreeOpen;
  readonly statuses: ReadonlyMap<string, WorktreeStatus>;
  readonly diffStats: ReadonlyMap<string, EntryDiffStat>;
  readonly shownPath: string | null;
  readonly openedPath: string | null;
};

export const ProjectTree = ({
  sessionId,
  group,
  tree,
  statuses,
  diffStats,
  shownPath,
  openedPath,
}: Props) => {
  const branchesId = useId();
  const rows = [...group.rows, ...group.finishedRows];
  const node: RailTreeNode = { kind: 'project', id: group.projectId, isOpenByDefault: true };
  const isOpen = tree.isOpen(node);
  const count = countSlotText({ count: rows.length });
  const branchWord = rows.length === 1 ? 'branch' : 'branches';

  return (
    <div data-card-project={group.projectName} className="flex flex-col">
      <SelectableRow
        selected={false}
        isExpanded={isOpen}
        ariaLabel={`${group.projectName}, ${rows.length} ${branchWord}`}
        onClick={() => tree.toggle(node)}
        className="h-7 items-center gap-2 pl-1 pr-0 text-ui"
      >
        <CONCEPT_ICONS.projectFolder size={ICON_SIZE.row} aria-hidden className="shrink-0" />
        <span className="min-w-0 flex-1 truncate text-left">{group.projectName}</span>
        {count === null ? null : (
          <span
            data-project-count=""
            className="shrink-0 text-meta tabular-nums text-faint-foreground"
          >
            {count}
          </span>
        )}
        <span className="flex w-6 shrink-0 items-center justify-center">
          <ChevronDown
            size={ICON_SIZE.row}
            aria-hidden
            className={cn(
              'text-faint-foreground motion-safe:transition-transform',
              !isOpen && '-rotate-90',
            )}
          />
        </span>
      </SelectableRow>
      <Reveal open={isOpen} id={branchesId}>
        <ul aria-label={`${group.projectName} worktrees`} className="flex flex-col">
          {rows.map((row) => (
            <li key={row.mountId}>
              <WorktreeRow
                sessionId={sessionId}
                row={row}
                tree={tree}
                status={row.worktreePath === null ? null : (statuses.get(row.worktreePath) ?? null)}
                isShown={row.worktreePath !== null && row.worktreePath === shownPath}
                isOpened={row.worktreePath !== null && row.worktreePath === openedPath}
                diff={row.worktreePath === null ? null : (diffStats.get(row.worktreePath) ?? null)}
              />
            </li>
          ))}
        </ul>
      </Reveal>
    </div>
  );
};
