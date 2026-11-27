import { ICON_SIZE, SectionLabel, tintClasses } from '@goodboy/ui';
import type { OpenQuestion, SessionId } from '@goodboy/types';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { NAMES } from '../../../../shared/utils/names';
import type { ActionCardModel } from '../../central/next/actionCardsOf';
import type { ActionCardActions } from '../../central/next/useActionCardActions';
import { MoveCard } from '../MoveCard';
import { NeedsYouPermission } from './NeedsYouPermission';
import { NeedsYouQuestion } from './NeedsYouQuestion';
import type { SessionPermissionAsk } from './useSessionPermissionAsk';

type Props = {
  readonly sessionId: SessionId;
  readonly cards: ReadonlyArray<ActionCardModel>;
  readonly questions: ReadonlyArray<OpenQuestion>;
  readonly permission: SessionPermissionAsk | null;
  readonly actionsFor: ActionCardActions['actionsFor'];
  readonly kickerById: ReadonlyMap<string, string>;
};

export const NeedsYouSection = ({
  sessionId,
  cards,
  questions,
  permission,
  actionsFor,
  kickerById,
}: Props) => {
  const [move] = cards;
  if (move === undefined && questions.length === 0 && permission === null) {
    return null;
  }
  return (
    <section
      aria-label={NAMES.needsYou}
      data-overview-section="needs-you"
      className="flex min-w-0 flex-col gap-2"
    >
      <span className="flex h-7 min-w-0 items-center gap-2">
        <CONCEPT_ICONS.needsYou
          size={ICON_SIZE.row}
          aria-hidden
          className={tintClasses(CONCEPT_TONE.needsYou).icon}
        />
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
        {permission === null ? null : (
          <NeedsYouPermission
            key={`${permission.agentId}:${permission.ask.runId}:${permission.ask.toolUseId}`}
            sessionId={sessionId}
            agentId={permission.agentId}
            ask={permission.ask}
            isPrimary={move === undefined && questions.length === 0}
          />
        )}
      </div>
    </section>
  );
};
