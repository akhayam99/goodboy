import { PageSkeleton, ScrollFade, SectionLabel, Skeleton, SkeletonText } from '@goodboy/ui';
import { PANE_RHYTHM } from '@goodboy/ui';
import { OVERVIEW_CARD_SURFACE } from '../../../central/cards/overviewCardSurface';
import { overviewCardsOf } from '../../../central/overviewCardsOf';

const PROJECT_ROWS = [0, 1];
const CARD_ROWS = [0, 1];

type Props = {
  readonly isFreshLayout: boolean;
};

export const SessionOverviewSkeleton = ({ isFreshLayout }: Props) => {
  const cards = overviewCardsOf({
    cards: [],
    waitingCount: 0,
    runningCount: isFreshLayout ? 0 : 1,
    stuckCount: 0,
    branchCount: 0,
    doneCount: 0,
    isArchived: false,
  });
  return (
    <ScrollFade className="h-full" fadeSize={24}>
      <PageSkeleton page="overview" label="Loading session overview">
        <div className={PANE_RHYTHM.stack}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-6 w-24 rounded-md" />
                  <Skeleton className="h-6 w-20 rounded-md" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-6 w-28 rounded-md" />
                  <Skeleton className="h-6 w-14 rounded-md" />
                </div>
              </div>
            </div>
            <SkeletonText lines={2} />
            <div className="flex flex-col gap-2">
              {PROJECT_ROWS.map((row) => (
                <Skeleton key={row} className="h-9 w-full rounded-md" />
              ))}
            </div>
          </div>

          <div data-central-column-skeleton="" className={PANE_RHYTHM.groups}>
            {cards.map((card) => (
              <section
                key={card.id}
                data-overview-card={card.id}
                aria-label={card.title}
                className={OVERVIEW_CARD_SURFACE}
              >
                <header className="flex min-w-0 items-center justify-between gap-2">
                  <SectionLabel
                    headingLevel={2}
                    label={card.title}
                    count={<Skeleton className="h-3 w-4 rounded-sm" />}
                  />
                </header>
                {CARD_ROWS.slice(0, card.id === 'needs-you' ? 2 : 1).map((row) => (
                  <div key={row} className="flex min-w-0 flex-col gap-2">
                    <Skeleton className="h-4 w-2/5" />
                    <Skeleton className="h-3 w-3/4 rounded-sm" />
                  </div>
                ))}
              </section>
            ))}
          </div>
        </div>
      </PageSkeleton>
    </ScrollFade>
  );
};
