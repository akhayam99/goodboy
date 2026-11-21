import type { ActionCardModel } from './actionCardsOf';

type Params = {
  readonly card: ActionCardModel;
};

export const isStoppedRebaseOf = ({ card }: Params): boolean => {
  if (card.kind === 'rebase') {
    return true;
  }
  const { source } = card;
  if (source.kind !== 'suggestion' || source.suggestion.kind !== 'rebase-project') {
    return false;
  }
  const [first] = source.suggestion.payload.targets;
  if (first !== undefined && first.conflictCount !== undefined) {
    return true;
  }
  return card.folded.some((folded) => folded.kind === 'rebase');
};
