import {
  getAutoOutbox,
  getAutoTree,
  withdrawAutoOutboxStatement,
  type AutoTree,
} from '@goodboy/db';
import { brandId, type AutoOutboxId } from '@goodboy/types';
import type { AgentVerbContext } from '../verbContext';

const WITHDRAWN_REASON = 'withdrawn';

const ABORT_PHASE = 'withdraw_phase';
const ABORT_ROW = 'withdraw_row';
const MAX_ATTEMPTS = 3;

export type WithdrawMessageParams = Readonly<{
  ctx: AgentVerbContext;
  treeId: AutoTree['id'];
  rowId: string;
}>;

export type WithdrawMessageOutcome =
  | Readonly<{ kind: 'withdrawn' }>
  | Readonly<{ kind: 'delivered' }>
  | Readonly<{ kind: 'idle'; reason: 'not_owner' | 'no_tree' }>;

export const withdrawMessage = async ({
  ctx,
  treeId,
  rowId,
}: WithdrawMessageParams): Promise<WithdrawMessageOutcome> => {
  const isOwner = await ctx.scheduler.claim({ treeId });
  if (!isOwner) {
    return { kind: 'idle', reason: 'not_owner' };
  }
  const outboxId = brandId<AutoOutboxId>({ value: rowId });
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const tree = await getAutoTree({ db: ctx.db, treeId });
    if (tree === null) {
      return { kind: 'idle', reason: 'no_tree' };
    }
    const row = await getAutoOutbox({ db: ctx.db, outboxId });
    if (row === null || row.treeId !== treeId || row.kind !== 'user') {
      return { kind: 'delivered' };
    }
    if (row.state === 'dropped' && row.droppedReason === WITHDRAWN_REASON) {
      return { kind: 'withdrawn' };
    }
    const isHeld =
      row.state === 'pending' || (row.state === 'dropped' && row.droppedReason === 'stopped');
    if (!isHeld || row.claimedBy !== null) {
      return { kind: 'delivered' };
    }
    const outcome = await ctx.db.transaction({
      statements: [
        {
          sql: 'SELECT 1 FROM auto_trees WHERE id = ? AND phase_rev = ?',
          params: [treeId, tree.phaseRev],
          abortWhen: 'noRows',
          abortCode: ABORT_PHASE,
        },
        withdrawAutoOutboxStatement({
          outboxId,
          generation: row.generation,
          reason: WITHDRAWN_REASON,
          abortCode: ABORT_ROW,
        }),
      ],
    });
    if (outcome.status === 'committed') {
      return { kind: 'withdrawn' };
    }
  }
  throw new Error('The message is busy. Try again in a moment.');
};
