import { memo } from 'react';
import { ChevronRight } from 'lucide-react';
import {
  Button,
  cn,
  formatUsd,
  ICON_SIZE,
  StageTrack,
  StatusDot,
  tintClasses,
  Tooltip,
} from '@goodboy/ui';
import { agentsWordOf, checksWordsOf, stageWordOf } from '../../central/board/boardRowWordsOf';
import { BoardOpenRow } from './BoardOpenRow';
import { BoardRowAction } from './BoardRowAction';
import { useBoardContext } from './useBoardContext';

type Props = {
  readonly rowId: string;
  readonly isOpen: boolean;
};

const CELL = 'pointer-events-none relative min-w-0';

const WIDE_ONLY = 'group-data-[narrow=true]/board:hidden';

const BoardRowView = ({ rowId, isOpen }: Props) => {
  const { rowById, entryByRowId, runningByRowId, mergedAtByMountId, newRowIds, now, onToggleRow } =
    useBoardContext();
  const row = rowById.get(rowId);
  if (row === undefined) {
    return null;
  }
  const entry = entryByRowId.get(rowId) ?? null;
  const requestFact = entry === null ? null : entry.fact.request;
  const mergedAt = row.mountId === null ? null : (mergedAtByMountId.get(row.mountId) ?? null);
  const checks = checksWordsOf({ entry });
  const tone = entry === null ? 'neutral' : entry.story.tone;
  const agents = agentsWordOf({ runningCount: runningByRowId.get(rowId) ?? 0 });
  return (
    <div data-board-row={rowId} className="col-span-full grid grid-cols-subgrid">
      <div className="relative col-span-full grid h-12 grid-cols-subgrid items-center rounded-md">
        <Button
          variant="quiet"
          aria-expanded={isOpen}
          aria-label={row.branch ?? 'Work not on a branch'}
          onClick={() => onToggleRow({ rowId })}
          className="absolute inset-0 h-auto w-auto px-0"
        />
        <span
          aria-hidden
          className={cn(CELL, 'flex items-center justify-center text-muted-foreground')}
        >
          <ChevronRight
            size={ICON_SIZE.control}
            className={cn('duration-150 motion-safe:transition-transform', isOpen && 'rotate-90')}
          />
        </span>
        <span data-board-cell="branch" className={cn(CELL, 'flex flex-col')}>
          {row.branch === null ? (
            <span className="min-w-0 truncate text-row text-foreground">{row.stage.reason}</span>
          ) : (
            <span className="flex min-w-0 items-center gap-2">
              {newRowIds.has(rowId) ? (
                <Tooltip content="New since you last looked">
                  <span data-board-new="" className="flex shrink-0">
                    <StatusDot tone="primary" size="sm" />
                  </span>
                </Tooltip>
              ) : null}
              <span className="min-w-0 truncate text-code text-foreground">{row.branch}</span>
            </span>
          )}
          <span className="min-w-0 truncate text-meta text-muted-foreground">
            {row.projectName ?? 'No project'}
          </span>
        </span>
        <span
          data-board-cell="request"
          className={cn(CELL, 'truncate text-meta tabular-nums text-faint-foreground')}
        >
          {requestFact === null ? '' : `${requestFact.noun}${requestFact.number}`}
        </span>
        <span
          data-board-cell="stage"
          className={cn(CELL, 'flex items-center gap-2 text-meta text-muted-foreground')}
        >
          {entry === null ? null : (
            <span data-board-track="" className={cn('flex shrink-0 items-center', WIDE_ONLY)}>
              <StageTrack stages={entry.story.steps} tone={tone} />
            </span>
          )}
          <span className={cn('min-w-0 truncate', tintClasses(tone).text)}>
            {stageWordOf({ row, entry, mergedAt, now })}
          </span>
        </span>
        <span
          data-board-cell="checks"
          className={cn(
            CELL,
            'truncate text-meta',
            checks.tone === null ? 'text-muted-foreground' : tintClasses(checks.tone).text,
          )}
        >
          {checks.text}
        </span>
        <span data-board-cell="needs" className={cn(CELL, 'flex items-center gap-2 text-meta')}>
          <BoardRowAction rowId={rowId} />
        </span>
        <span
          data-board-cell="agents"
          className={cn(CELL, 'truncate text-meta text-muted-foreground', WIDE_ONLY)}
        >
          {agents}
        </span>
        <span
          data-board-cell="spend"
          className={cn(
            CELL,
            'pr-2 text-right text-meta tabular-nums text-muted-foreground',
            WIDE_ONLY,
          )}
        >
          {row.spendUsd > 0 ? formatUsd(row.spendUsd) : ''}
        </span>
      </div>
      {isOpen ? <BoardOpenRow rowId={rowId} /> : null}
    </div>
  );
};

export const BoardRow = memo(BoardRowView);
