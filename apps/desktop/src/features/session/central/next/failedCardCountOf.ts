import { LIVE_TONE } from '../now/liveTone';
import type { ActionCardModel } from './actionCardsOf';
import { cardStateWordOf } from './cardStateWordOf';

type Params = {
  readonly cards: ReadonlyArray<ActionCardModel>;
};

export const failedCardCountOf = ({ cards }: Params): number =>
  cards.filter((card) => cardStateWordOf({ card })?.word === LIVE_TONE.state.failed.word).length;
