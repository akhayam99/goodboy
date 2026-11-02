import { cn, PANE_RHYTHM, Skeleton } from '@goodboy/ui';

const COLUMN_SKELETON_CARDS = [0, 1];

type Props = {
  readonly label: string;
};

export const ColumnSkeleton = ({ label }: Props) => (
  <div role="status" aria-label={label} className={cn('flex flex-col', PANE_RHYTHM.board.cardGap)}>
    {COLUMN_SKELETON_CARDS.map((card) => (
      <Skeleton key={card} className="h-24 w-full rounded-lg" />
    ))}
  </div>
);
