import { SectionLabel } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { NAMES } from '../../../../shared/utils/names';
import type { ActionCardModel } from '../../central/next/actionCardsOf';
import type { ActionCardActions } from '../../central/next/useActionCardActions';
import { MoveCard } from '../MoveCard';

type Props = {
  readonly sessionId: SessionId;
  readonly cards: ReadonlyArray<ActionCardModel>;
  readonly actionsFor: ActionCardActions['actionsFor'];
  readonly openFor: ActionCardActions['openFor'];
  readonly hasFilledMove: boolean;
};

export const NextSection = ({ sessionId, cards, actionsFor, openFor, hasFilledMove }: Props) => {
  if (cards.length === 0) {
    return null;
  }
  return (
    <section
      aria-label={NAMES.nextSection}
      data-overview-section="next"
      className="flex min-w-0 flex-col gap-1"
    >
      <span className="flex h-7 items-center">
        <SectionLabel label={NAMES.nextSection} headingLevel={2} />
      </span>
      {cards.map((card, index) => (
        <MoveCard
          key={card.id}
          sessionId={sessionId}
          card={card}
          actionsFor={actionsFor}
          openFor={openFor}
          density="row"
          isPrimary={hasFilledMove && index === 0}
          project={null}
        />
      ))}
    </section>
  );
};
