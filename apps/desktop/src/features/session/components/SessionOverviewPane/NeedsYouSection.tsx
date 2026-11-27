import { SectionLabel, StatusDot } from '@goodboy/ui';
import type { OpenQuestion, SessionId } from '@goodboy/types';
import { NAMES } from '../../../../shared/utils/names';
import type { ActionCardModel } from '../../central/next/actionCardsOf';
import type { ActionCardActions } from '../../central/next/useActionCardActions';
import { STAGE_TONE } from '../../session-stage';
import { MoveCard } from '../MoveCard';
import { NeedsYouQuestion } from './NeedsYouQuestion';

type Props = {
  readonly sessionId: SessionId;
  readonly cards: ReadonlyArray<ActionCardModel>;
  readonly questions: ReadonlyArray<OpenQuestion>;
  readonly actionsFor: ActionCardActions['actionsFor'];
  readonly kickerById: ReadonlyMap<string, string>;
};

export const NeedsYouSection = ({ sessionId, cards, questions, actionsFor, kickerById }: Props) => {
  const [move] = cards;
  if (move === undefined && questions.length === 0) {
    return null;
  }
  return (
    <section
      aria-label={NAMES.needsYou}
      data-overview-section="needs-you"
      className="flex min-w-0 flex-col gap-2"
    >
      <span className="flex h-7 min-w-0 items-center gap-2">
        <StatusDot tone={STAGE_TONE.attention} size="sm" />
        <SectionLabel label={NAMES.needsYou} headingLevel={2} />
      </span>
      <div data-needs-you-rows="" className="flex min-w-0 flex-col gap-1 rounded-lg bg-subtle p-2">
        {cards.map((card, index) => (
          <MoveCard
            key={card.id}
            sessionId={sessionId}
            card={card}
            actionsFor={actionsFor}
            density="needs"
            isPrimary={index === 0}
            project={kickerById.get(card.id) ?? null}
          />
        ))}
        {questions.map((question, index) => (
          <NeedsYouQuestion
            key={question.id}
            sessionId={sessionId}
            question={question}
            isPrimary={move === undefined && index === 0}
          />
        ))}
      </div>
    </section>
  );
};
