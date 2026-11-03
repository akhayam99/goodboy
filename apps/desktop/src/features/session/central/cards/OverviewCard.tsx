import type { ReactNode } from 'react';
import { SectionLabel, Tooltip } from '@goodboy/ui';
import { needsYouText } from '../../../../shared/utils/needsYouText';
import type { OverviewCardModel } from '../overviewCardsOf';
import { OVERVIEW_CARD_SURFACE as SURFACE } from './overviewCardSurface';

type Props = {
  readonly card: OverviewCardModel;
  readonly hasHeader?: boolean;
  readonly regionLabel?: string;
  readonly aside?: ReactNode;
  readonly children: ReactNode;
};

export const OverviewCard = ({ card, hasHeader = true, regionLabel, aside, children }: Props) => {
  if (!hasHeader && regionLabel !== undefined) {
    return (
      <section aria-label={regionLabel} data-overview-card={card.id} className={SURFACE}>
        {children}
      </section>
    );
  }
  if (!hasHeader) {
    return (
      <div data-overview-card={card.id} className={SURFACE}>
        {children}
      </div>
    );
  }
  return (
    <section aria-label={card.title} data-overview-card={card.id} className={SURFACE}>
      <header className="flex min-w-0 items-center justify-between gap-2">
        <SectionLabel
          headingLevel={2}
          label={card.title}
          count={
            card.id === 'needs-you' ? (
              <Tooltip content={needsYouText({ count: card.count, unit: 'items' })}>
                <span data-overview-count="">{card.count}</span>
              </Tooltip>
            ) : (
              <span data-overview-count="">{card.count}</span>
            )
          }
        />
        {aside}
      </header>
      {children}
    </section>
  );
};
