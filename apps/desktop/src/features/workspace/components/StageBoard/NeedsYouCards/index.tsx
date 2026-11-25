import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Session, WorkspaceId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../../store';
import { CHECK_STATE } from '../../../../../store/slices/notifications/errorRecovery';
import { sessionTitle } from '../../../../../shared/utils/sessionTitle';
import { formatSpan } from '../../../../../shared/utils/time/formatSpan';
import { useNow } from '../../../../../shared/hooks/useNow';
import type { NeedsYouCard as Card } from '../../../../board/needsYou/needsYouOf';
import { openAttentionTarget } from '../../../../session/openAttentionTarget';
import { NeedsYouCard } from '../NeedsYouCard';
import { cardContextOf } from '../cardContextOf';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly sessions: ReadonlyArray<Session>;
  readonly cards: ReadonlyArray<Card>;
};

type MetaParams = {
  readonly card: Card;
  readonly now: number;
};

type OpenParams = {
  readonly card: Card;
};

const AGE_MS = 30_000;

const metaOf = ({ card, now }: MetaParams): string => {
  const age = formatSpan({ from: card.move.since, to: now });
  const questions = card.questionCount > 1 ? `${card.questionCount} questions` : '';
  return [age === '' ? '' : `Waiting ${age}`, questions, card.move.title]
    .filter((part) => part !== '')
    .join(' · ');
};

export const NeedsYouCards = ({ workspaceId, sessions, cards }: Props) => {
  const now = useNow(AGE_MS);
  const titles = useMemo(
    () => new Map(sessions.map((session) => [session.id, sessionTitle({ session })])),
    [sessions],
  );
  const contexts = useAppStore(
    useShallow((state) =>
      cards.map((card) =>
        cardContextOf({ mounts: state.sessionProjectMounts[card.sessionId] ?? EMPTY_ARRAY }),
      ),
    ),
  );

  const open = ({ card }: OpenParams): void => {
    void openAttentionTarget({
      target: {
        workspaceId,
        sessionId: card.sessionId,
        reason: card.move.reason,
        agentId: null,
        ...(card.move.questionId === null ? {} : { questionId: card.move.questionId }),
      },
    }).catch((error: unknown) =>
      useAppStore
        .getState()
        .reportError({ recovery: CHECK_STATE, title: "Couldn't open this session", error }),
    );
  };

  return cards.map((card, index) => (
    <NeedsYouCard
      key={card.sessionId}
      sessionId={card.sessionId}
      title={titles.get(card.sessionId) ?? ''}
      context={contexts[index] ?? ''}
      reason={card.move.title}
      meta={metaOf({ card, now })}
      onOpen={() => open({ card })}
    />
  ));
};
