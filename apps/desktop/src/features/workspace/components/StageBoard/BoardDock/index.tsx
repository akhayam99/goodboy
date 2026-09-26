import { useCallback, useEffect, useRef, useState, type FocusEvent } from 'react';
import { cn, FOCUS_RING, PANE_RHYTHM, tintClasses } from '@goodboy/ui';
import type { BoardCollapsibleColumn } from '../../../hooks/useBoardCollapse';
import { boardColumnIds } from '../boardColumnIds';
import { describeDockColumn } from './describeDockColumn';
import { useHoverIntent } from './useHoverIntent';

const HOVER_ENTER_MS = 120;

const HOVER_LEAVE_MS = 200;

const DOCK_ICON_SIZE = 16;

export type BoardDockEntry = {
  readonly column: BoardCollapsibleColumn;
  readonly count: number;
};

type Props = {
  readonly entries: ReadonlyArray<BoardDockEntry>;
  readonly isLassoActive: boolean;
  readonly onOpen: (column: BoardCollapsibleColumn) => void;
};

export const BoardDock = ({ entries, isLassoActive, onOpen }: Props) => {
  const dockRef = useRef<HTMLDivElement | null>(null);
  const [hasFocus, setHasFocus] = useState(false);
  const hover = useHoverIntent({
    enterDelayMs: HOVER_ENTER_MS,
    leaveDelayMs: HOVER_LEAVE_MS,
    isDisabled: isLassoActive,
  });
  const isWide = hover.isHovering || hasFocus;
  const entriesKey = entries.map((entry) => entry.column).join(',');

  useEffect(() => {
    const dock = dockRef.current;
    setHasFocus(dock !== null && dock.contains(document.activeElement));
  }, [entriesKey]);

  const onFocus = useCallback(() => setHasFocus(true), []);
  const onBlur = useCallback((event: FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget.contains(next)) {
      return;
    }
    setHasFocus(false);
  }, []);

  return (
    <div
      ref={dockRef}
      data-board-dock
      data-wide={isWide}
      onPointerEnter={hover.onPointerEnter}
      onPointerLeave={hover.onPointerLeave}
      onFocus={onFocus}
      onBlur={onBlur}
      className={cn(
        'z-10 flex shrink-0 flex-col self-start rounded-lg',
        PANE_RHYTHM.board.dockSticky,
        isWide ? PANE_RHYTHM.board.dockOpen : PANE_RHYTHM.board.dock,
        isWide && 'bg-subtle p-1 shadow-lg',
        'motion-safe:transition-[width] motion-safe:ease-[cubic-bezier(0.2,0,0,1)]',
        isWide ? 'motion-safe:duration-160' : 'motion-safe:duration-140',
      )}
    >
      {entries.map((entry) => {
        const column = describeDockColumn({ column: entry.column, count: entry.count });
        const Icon = column.icon;
        const ids = boardColumnIds({ key: entry.column });
        const isEmpty = entry.count === 0;
        const toneText = isEmpty ? 'text-faint-foreground' : tintClasses(column.tone).text;
        return (
          <button
            key={entry.column}
            id={ids.dock}
            type="button"
            aria-expanded={false}
            aria-controls={ids.column}
            aria-label={column.ariaLabel}
            onClick={() => onOpen(entry.column)}
            className={cn(
              'flex w-full items-center rounded-md hover:bg-hover',
              FOCUS_RING,
              isWide ? 'h-8 flex-row gap-2 px-2' : 'h-13 flex-col justify-center gap-1',
            )}
          >
            <Icon size={DOCK_ICON_SIZE} aria-hidden className={cn('shrink-0', toneText)} />
            {isWide && (
              <span
                aria-hidden
                className={cn(
                  'min-w-0 flex-1 truncate text-left text-label font-medium',
                  toneText,
                  'motion-safe:transition-opacity motion-safe:delay-60 motion-safe:duration-100 motion-safe:starting:opacity-0',
                )}
              >
                {column.label}
              </span>
            )}
            <span
              aria-hidden
              className={cn(
                'text-secondary tabular-nums',
                isEmpty ? 'text-faint-foreground' : 'text-muted-foreground',
              )}
            >
              {column.countLabel}
            </span>
          </button>
        );
      })}
    </div>
  );
};
