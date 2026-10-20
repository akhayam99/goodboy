import { useCallback, useState, type ReactNode } from 'react';
import { Button, SectionHeader } from '@goodboy/ui';
import { useElementWidth } from '../../../../shared/hooks/useElementWidth';
import { ActionCard } from './ActionCard';
import type { ActionCardModel } from './actionCardsOf';
import type { ActionCardActions } from './useActionCardActions';

const NARROW_COLUMN_PX = 560;

const SHOWN_CARDS = 5;

type NextChipParams = {
  readonly card: ActionCardModel;
};

type Props = {
  readonly cards: ReadonlyArray<ActionCardModel>;
  readonly actionsFor: ActionCardActions['actionsFor'];
  readonly chipFor?: (params: NextChipParams) => ReactNode;
};

export const NextStackView = ({ cards, actionsFor, chipFor }: Props) => {
  const { ref: observe, width: observedWidth } = useElementWidth();
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const ref = useCallback(
    (node: HTMLElement | null) => {
      observe(node);
      const measured = node === null ? 0 : node.getBoundingClientRect().width;
      setMeasuredWidth(measured > 0 ? measured : null);
    },
    [observe],
  );
  const width = observedWidth ?? measuredWidth;
  const isNarrow = width !== null && width < NARROW_COLUMN_PX;
  if (cards.length === 0) {
    return null;
  }
  const isFolded = cards.length > SHOWN_CARDS && !isExpanded;
  const shown = (isFolded ? cards.slice(0, SHOWN_CARDS) : cards).map((card) => ({
    card,
    actions: actionsFor({ card, isNarrow }),
  }));
  const hasOverflowColumn = shown.some(
    ({ actions }) => actions.menu !== null || actions.foldedTarget !== null,
  );
  return (
    <section ref={ref} aria-label="Next steps" className="flex min-w-0 flex-col gap-2">
      <SectionHeader
        label="Next"
        headingLevel={2}
        meta={<span className="text-label text-faint-foreground">{cards.length}</span>}
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
            hasOverflowColumn={hasOverflowColumn}
            chip={chipFor?.({ card })}
          />
        ))}
      </div>
    </section>
  );
};
