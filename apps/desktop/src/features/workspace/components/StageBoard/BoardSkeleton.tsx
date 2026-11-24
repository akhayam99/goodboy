import { cn, PANE_RHYTHM, Skeleton } from '@goodboy/ui';
import type { BoardLanes } from './boardLanesOf';
import { laneColumnsOf } from './laneColumnsOf';

const SKELETON_CARDS = [3, 2, 2, 1, 2];

type Props = {
  readonly layout: BoardLanes;
  readonly laneRem: number;
};

export const BoardSkeleton = ({ layout, laneRem }: Props) => {
  const columns = laneColumnsOf({ layout, laneRem });
  return (
    <div
      style={columns.style}
      className={cn(
        'grid min-h-0 w-full flex-1 grid-rows-[minmax(0,1fr)] overflow-hidden',
        PANE_RHYTHM.board.laneGap,
        columns.className,
      )}
      role="status"
      aria-label="Loading board"
    >
      {SKELETON_CARDS.slice(0, layout.lanes).map((cards, lane) => (
        <div key={lane} className={cn('flex min-h-0 flex-col', PANE_RHYTHM.board.laneStack)}>
          <Skeleton className="h-4 w-24 rounded-full" />
          <div className={cn('flex flex-col', PANE_RHYTHM.board.cardGap)}>
            {Array.from({ length: cards }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
