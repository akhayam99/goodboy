import type { ActionCardModel } from '../next/actionCardsOf';

type Params = {
  readonly cards: ReadonlyArray<ActionCardModel>;
};

export const cardOrderOf = ({ cards }: Params): ReadonlyMap<string, number> => {
  const order = new Map<string, number>();
  cards.forEach((card, index) => {
    const source = card.source;
    const mountIds =
      source.kind === 'suggestion' && source.suggestion.kind === 'rebase-project'
        ? source.suggestion.payload.targets.map((target) => target.mountId)
        : card.mountId === null
          ? []
          : [card.mountId];
    for (const mountId of mountIds) {
      if (!order.has(mountId)) {
        order.set(mountId, index);
      }
    }
  });
  return order;
};
