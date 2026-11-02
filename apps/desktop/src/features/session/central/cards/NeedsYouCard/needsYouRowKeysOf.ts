import { nextGroupsOf } from '../../next/nextGroupsOf';
import type { ActionCardModel } from '../../next/actionCardsOf';
import type { LiveGroupModel } from '../../now/liveGroupsOf';
import { OVERVIEW_CARD_OF_GROUP } from '../overviewCardOfGroup';

type Params = {
  readonly waiting: ReadonlyArray<LiveGroupModel>;
  readonly cards: ReadonlyArray<ActionCardModel>;
};

export const needsYouRowKeysOf = ({ waiting, cards }: Params): ReadonlyArray<string> => [
  ...waiting.map((group) => `${group.kind}:${group.id}`),
  ...nextGroupsOf({ cards, seen: [] })
    .filter((group) => OVERVIEW_CARD_OF_GROUP[group.id] === 'needs-you')
    .flatMap((group) => group.rows.map((card) => card.id)),
];
