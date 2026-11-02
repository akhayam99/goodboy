import { cn, PANE_RHYTHM, Skeleton } from '@goodboy/ui';

const SKELETON_CARDS = [3, 2, 2, 1, 2, 1];

type Props = {
  readonly lanes: 5 | 6;
};

export const BoardSkeleton = ({ lanes }: Props) => (
  <div
    className={cn(
      'grid min-h-0 w-full flex-1 grid-rows-[minmax(0,1fr)] overflow-hidden',
      PANE_RHYTHM.board.laneGap,
      lanes === 6 ? PANE_RHYTHM.board.lanesSix : PANE_RHYTHM.board.lanesFive,
    )}
    role="status"
    aria-label="Loading board"
  >
    {SKELETON_CARDS.slice(0, lanes).map((cards, lane) => (
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
