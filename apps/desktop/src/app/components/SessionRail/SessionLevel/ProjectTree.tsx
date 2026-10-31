import { useId } from 'react';
import { ChevronRight } from 'lucide-react';
import { REVIEW_SOURCE_LABEL } from '@goodboy/core';
import { ICON_SIZE, Reveal, SelectableRow } from '@goodboy/ui';
import type { SessionId, WorktreeStatus } from '@goodboy/types';
import type {
  MountProjectGroup,
  MountRowView,
} from '../../../../store/slices/project-mounts/mountRowModel';

import { useObjectMenuTrigger } from '../../../../features/actions/useObjectMenuTrigger';
import type { EntryDiffStat } from '../../../../features/branch/worktreeEntryFacts';
import type { RailTreeNode, RailTreeOpen } from './useRailTreeOpen';
import { FinishedFold } from './FinishedFold';
import { WorktreeRow } from './WorktreeRow';
import { ProjectRowAdd } from './ProjectRowAdd';
import { branchRowsOf } from './branchRowsOf';

type Props = {
  readonly sessionId: SessionId;
  readonly group: MountProjectGroup;
  readonly tree: RailTreeOpen;
  readonly statuses: ReadonlyMap<string, WorktreeStatus>;
  readonly diffStats: ReadonlyMap<string, EntryDiffStat>;
  readonly shownPath: string | null;
  readonly openedPath: string | null;
  readonly isBatchSettled: boolean;
};

type RowParams = {
  readonly row: MountRowView;
};

export const ProjectTree = ({
  sessionId,
  group,
  tree,
  statuses,
  diffStats,
  shownPath,
  openedPath,
  isBatchSettled,
}: Props) => {
  const branchesId = useId();
  const { live, finished } = branchRowsOf({ rows: group.rows, finishedRows: group.finishedRows });
  const total = live.length + finished.length;
  const node: RailTreeNode = { kind: 'project', id: group.projectId, isOpenByDefault: true };
  const isOpen = tree.isOpen(node);
  const menu = useObjectMenuTrigger({
    target: { kind: 'project', sessionId, projectId: group.projectId },
    anchorKey: `rail-project:${group.projectId}`,
  });
  const branchWord = total === 1 ? 'branch' : 'branches';
  const provider = [...live, ...finished].find((row) => row.request !== null)?.request?.provider;
  const hostSuffix = provider === undefined ? '' : `, on ${REVIEW_SOURCE_LABEL[provider]}`;
  const hasCurrentFinished = finished.some(
    (row) => row.worktreePath !== null && row.worktreePath === openedPath,
  );
  const finishedNode: RailTreeNode = {
    kind: 'finished',
    id: group.projectId,
    isOpenByDefault: false,
  };
  const renderRow = ({ row }: RowParams) => (
    <li key={row.mountId}>
      <WorktreeRow
        sessionId={sessionId}
        row={row}
        tree={tree}
        status={row.worktreePath === null ? null : (statuses.get(row.worktreePath) ?? null)}
        isShown={row.worktreePath !== null && row.worktreePath === shownPath}
        isOpened={row.worktreePath !== null && row.worktreePath === openedPath}
        isBatchSettled={isBatchSettled}
        diff={row.worktreePath === null ? null : (diffStats.get(row.worktreePath) ?? null)}
      />
    </li>
  );

  return (
    <div data-card-project={group.projectName} className="flex flex-col">
      <div
        data-project-row=""
        onContextMenu={menu.onContextMenu}
        onKeyDown={menu.onKeyDown}
        className="group/project-row flex min-w-0 items-center"
      >
        <SelectableRow
          selected={false}
          isExpanded={isOpen}
          ariaLabel={`${group.projectName}, ${total} ${branchWord}${hostSuffix}`}
          onClick={() => tree.toggle(node)}
          className="h-7 min-w-0 flex-1 items-center gap-1 pl-1 pr-0 text-ui"
        >
          <span className="min-w-0 truncate text-left text-row text-foreground">
            {group.projectName}
          </span>
          {isOpen ? null : (
            <ChevronRight
              size={ICON_SIZE.row}
              aria-hidden
              className="shrink-0 text-faint-foreground"
            />
          )}
        </SelectableRow>
        <ProjectRowAdd
          sessionId={sessionId}
          projectId={group.projectId}
          projectName={group.projectName}
        />
      </div>
      <Reveal open={isOpen} id={branchesId}>
        <ul aria-label={`${group.projectName} worktrees`} className="flex flex-col">
          {live.map((row) => renderRow({ row }))}
        </ul>
        {finished.length === 0 ? null : (
          <FinishedFold
            node={finishedNode}
            tree={tree}
            count={finished.length}
            isForcedOpen={hasCurrentFinished}
          >
            {finished.map((row) => renderRow({ row }))}
          </FinishedFold>
        )}
      </Reveal>
    </div>
  );
};
