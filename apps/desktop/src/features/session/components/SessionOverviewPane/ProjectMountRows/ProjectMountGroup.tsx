import { useState } from 'react';
import { CircleCheck } from 'lucide-react';
import { Band, CountToggle, EmptyLine, Tooltip } from '@goodboy/ui';
import type { SessionId, WorktreeStatus } from '@goodboy/types';
import type { MountDiffStat } from '../../../../../store';
import {
  classifyMountRows,
  type MountProjectGroup,
  type MountRowView,
} from '../../../../../store/slices/project-mounts/mountRowModel';
import { CONCEPT_ICONS } from '../../../../../shared/components/conceptIcons';
import { NewBranchMountAction } from './NewBranchMountAction';
import { MountActionsMenu } from './MountActionsMenu';
import { MountTrackGrid } from './MountTrackGrid';
import { ProjectGroupHeader } from './ProjectGroupHeader';
import { ProjectMountRow } from './ProjectMountRow';
import { MOUNT_CHILD_PAD, MOUNT_ROW_PAD, MOUNT_TOGGLE_PAD } from './mountGrid';
import { useMergedThen } from './useMergedThen';

type Props = {
  readonly sessionId: SessionId;
  readonly group: MountProjectGroup;
  readonly diffStats: ReadonlyMap<string, MountDiffStat>;
  readonly worktreeStatuses: ReadonlyMap<string, WorktreeStatus>;
  readonly pendingWorktrees: ReadonlySet<string>;
  readonly isFolded?: boolean;
  readonly isSkeleton?: boolean;
};

type LabelParams = {
  readonly row: MountRowView;
};

const rowLabel = ({ row }: LabelParams): string =>
  row.branch === '' ? row.projectName : `${row.projectName} on ${row.branch}`;

const CHILD_STYLE = { paddingLeft: MOUNT_CHILD_PAD, paddingRight: MOUNT_ROW_PAD };

export const ProjectMountGroup = ({
  sessionId,
  group,
  diffStats,
  worktreeStatuses,
  pendingWorktrees,
  isFolded = false,
  isSkeleton = false,
}: Props) => {
  const [isFinishedShown, setIsFinishedShown] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const statusOf = (row: MountRowView): WorktreeStatus | null =>
    row.worktreePath === null ? null : (worktreeStatuses.get(row.worktreePath) ?? null);
  const commitsAfterMergeOf = useMergedThen({
    rows: [...group.rows, ...group.finishedRows],
    statusOf,
  });
  const { open: openRows, finished: finishedRows } = classifyMountRows({
    group,
    statusOf,
    commitsAfterMergeOf,
  });
  const headPath =
    group.rows.find((row) => row.worktreePath !== null)?.worktreePath ??
    group.finishedRows.find((row) => row.worktreePath !== null)?.worktreePath ??
    '';
  const isShowingRows = !isFolded || isExpanded;

  const renderRow = (row: MountRowView) => (
    <ProjectMountRow
      key={row.mountId}
      sessionId={sessionId}
      row={row}
      label={rowLabel({ row })}
      diffStat={row.worktreePath === null ? null : (diffStats.get(row.worktreePath) ?? null)}
      worktreeStatus={statusOf(row)}
      commitsAfterMerge={commitsAfterMergeOf(row)}
      isStatusPending={row.worktreePath !== null && pendingWorktrees.has(row.worktreePath)}
      isSkeleton={isSkeleton}
    />
  );

  return (
    <Band>
      <MountTrackGrid className="gap-y-0.5">
        <ProjectGroupHeader
          group={group}
          openCount={openRows.length}
          finishedCount={finishedRows.length}
          isDisclosure={isFolded}
          isExpanded={isExpanded}
          isSkeleton={isSkeleton}
          onToggle={() => setIsExpanded(!isExpanded)}
        >
          {group.projectKind === 'repo' ? (
            <NewBranchMountAction
              sessionId={sessionId}
              projectId={group.projectId}
              projectName={group.projectName}
            />
          ) : null}
          <MountActionsMenu
            sessionId={sessionId}
            projectId={group.projectId}
            workspaceId={group.workspaceId ?? undefined}
            projectName={group.projectName}
            worktreePath={headPath}
          />
        </ProjectGroupHeader>
        {isShowingRows ? (
          <>
            <ul
              aria-label={`${group.projectName} worktrees`}
              className="col-span-full grid grid-cols-subgrid gap-y-0.5"
            >
              {openRows.map(renderRow)}
            </ul>
            {openRows.length === 0 ? (
              <div className="col-span-full" style={CHILD_STYLE}>
                <EmptyLine icon={CONCEPT_ICONS.branch}>No open worktrees.</EmptyLine>
              </div>
            ) : null}
            {finishedRows.length === 0 ? null : (
              <div data-slot="mount-finished-toggle" className="col-span-full flex">
                <Tooltip content="Merged or closed">
                  <span style={{ paddingLeft: MOUNT_TOGGLE_PAD }} className="flex">
                    <CountToggle
                      label="finished"
                      count={finishedRows.length}
                      isShown={isFinishedShown}
                      icon={CircleCheck}
                      onChange={setIsFinishedShown}
                    />
                  </span>
                </Tooltip>
              </div>
            )}
            {isFinishedShown && finishedRows.length > 0 ? (
              <ul
                aria-label={`${group.projectName} finished worktrees`}
                className="col-span-full grid grid-cols-subgrid gap-y-0.5"
              >
                {finishedRows.map(renderRow)}
              </ul>
            ) : null}
          </>
        ) : null}
      </MountTrackGrid>
    </Band>
  );
};
