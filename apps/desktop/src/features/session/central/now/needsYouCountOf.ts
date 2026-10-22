import type { ActionCardModel } from '../next/actionCardsOf';
import type { NextGroupId } from '../next/nextGroupIds';
import { nextGroupsOf } from '../next/nextGroupsOf';

type Params = {
  readonly cards: ReadonlyArray<ActionCardModel>;
};

const WAITS_ON_YOU: ReadonlySet<NextGroupId> = new Set(['decide', 'fix']);

export const needsYouCountOf = ({ cards }: Params): number =>
  nextGroupsOf({ cards, seen: [] })
    .filter((group) => WAITS_ON_YOU.has(group.id))
    .reduce((total, group) => total + group.rows.length, 0);
