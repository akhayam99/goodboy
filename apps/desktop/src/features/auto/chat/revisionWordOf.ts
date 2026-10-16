import type { DelegationCardModel } from './delegationCardOf';

type Params = {
  readonly card: Pick<DelegationCardModel, 'isRevision' | 'reviseVersion' | 'isOpen' | 'status'>;
};

export const revisionWordOf = ({ card }: Params): string | null => {
  if (!card.isRevision || card.reviseVersion === null) {
    return null;
  }
  if (card.isOpen) {
    return `revising v${card.reviseVersion}`;
  }
  return card.status.word === 'Done' ? `v${card.reviseVersion} ready` : null;
};
