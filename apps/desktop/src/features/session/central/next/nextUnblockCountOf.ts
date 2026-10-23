import type { ActionCardModel } from './actionCardsOf';

type Params = {
  readonly card: ActionCardModel;
};

export const nextUnblockCountOf = ({ card }: Params): number => {
  const { source } = card;
  if (source.kind === 'suggestion' && source.suggestion.kind === 'rebase-project') {
    return Math.max(1, source.suggestion.payload.targets.length);
  }
  if (source.kind === 'auto' && source.target.plan !== null) {
    return Math.max(1, source.target.plan.branchCount);
  }
  return 1 + card.folded.length;
};
