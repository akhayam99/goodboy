import type { AutoDelegation } from '@goodboy/db';
import type { AutoTreeView } from '../../../store/slices/auto-view/state';
import type { DelegationCardModel } from './delegationCardOf';

type Params = {
  readonly view: AutoTreeView;
  readonly delegation: AutoDelegation;
  readonly card: DelegationCardModel;
};

export const confirmLineOf = ({ view, delegation, card }: Params): string => {
  const row =
    delegation.reviseOf === null
      ? undefined
      : view.artifacts.find((candidate) => candidate.artifact.artifactId === delegation.reviseOf);
  return row === undefined
    ? `Start ${card.roleLabel}?`
    : `Revise ${row.title} to v${row.revision + 1}?`;
};
