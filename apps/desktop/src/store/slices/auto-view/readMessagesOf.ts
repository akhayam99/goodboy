import { isUserPayload, storedDeliveryOf } from '@goodboy/core/auto';
import type { AutoDelegation, AutoOutboxRow, AutoTree } from '@goodboy/db';
import type { AutoReadMessage } from './state';

type Params = {
  readonly tree: AutoTree;
  readonly accepted: ReadonlyArray<AutoOutboxRow>;
  readonly delegations: ReadonlyArray<AutoDelegation>;
};

type OpenParams = {
  readonly delegations: ReadonlyArray<AutoDelegation>;
  readonly atMs: number;
};

const isSentWhileAgentsWork = ({ delegations, atMs }: OpenParams): boolean =>
  delegations.some(
    (delegation) =>
      delegation.createdAt < atMs && (delegation.settledAt === null || delegation.settledAt > atMs),
  );

export const readMessagesOf = ({
  tree,
  accepted,
  delegations,
}: Params): ReadonlyArray<AutoReadMessage> => {
  const turnByRowId = new Map<string, number>();
  for (const row of accepted) {
    const stored = storedDeliveryOf({ value: row.payload });
    if (stored === null || stored.turn === undefined) {
      continue;
    }
    for (const rowId of stored.rowIds) {
      turnByRowId.set(rowId, stored.turn);
    }
  }
  const current = delegations.filter((delegation) => delegation.generation === tree.generation);
  return accepted.flatMap((row): ReadonlyArray<AutoReadMessage> => {
    const turn = turnByRowId.get(String(row.id));
    if (
      row.kind !== 'user' ||
      row.generation !== tree.generation ||
      turn === undefined ||
      !isUserPayload(row.payload) ||
      !isSentWhileAgentsWork({ delegations: current, atMs: row.createdAt })
    ) {
      return [];
    }
    return [{ rowId: String(row.id), createdAt: row.createdAt, text: row.payload.text, turn }];
  });
};
