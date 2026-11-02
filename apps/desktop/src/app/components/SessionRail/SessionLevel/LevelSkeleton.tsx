import { cn, Skeleton } from '@goodboy/ui';
import { CARD_INSET, CARD_ROW_INSET } from './railInset';

const LEVEL_SKELETON_CARDS = [
  { label: 'Projects', rows: 2 },
  { label: 'Linked', rows: 1 },
];

export const LevelSkeleton = () => (
  <div
    role="status"
    aria-label="Loading session"
    data-level-skeleton=""
    className="flex flex-col gap-4"
  >
    {LEVEL_SKELETON_CARDS.map((card) => (
      <div
        key={card.label}
        data-level-card={card.label}
        className={cn('flex min-w-0 flex-col rounded-lg bg-subtle', CARD_INSET)}
      >
        <div className="flex h-7 min-w-0 items-center">
          <span className={cn('truncate text-eyebrow text-faint-foreground', CARD_ROW_INSET)}>
            {card.label}
          </span>
        </div>
        {Array.from({ length: card.rows }, (_, row) => (
          <div key={row} className={cn('flex h-7 items-center', CARD_ROW_INSET)}>
            <Skeleton className="h-3 w-3/5" />
          </div>
        ))}
      </div>
    ))}
  </div>
);
