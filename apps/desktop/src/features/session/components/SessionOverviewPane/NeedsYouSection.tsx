import { SectionLabel, StatusDot, ToneBar } from '@goodboy/ui';
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
  readonly openFor: ActionCardActions['openFor'];
  readonly kickerById: ReadonlyMap<string, string>;
};

export const NeedsYouSection = ({
  sessionId,
  cards,
  questions,
  actionsFor,
  openFor,
  kickerById,
}: Props) => {
  const [move, ...rest] = cards;
  if (move === undefined && questions.length === 0) {
    return null;
  }
  return (
    <section
      aria-label={NAMES.needsYou}
      data-overview-section="needs-you"
      className="relative flex min-w-0 flex-col gap-3 rounded-lg bg-subtle p-4"
    >
      <ToneBar tone={STAGE_TONE.attention} density="card" />
      <span className="flex min-w-0 items-center gap-2">
        <StatusDot tone={STAGE_TONE.attention} size="sm" />
        <SectionLabel label={NAMES.needsYou} headingLevel={2} />
      </span>
      {move === undefined ? null : (
        <MoveCard
          sessionId={sessionId}
          card={move}
          actionsFor={actionsFor}
          openFor={openFor}
          density="focus"
          isPrimary
          kicker={kickerById.get(move.id) ?? null}
        />
      )}
      {rest.map((card) => (
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
      {questions.map((question, index) => (
        <NeedsYouQuestion
          key={question.id}
          sessionId={sessionId}
          question={question}
          isPrimary={move === undefined && index === 0}
        />
      ))}
    </section>
  );
};
