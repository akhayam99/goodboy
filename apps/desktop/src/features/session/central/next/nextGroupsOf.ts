import type { ActionCardModel } from './actionCardsOf';
import { NEXT_GROUP_IDS, type NextGroupId } from './nextGroupIds';
import { nextKindFactsOf } from './nextKindFactsOf';
import { nextRowsOf } from './nextRowsOf';
import { nextSeenKeyOf } from './nextSeenKeyOf';

export type NextGroupModel = Readonly<{
  id: NextGroupId;
  label: string;
  rows: ReadonlyArray<ActionCardModel>;
}>;

type Params = {
  readonly cards: ReadonlyArray<ActionCardModel>;
  readonly seen: ReadonlyArray<string>;
};

const LABEL: Readonly<Record<NextGroupId, string>> = {
  decide: 'Decide',
  fix: 'Fix',
  update: 'Update',
  ship: 'Ship',
};

const UNSEEN = Number.POSITIVE_INFINITY;

export const nextGroupsOf = ({ cards, seen }: Params): ReadonlyArray<NextGroupModel> => {
  const seenAt = new Map(seen.map((key, index) => [key, index]));
  const placed = nextRowsOf({ cards }).map((row, index) => {
    const group = nextKindFactsOf({ card: row }).group;
    return {
      row,
      index,
      group,
      at: seenAt.get(nextSeenKeyOf({ group, card: row })) ?? UNSEEN,
    };
  });
  return NEXT_GROUP_IDS.flatMap((id) => {
    const rows = placed
      .filter((entry) => entry.group === id)
      .sort((first, second) =>
        first.at === second.at ? first.index - second.index : first.at < second.at ? -1 : 1,
      )
      .map((entry) => entry.row);
    return rows.length === 0 ? [] : [{ id, label: LABEL[id], rows }];
  });
};
