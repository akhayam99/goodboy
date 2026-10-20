import type { ActionCardModel } from '../next/actionCardsOf';

type Params = {
  readonly cards: ReadonlyArray<ActionCardModel>;
};

export const needsYouCountOf = ({ cards }: Params): number =>
  cards.filter((card) => card.band === 0).length;
