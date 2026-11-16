import { memo } from 'react';
import { Button, Chip, cn, ROW_HOVER, StatusDot, Tooltip } from '@goodboy/ui';
import { branchPlace, sessionPlace, useAppStore } from '../../../../store';
import { boardRowCellsOf } from '../../central/board/boardRowCellsOf';
import { boardTileChipOf } from '../../central/board/boardTileChipOf';
import { BoardBranchName } from './BoardBranchName';
import { BoardTileAction } from './BoardTileAction';
import { BoardTileFacts } from './BoardTileFacts';
import { useBoardContext } from './useBoardContext';

type Props = {
  readonly rowId: string;
};

const BoardTileView = ({ rowId }: Props) => {
  const { session, rowById, entryByRowId, runningByRowId, cardsByRowId, newRowIds, now } =
    useBoardContext();
  const navigate = useAppStore((state) => state.navigate);
  const row = rowById.get(rowId);
  if (row === undefined) {
    return null;
  }
  const entry = entryByRowId.get(rowId) ?? null;
  const runningCount = runningByRowId.get(rowId) ?? 0;
  const chip = boardTileChipOf({ row, entry, runningCount });
  const title =
    row.branch === null
      ? boardRowCellsOf({
          row,
          entry,
          mergedAt: null,
          now,
          runningCount,
          nextTitle: cardsByRowId.get(rowId)?.[0]?.title ?? null,
        }).title
      : row.branch;
  const open = () =>
    navigate({
      to:
        entry === null
          ? sessionPlace({ sessionId: session.id, lens: 'workflows' })
          : branchPlace({ sessionId: session.id, mountPath: entry.fact.mountPath, tab: 'pr' }),
    });
  return (
    <div
      data-board-row={rowId}
      data-board-state={chip.word}
      className={cn(
        'relative flex min-h-14 min-w-0 items-center gap-3 rounded-md bg-background px-3 py-2',
        ROW_HOVER,
      )}
    >
      <Button
        variant="quiet"
        role="link"
        aria-label={`Open ${title}`}
        onClick={open}
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
          {row.projectName === null ? null : (
            <span className="min-w-0 shrink-[2] truncate text-meta text-muted-foreground">
              {row.projectName}
            </span>
          )}
        </span>
        {entry === null ? null : <BoardTileFacts rowId={rowId} />}
      </span>
      <span className="pointer-events-none relative flex min-w-0 shrink-0 items-center gap-3 text-meta">
        <span data-board-chip="" className="flex shrink-0">
          <Chip
            kind="state"
            tone={chip.tone}
            emphasis="subtle"
            bordered={false}
            label={chip.word}
          />
        </span>
        <BoardTileAction rowId={rowId} />
      </span>
    </div>
  );
};

export const BoardTile = memo(BoardTileView);
