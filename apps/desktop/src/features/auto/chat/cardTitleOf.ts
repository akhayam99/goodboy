import type { DelegationCardModel } from './delegationCardOf';

type Params = {
  readonly card: Pick<
    DelegationCardModel,
    'roleLabel' | 'isRevision' | 'reviseVersion' | 'isOpen' | 'status'
  >;
};

export const cardTitleOf = ({ card }: Params): string => {
  if (!card.isRevision || card.reviseVersion === null) {
    return card.roleLabel;
  }
  if (card.isOpen) {
    return `${card.roleLabel}, revising v${card.reviseVersion}`;
  }
  return card.status.word === 'Done'
    ? `${card.roleLabel}, v${card.reviseVersion} ready`
    : card.roleLabel;
};
