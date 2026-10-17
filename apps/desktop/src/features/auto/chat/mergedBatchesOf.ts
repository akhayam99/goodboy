import type { DelegationBatchModel } from './batchesOf';

type Params = {
  readonly batches: ReadonlyArray<DelegationBatchModel>;
};

export const mergedBatchesOf = ({ batches }: Params): ReadonlyArray<DelegationBatchModel> => {
  const bySlot = new Map<number | null, DelegationBatchModel>();
  for (const batch of batches) {
    const earlier = bySlot.get(batch.beforeMs);
    bySlot.set(
      batch.beforeMs,
      earlier === undefined
        ? batch
        : { ...earlier, delegations: [...earlier.delegations, ...batch.delegations] },
    );
  }
  return [...bySlot.values()];
};
