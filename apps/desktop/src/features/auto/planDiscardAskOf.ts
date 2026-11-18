import type { AutoArtifactLedgerRow } from '@goodboy/db';
import type { AutoTreeView } from '../../store/slices/auto-view/state';
import { numberField, recordField, textField } from './chat/readJson';

export type PlanDiscardAsk = Readonly<{
  revision: number;
  reason: string;
}>;

type Params = {
  readonly view: AutoTreeView;
  readonly row: AutoArtifactLedgerRow;
};

export const planDiscardAskOf = ({ view, row }: Params): PlanDiscardAsk | null => {
  if (row.status !== 'active') {
    return null;
  }
  const owner = view.delegations.find(
    (delegation) => delegation.id === row.artifact.ownerDelegationId,
  );
  const ask = recordField({ source: owner?.request, key: 'planDiscardAsk' });
  if (ask === null || textField({ source: ask, key: 'artifactId' }) !== row.artifact.artifactId) {
    return null;
  }
  const revision = numberField({ source: ask, key: 'revision' });
  if (revision !== row.revision) {
    return null;
  }
  return { revision, reason: textField({ source: ask, key: 'reason' }) ?? '' };
};
