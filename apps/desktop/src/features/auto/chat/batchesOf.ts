import type { AutoDelegation } from '@goodboy/db';
import type { AutoTreeView } from '../../../store/slices/auto-view/state';

export type DelegationBatchModel = Readonly<{
  key: string;
  delegations: ReadonlyArray<AutoDelegation>;
  beforeMs: number | null;
}>;

type Params = {
  readonly view: AutoTreeView;
};

export const batchesOf = ({ view }: Params): ReadonlyArray<DelegationBatchModel> => {
  const byBatch = new Map<string, AutoDelegation[]>();
  for (const delegation of view.delegations) {
    if (delegation.isAdopted) {
      continue;
    }
    byBatch.set(delegation.batchId, [...(byBatch.get(delegation.batchId) ?? []), delegation]);
  }
  return [...byBatch.entries()].map(([key, delegations]) => {
    const settled = delegations.flatMap((delegation) =>
      delegation.state === 'settled' && delegation.settledAt !== null ? [delegation.settledAt] : [],
    );
    return {
      key,
      delegations,
      beforeMs: settled.length === delegations.length ? Math.max(...settled) : null,
    };
  });
};
