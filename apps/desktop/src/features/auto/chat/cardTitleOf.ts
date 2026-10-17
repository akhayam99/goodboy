import type { DelegationCardModel } from './delegationCardOf';
import { revisionWordOf } from './revisionWordOf';

type Params = {
  readonly card: Pick<
    DelegationCardModel,
    'roleLabel' | 'isRevision' | 'reviseVersion' | 'isOpen' | 'status'
  >;
};

export const cardTitleOf = ({ card }: Params): string => {
  const word = revisionWordOf({ card });
  return word === null ? card.roleLabel : `${card.roleLabel}, ${word}`;
};
