import { useState, type ReactNode } from 'react';
import { Button, SectionHeader } from '@goodboy/ui';
import { ActionCard } from '../../../../../../features/session/central/next/ActionCard';
import type { ActionCardModel } from '../../../../../../features/session/central/next/actionCardsOf';
import type { ActionCardActions } from '../../../../../../features/session/central/next/useActionCardActions';

const SHOWN_CARDS = 5;

type ChipParams = {
  readonly card: ActionCardModel;
};

type Props = {
  readonly cards: ReadonlyArray<ActionCardModel>;
  readonly actionsFor: ActionCardActions['actionsFor'];
  readonly chipFor: (params: ChipParams) => ReactNode;
};

export const NextListBeforeView = ({ cards, actionsFor, chipFor }: Props) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const isFolded = cards.length > SHOWN_CARDS && !isExpanded;
  const shown = (isFolded ? cards.slice(0, SHOWN_CARDS) : cards).map((card) => ({
    card,
    actions: actionsFor({ card }),
  }));
  return (
    <section aria-label="Next steps" data-next-stack="" className="flex min-w-0 flex-col gap-2">
      <SectionHeader
        label="Next"
        headingLevel={2}
        meta={<span className="text-meta text-faint-foreground">{cards.length}</span>}
        action={
          isFolded ? (
            <Button size="sm" variant="secondary" onClick={() => setIsExpanded(true)}>
              {`Show ${cards.length - SHOWN_CARDS} more`}
            </Button>
          ) : null
        }
      />
      <div className="flex flex-col gap-1">
        {shown.map(({ card, actions }, index) => (
          <ActionCard
            key={card.id}
            card={card}
            actions={actions}
            isFirst={index === 0}
            hasOverflowColumn
            chip={chipFor({ card })}
          />
        ))}
      </div>
    </section>
  );
};
