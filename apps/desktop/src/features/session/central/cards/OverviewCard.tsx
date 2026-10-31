import type { ReactNode } from 'react';
import { SectionLabel } from '@goodboy/ui';
import type { OverviewCardModel } from '../overviewCardsOf';

type Props = {
  readonly card: OverviewCardModel;
  readonly hasHeader?: boolean;
  readonly regionLabel?: string;
  readonly aside?: ReactNode;
  readonly countNote?: string | null;
  readonly children: ReactNode;
};

const SURFACE = 'flex min-w-0 flex-col gap-3 rounded-lg bg-subtle p-4';

export const OverviewCard = ({
  card,
  hasHeader = true,
  regionLabel,
  aside,
  countNote = null,
  children,
}: Props) => {
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
            <>
              <span data-overview-count="">{card.count}</span>
              {countNote === null ? null : <span data-overview-note="">, {countNote}</span>}
            </>
          }
        />
        {aside}
      </header>
      {children}
    </section>
  );
};
