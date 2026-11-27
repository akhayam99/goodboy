import { memo } from 'react';
import { brandId, type MountId } from '@goodboy/types';
import { Button, cn, ROW_HOVER, StatusDot, tintClasses, Tooltip } from '@goodboy/ui';
import { sessionPlace, useAppStore } from '../../../../store';
import { hasOpenRebaseStopOf } from '../../../branch/hasOpenRebaseStopOf';
import { failingChecksOf } from '../../../branch/checks/failingChecksOf';
import { branchTabPlaceOf } from '../../../branch/branchTabPlaceOf';
import { TRAIL_SLOT } from '../../../../shared/components/trailingSlot';
import { useMountRowMenu } from '../../hooks/useMountRowMenu';
import { MountRowMenuButton } from '../MountRowMenuButton';
import { boardRowCellsOf } from '../../central/board/boardRowCellsOf';
import { branchRowOf } from '../../central/board/branchRowOf';
import { useOverlapCaution } from '../../../overlap/hooks/useOverlapCaution';
import { BoardBranchName } from './BoardBranchName';
import { BoardTileAction } from './BoardTileAction';
import { BoardTileFacts } from './BoardTileFacts';
import { useBoardContext } from './useBoardContext';

const NO_MOUNT = 'no-mount';

type Props = {
  readonly rowId: string;
};

const BoardTileView = ({ rowId }: Props) => {
  const {
    session,
    rowById,
    entryByRowId,
    runningByRowId,
    cardsByRowId,
    shownAskIds,
    newRowIds,
    now,
    permissionMount,
  } = useBoardContext();
  const navigate = useAppStore((state) => state.navigate);
  const entry = entryByRowId.get(rowId) ?? null;
  const menu = useMountRowMenu({
    sessionId: session.id,
    mountId: entry === null ? null : entry.fact.mountId,
    anchorKey: `board-mount-${rowId}`,
  });
  const failingName = useAppStore((state) =>
    entry === null || entry.story.state !== 'checks-failing' || entry.fact.request === null
      ? null
      : (failingChecksOf({
          state,
          sessionId: session.id,
          mountId: brandId<MountId>({ value: entry.fact.mountId }),
          prNumber: entry.fact.request.number,
        })?.checks[0]?.name ?? null),
  );
  const isRebaseStopped = useAppStore((state) =>
    entry === null
      ? false
      : hasOpenRebaseStopOf({
          state,
          sessionId: session.id,
          mountId: brandId<MountId>({ value: entry.fact.mountId }),
        }),
  );
  const row = rowById.get(rowId);
  const caution = useOverlapCaution({
    mountId: brandId<MountId>({ value: entry === null ? NO_MOUNT : entry.fact.mountId }),
    isSettled: row?.isSettled === true,
  });
  if (row === undefined) {
    return null;
  }
  const runningCount = runningByRowId.get(rowId) ?? 0;
  const branchRow = branchRowOf({
    row,
    entry,
    runningCount,
    cards: cardsByRowId.get(rowId) ?? [],
    shownAskIds,
    isPermissionShown: permissionMount !== null && permissionMount.mountId === row.mountId,
    isRebaseStopped,
    failingCheckName: failingName,
    overlap:
      caution === null ? null : { fileCount: caution.fileCount, otherName: caution.otherBranch },
  });
  const title =
    row.branch === null
      ? boardRowCellsOf({
          row,
          entry,
          settledAt: null,
          now,
          runningCount,
          nextTitle: cardsByRowId.get(rowId)?.[0]?.title ?? null,
        }).title
      : row.branch;
  const openOverview = () =>
    navigate({
      to:
        entry === null
          ? sessionPlace({ sessionId: session.id, lens: 'workflows' })
          : branchTabPlaceOf({ sessionId: session.id, mountId: entry.fact.mountId, tab: 'pr' }),
    });
  const openChanges = () => {
    if (entry === null) {
      return;
    }
    navigate({
      to: branchTabPlaceOf({ sessionId: session.id, mountId: entry.fact.mountId, tab: 'files' }),
    });
  };
  return (
    <div
      data-board-row={rowId}
      data-row={`board-mount-${rowId}`}
      onContextMenu={menu.onContextMenu}
      onKeyDown={menu.onKeyDown}
      className={cn(
        'group/row relative flex min-h-14 min-w-0 items-center gap-3 rounded-md bg-background px-3 py-2',
        ROW_HOVER,
      )}
    >
      <Button
        variant="quiet"
        role="link"
        aria-label={`Open ${title} overview`}
        onClick={openOverview}
        className="absolute inset-0 h-auto w-auto rounded-md px-0 hover:bg-transparent"
      />
      <span className="pointer-events-none relative flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 items-baseline gap-2">
          {newRowIds.has(rowId) ? (
            <Tooltip content="New since you last looked">
              <span data-board-new="" className="pointer-events-auto flex shrink-0 self-center">
                <StatusDot tone="primary" size="sm" />
              </span>
            </Tooltip>
          ) : null}
          {row.branch === null ? (
            <span className="min-w-0 truncate text-row text-foreground">{title}</span>
          ) : (
            <BoardBranchName name={row.branch} />
          )}
        </span>
        {entry === null ? (
          branchRow.word === null ? null : (
            <span
              data-board-facts=""
              className="min-w-0 truncate text-meta tabular-nums text-muted-foreground"
            >
              <span data-board-word="" className={tintClasses(branchRow.word.tone).text}>
                {branchRow.word.word}
              </span>
            </span>
          )
        ) : (
          <BoardTileFacts
            rowId={rowId}
            title={title}
            word={branchRow.word}
            hoverFacts={branchRow.hoverFacts}
            onOpenChanges={openChanges}
          />
        )}
      </span>
      <span className="pointer-events-none relative flex min-w-0 shrink-0 items-center gap-3 text-meta">
        <BoardTileAction rowId={rowId} action={branchRow.action} caution={branchRow.caution} />
        {entry === null ? null : (
          <span data-board-actions="" className={cn(TRAIL_SLOT, 'pointer-events-auto row-actions')}>
            <MountRowMenuButton
              target={menu.target}
              projectName={entry.fact.projectName}
              branch={entry.fact.branch}
            />
          </span>
        )}
      </span>
    </div>
  );
};

export const BoardTile = memo(BoardTileView);
