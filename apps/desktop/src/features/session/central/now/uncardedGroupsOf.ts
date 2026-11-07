import type { ActionCardModel } from '../next/actionCardsOf';
import { cardedAutoRootsOf } from '../cardedAutoRootsOf';
import type { LiveGroupModel } from './liveGroupsOf';

type Params = {
  readonly groups: ReadonlyArray<LiveGroupModel>;
  readonly cards: ReadonlyArray<ActionCardModel>;
};

export const uncardedGroupsOf = ({ groups, cards }: Params): ReadonlyArray<LiveGroupModel> => {
  const carded = cardedAutoRootsOf({ cards });
  return groups.filter((group) => group.kind !== 'auto' || !carded.has(group.group.rootAgentId));
};
