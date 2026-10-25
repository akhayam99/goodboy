import type { FoldedVerb } from '../../../actions/types';
import type { ActionCardModel } from './actionCardsOf';

type Params = {
  readonly card: ActionCardModel;
  readonly run: () => void;
};

export const foldedVerbOf = ({ card, run }: Params): FoldedVerb => {
  const lines = card.source.kind === 'owner' ? card.source.owner.stopLines : undefined;
  return {
    id: `folded:${card.id}`,
    label: lines === undefined ? card.title : lines.title,
    description: lines === undefined ? null : lines.detail,
    run,
  };
};
