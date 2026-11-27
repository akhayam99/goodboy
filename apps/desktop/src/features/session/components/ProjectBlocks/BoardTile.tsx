import { memo } from 'react';
import { brandId, type MountId } from '@goodboy/types';
import { Button, Chip, cn, ROW_HOVER, StatusDot, Tooltip } from '@goodboy/ui';
import { sessionPlace, useAppStore } from '../../../../store';
import { failingChecksOf } from '../../../branch/checks/failingChecksOf';
import { branchTabPlaceOf } from '../../../branch/branchTabPlaceOf';
import { TRAIL_SLOT } from '../../../../shared/components/trailingSlot';
import { useMountRowMenu } from '../../hooks/useMountRowMenu';
import { MountRowMenuButton } from '../MountRowMenuButton';
import { boardRowCellsOf } from '../../central/board/boardRowCellsOf';
import { boardTileChipOf } from '../../central/board/boardTileChipOf';
import { OverlapChip } from '../../../overlap/OverlapChip';
import { BoardBranchName } from './BoardBranchName';
import { BoardTileAction } from './BoardTileAction';
import { BoardTileFacts } from './BoardTileFacts';
import { useBoardContext } from './useBoardContext';

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
    newRowIds,
    now,
    isPermissionShown,
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
  const row = rowById.get(rowId);
  if (row === undefined) {
    return null;
  }
  const runningCount = runningByRowId.get(rowId) ?? 0;
  const stateChip = boardTileChipOf({ row, entry, runningCount, isPermissionShown });
  const isCheckNamed =
    stateChip !== null && failingName !== null && entry?.story.word === stateChip.word;
  const chip =
    stateChip === null || failingName === null || !isCheckNamed
      ? stateChip
      : { ...stateChip, word: `${failingName} failed` };
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
        {entry === null ? null : (
          <BoardTileFacts rowId={rowId} title={title} onOpenChanges={openChanges} />
        )}
      </span>
      <span className="pointer-events-none relative flex min-w-0 shrink-0 items-center gap-3 text-meta">
        {chip === null ? null : (
          <span
            data-board-chip=""
            className={cn('flex max-w-48 min-w-0', isCheckNamed && 'pointer-events-auto')}
          >
            <Chip
              kind="state"
              tone={chip.tone}
              emphasis="subtle"
              bordered={false}
              className="min-w-0 shrink"
              {...(isCheckNamed && { title: chip.word })}
              label={<span className="min-w-0 truncate">{chip.word}</span>}
            />
          </span>
        )}
        {entry === null ? null : (
          <OverlapChip mountId={brandId<MountId>({ value: entry.fact.mountId })} />
        )}
        <BoardTileAction rowId={rowId} />
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
