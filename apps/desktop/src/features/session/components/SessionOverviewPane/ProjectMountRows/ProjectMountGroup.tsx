import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Button, Collapsible, EmptyLine, Skeleton, Tooltip, cn } from '@goodboy/ui';
import type { SessionId, WorktreeStatus } from '@goodboy/types';
import type { MountDiffStat } from '../../../../../store';
import {
  isOpenRequest,
  type MountProjectGroup,
  type MountRowView,
} from '../../../../../store/slices/project-mounts/mountRowModel';
import {
  CONCEPT_ICONS,
  ICON_SIZE,
  projectGlyph,
} from '../../../../../shared/components/conceptIcons';
import { DiffStat } from '../../DiffStat';
import { isBranchMergedOf } from '../../../../../shared/lib/branchPresence';
import { NewBranchMountAction } from './NewBranchMountAction';
import { MountActionsMenu } from './MountActionsMenu';
import { MountTrackGrid } from './MountTrackGrid';
import { ProjectMountRow } from './ProjectMountRow';
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

export const ProjectMountGroup = ({
  sessionId,
  group,
  diffStats,
  worktreeStatuses,
  pendingWorktrees,
  isFolded = false,
  isSkeleton = false,
}: Props) => {
  const [isCompletedShown, setIsCompletedShown] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const statusOf = (row: MountRowView): WorktreeStatus | null =>
    row.worktreePath === null ? null : (worktreeStatuses.get(row.worktreePath) ?? null);
  const commitsAfterMergeOf = useMergedThen({
    rows: [...group.rows, ...group.completedRows],
    statusOf,
  });
  const isMergedRow = (row: MountRowView): boolean =>
    row.projectKind === 'repo' &&
    isBranchMergedOf({
      status: statusOf(row),
      baseBranch: row.baseBranch,
      isMainCheckout: row.isMainCheckout,
      isRequestMerged: row.request?.state === 'merged',
      hasOpenRequest: isOpenRequest({ request: row.request }),
      commitsAfterMerge: commitsAfterMergeOf(row),
    });
  const isMovedPastMerge = (row: MountRowView): boolean => commitsAfterMergeOf(row) !== null;
  const openRows = [
    ...group.rows.filter((row) => !isMergedRow(row)),
    ...group.completedRows.filter(isMovedPastMerge).map((row) => ({ ...row, isCompleted: false })),
  ];
  const completedRows = [
    ...group.rows.filter(isMergedRow).map((row) => ({ ...row, isCompleted: true })),
    ...group.completedRows.filter((row) => !isMovedPastMerge(row)),
  ];
  const canFork = group.projectKind === 'repo';
  const GlyphIcon = projectGlyph({ kind: group.projectKind });
  const headPath =
    group.rows.find((row) => row.worktreePath !== null)?.worktreePath ??
    group.completedRows.find((row) => row.worktreePath !== null)?.worktreePath ??
    '';

  const renderRow = (row: MountRowView) => (
    <ProjectMountRow
      key={row.mountId}
      sessionId={sessionId}
      row={row}
      label={rowLabel({ row })}
      diffStat={row.worktreePath === null ? null : (diffStats.get(row.worktreePath) ?? null)}
      worktreeStatus={statusOf(row)}
      isMerged={isMergedRow(row)}
      commitsAfterMerge={commitsAfterMergeOf(row)}
      isStatusPending={row.worktreePath !== null && pendingWorktrees.has(row.worktreePath)}
      isSkeleton={isSkeleton}
    />
  );

  const rows = (
    <>
      <ul
        aria-label={`${group.projectName} worktrees`}
        className="col-span-full grid grid-cols-subgrid gap-y-0.5 pl-4"
      >
        {openRows.map(renderRow)}
      </ul>
      {openRows.length === 0 ? (
        <EmptyLine icon={CONCEPT_ICONS.branch} className="col-span-full pl-6">
          No open worktrees.
        </EmptyLine>
      ) : null}
      {completedRows.length === 0 ? null : (
        <div className="col-span-full flex pl-5">
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={isCompletedShown}
            onClick={() => setIsCompletedShown(!isCompletedShown)}
          >
            <ChevronRight
              size={ICON_SIZE.row}
              aria-hidden
              className={cn(
                'shrink-0 motion-safe:transition-transform',
                isCompletedShown && 'rotate-90',
              )}
            />
            Completed
            <span className="font-mono tabular-nums">{completedRows.length}</span>
          </Button>
        </div>
      )}
      {isCompletedShown && completedRows.length > 0 ? (
        <ul
          aria-label={`${group.projectName} completed worktrees`}
          className="col-span-full grid grid-cols-subgrid gap-y-0.5 pl-4"
        >
          {completedRows.map(renderRow)}
        </ul>
      ) : null}
    </>
  );

  if (isFolded) {
    const inReview = openRows.filter(
      (row) => row.request?.state === 'open' && !row.request.isDraft,
    ).length;
    const totals = openRows.reduce(
      (sum, row) => {
        const stat = row.worktreePath === null ? undefined : diffStats.get(row.worktreePath);
        return stat === undefined
          ? sum
          : {
              additions: sum.additions + stat.additions,
              deletions: sum.deletions + stat.deletions,
            };
      },
      { additions: 0, deletions: 0 },
    );
    return (
      <div className="col-span-full min-w-0">
        <Collapsible
          open={isOpen}
          onOpenChange={setIsOpen}
          trigger={
            <span className="flex min-w-0 items-center gap-2">
              <GlyphIcon
                size={ICON_SIZE.control}
                aria-hidden
                className="shrink-0 text-muted-foreground"
              />
              <span className="truncate text-row text-foreground">{group.projectName}</span>
              {isSkeleton ? (
                <Skeleton className="h-3.5 w-40" />
              ) : (
                <span className="flex min-w-0 items-center gap-2 text-label text-muted-foreground">
                  <span className="text-foreground">{`${openRows.length} worktrees`}</span>
                  <span aria-hidden>·</span>
                  <span>{`${inReview} in review`}</span>
                  {totals.additions === 0 && totals.deletions === 0 ? null : (
                    <>
                      <span aria-hidden>·</span>
                      <DiffStat
                        additions={totals.additions}
                        deletions={totals.deletions}
                        size="inherit"
                      />
                    </>
                  )}
                </span>
              )}
            </span>
          }
        >
          <MountTrackGrid className="gap-y-0.5">{rows}</MountTrackGrid>
        </Collapsible>
      </div>
    );
  }

  return (
    <div className="col-span-full grid min-w-0 grid-cols-subgrid gap-y-0.5">
      <div className="col-span-full flex min-h-8 min-w-0 items-center gap-2 px-2">
        <GlyphIcon
          size={ICON_SIZE.control}
          aria-hidden
          className="shrink-0 text-muted-foreground"
        />
        <span className="truncate text-row text-foreground">{group.projectName}</span>
        {group.seriesName === null ? null : (
          <Tooltip content="Each part of this split is its own branch and pull request">
            <span className="truncate text-meta text-muted-foreground">{group.seriesName}</span>
          </Tooltip>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {canFork ? (
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
        </div>
      </div>
      {rows}
    </div>
  );
};
