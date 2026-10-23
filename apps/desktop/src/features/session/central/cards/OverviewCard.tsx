import type { ReactNode } from 'react';
import { Eyebrow } from '@goodboy/ui';
import type { OverviewCardModel } from '../overviewCardsOf';

type Props = {
  readonly card: OverviewCardModel;
  readonly hasHeader?: boolean;
  readonly aside?: ReactNode;
  readonly children: ReactNode;
};

const SURFACE = 'flex min-w-0 flex-col gap-3 rounded-lg bg-subtle p-4';

export const OverviewCard = ({ card, hasHeader = true, aside, children }: Props) => {
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
        <span className="flex min-w-0 items-center gap-2">
          <Eyebrow label={card.title} muted />
          <span data-overview-count="" className="text-ui tabular-nums text-faint-foreground">
            {card.count}
          </span>
        </span>
        {aside}
      </header>
      {children}
    </section>
  );
};
