import type { SessionAttentionReason } from '@goodboy/types';
import type { ActionCardModel } from './actionCardsOf';

type Params = {
  readonly cards: ReadonlyArray<ActionCardModel>;
  readonly reasons: ReadonlyArray<SessionAttentionReason>;
};

type CardParams = {
  readonly card: ActionCardModel;
};

const FAILURE_REASONS: ReadonlyArray<SessionAttentionReason> = [
  'agent-error',
  'run-stopped',
  'auto-needs-you',
];

const isFailureCard = ({ card }: CardParams): boolean => {
  const { source } = card;
  if (source.kind === 'auto') {
    return source.target.kind !== 'approve';
  }
  return (
    source.kind === 'owner' &&
    source.owner.kind === 'agent' &&
    source.owner.item?.rowState.ask?.kind === 'restartStep'
  );
};

export const cardsOnBoardOf = ({ cards, reasons }: Params): ReadonlyArray<ActionCardModel> => {
  const isFailureOnBoard = reasons.some((reason) => FAILURE_REASONS.includes(reason));
  return cards.filter((card) => isFailureOnBoard || !isFailureCard({ card }));
};
