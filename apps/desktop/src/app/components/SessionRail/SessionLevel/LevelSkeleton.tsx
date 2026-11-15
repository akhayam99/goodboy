import { Band, PANE_RHYTHM, Skeleton, cn } from '@goodboy/ui';
import { ContextCardHead } from '../../../../features/session/components/ContextDrawer/ContextCardHead';
import { CONTEXT_CARD_BODY } from '../../../../features/session/components/ContextDrawer/contextCardBody';
import { CARD_ROW_INSET } from './railInset';

const LEVEL_SKELETON_CARDS = [
  { label: 'Projects', rows: 2 },
  { label: 'Linked', rows: 1 },
];

export const LevelSkeleton = () => (
  <div
    role="status"
    aria-label="Loading session"
    data-level-skeleton=""
    className={cn('flex flex-col', PANE_RHYTHM.block)}
  >
    {LEVEL_SKELETON_CARDS.map((card) => (
      <div key={card.label} data-level-card={card.label} className="min-w-0">
        <Band className="min-w-0">
          <ContextCardHead label={card.label} />
          <div className={CONTEXT_CARD_BODY.treeRows}>
            {Array.from({ length: card.rows }, (_, row) => (
              <div key={row} className={cn('flex h-7 items-center', CARD_ROW_INSET)}>
                <Skeleton className="h-3 w-3/5" />
              </div>
            ))}
          </div>
        </Band>
      </div>
    ))}
  </div>
);
