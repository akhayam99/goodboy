import { listAutoDelegationsOfRequest, type Database } from '@goodboy/db';
import type { AutoRequestId, AutoTreeId } from '@goodboy/types';

type ReceiptEntry = Readonly<{
  delegationId: string;
  childAgentId: string;
  role: string;
  state: string;
  provider: string | null;
  model: string | null;
  effort: string | null;
  routingReason: string | null;
  proposal: string | null;
  mountId: string | null;
}>;

export type DelegationReceipt = Readonly<{
  requestId: string;
  batchId: string;
  delegations: ReadonlyArray<ReceiptEntry>;
}>;

type TextOfParams = {
  readonly source: Readonly<Record<string, unknown>>;
  readonly key: string;
};

const textOf = ({ source, key }: TextOfParams): string | null => {
  const value = source[key];
  return typeof value === 'string' ? value : null;
};

type ReceiptParams = {
  readonly db: Database;
  readonly treeId: AutoTreeId;
  readonly requestId: AutoRequestId;
};

export const delegationReceipt = async ({
  db,
  treeId,
  requestId,
}: ReceiptParams): Promise<DelegationReceipt | null> => {
  const rows = await listAutoDelegationsOfRequest({ db, treeId, requestId });
  const first = rows[0];
  if (first === undefined) {
    return null;
  }
  return {
    requestId,
    batchId: first.batchId,
    delegations: rows.map((row) => ({
      delegationId: row.id,
      childAgentId: row.childAgentId,
      role: row.role,
      state: row.state,
      provider: textOf({ source: row.routing, key: 'provider' }),
      model: textOf({ source: row.routing, key: 'model' }),
      effort: textOf({ source: row.routing, key: 'effort' }),
      routingReason: textOf({ source: row.routing, key: 'reason' }),
      proposal: textOf({ source: row.routing, key: 'proposal' }),
      mountId: textOf({ source: row.target, key: 'mountId' }),
    })),
  };
};
