import type { ActionCardModel } from './actionCardsOf';
import type { NextGroupId } from './nextGroupIds';
import { nextSubjectOf } from './nextSubjectOf';

type Params = {
  readonly group: NextGroupId;
  readonly card: ActionCardModel;
};

export const nextSeenKeyOf = ({ group, card }: Params): string =>
  `${group}|${nextSubjectOf({ card }).key}`;
