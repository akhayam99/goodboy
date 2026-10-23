import { OVERVIEW_CARD_OF_GROUP, type NextOverviewCardId } from '../cards/overviewCardOfGroup';
import type { ActionCardModel } from './actionCardsOf';
import { nextGroupsOf } from './nextGroupsOf';

type Params = {
  readonly cards: ReadonlyArray<ActionCardModel>;
  readonly card: NextOverviewCardId;
};

export const nextRowCountOf = ({ cards, card }: Params): number =>
  nextGroupsOf({ cards, seen: [] })
    .filter((group) => OVERVIEW_CARD_OF_GROUP[group.id] === card)
    .reduce((total, group) => total + group.rows.length, 0);
