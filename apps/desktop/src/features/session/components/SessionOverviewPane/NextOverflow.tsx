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
};

export const NextOverflow = ({ sessionId, cards, actionsFor, openFor }: Props) => {
  if (cards.length === 0) {
    return null;
  }
  return (
    <div
      role="group"
      aria-label={NAMES.moreNextSteps}
      data-overview-next-overflow=""
      className="flex min-w-0 flex-col gap-1"
    >
      {cards.map((card) => (
        <MoveCard
          key={card.id}
          sessionId={sessionId}
          card={card}
          actionsFor={actionsFor}
          openFor={openFor}
          density="row"
          isPrimary={false}
          kicker={null}
        />
      ))}
    </div>
  );
};
