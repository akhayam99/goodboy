import type { ActionCardModel } from '../next/actionCardsOf';
import { nextRowCountOf } from '../next/nextRowCountOf';

type Params = {
  readonly cards: ReadonlyArray<ActionCardModel>;
};

export const needsYouCountOf = ({ cards }: Params): number =>
  nextRowCountOf({ cards, card: 'needs-you' });
