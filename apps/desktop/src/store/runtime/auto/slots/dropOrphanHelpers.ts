import { substepLinkOf } from '@goodboy/core/auto';
import {
  releaseAutoReservationStatement,
  settleAutoDelegationStatement,
  type AutoDelegation,
  type Database,
} from '@goodboy/db';
import { attemptEnvelope } from '../attemptEnvelope';
import { parentWaitsStatement } from './parentWaitsStatement';

type Params = {
  readonly db: Database;
  readonly open: ReadonlyArray<AutoDelegation>;
  readonly nowMs: number;
};

const ORPHAN_REASON = 'parent_ended';
const ABORT_WAITING = 'orphan_parent_waits';
const ABORT_SETTLE = 'orphan_settle';

const UNSTARTED_STATES: ReadonlyArray<AutoDelegation['state']> = ['accepted', 'awaiting_confirm'];

type DropOneParams = {
  readonly db: Database;
  readonly helper: AutoDelegation;
  readonly nowMs: number;
};

const dropOne = async ({ db, helper, nowMs }: DropOneParams): Promise<boolean> => {
  const parent = substepLinkOf({ request: helper.request });
  if (parent === null || !UNSTARTED_STATES.includes(helper.state)) {
    return false;
  }
  const result = {
    ...attemptEnvelope({
      delegation: helper,
      attempt: { id: helper.firstAttemptId },
      generation: helper.generation,
      exit: 'cancelled',
      closing: null,
      artifactPersistence: 'not_applicable',
      costUsd: null,
      turns: 0,
    }),
    reason: ORPHAN_REASON,
  };
  const outcome = await db.transaction({
    statements: [
      parentWaitsStatement({
        parentId: parent.delegationId,
        questionId: parent.questionId,
        abortWhen: 'rows',
        abortCode: ABORT_WAITING,
      }),
      {
        sql: `SELECT 1 FROM auto_delegations WHERE id = ? AND state IN ('accepted', 'awaiting_confirm')`,
        params: [helper.id],
        abortWhen: 'noRows',
        abortCode: ABORT_SETTLE,
      },
      settleAutoDelegationStatement({
        delegationId: helper.id,
        generation: helper.generation,
        outcome: 'stopped',
        reason: ORPHAN_REASON,
        result,
        nowMs,
        abortCode: ABORT_SETTLE,
      }),
      releaseAutoReservationStatement({
        treeId: helper.treeId,
        ownerKind: 'attempt',
        ownerId: helper.firstAttemptId,
        reason: ORPHAN_REASON,
        nowMs,
      }),
      {
        sql: 'UPDATE auto_trees SET phase_rev = phase_rev + 1, updated_at = ? WHERE id = ?',
        params: [nowMs, helper.treeId],
      },
    ],
  });
  return outcome.status === 'committed';
};

export const dropOrphanHelpers = async ({
  db,
  open,
  nowMs,
}: Params): Promise<ReadonlyArray<AutoDelegation>> => {
  const dropped = new Set<string>();
  for (const helper of open) {
    if (await dropOne({ db, helper, nowMs })) {
      dropped.add(helper.id);
    }
  }
  return open.filter((delegation) => !dropped.has(delegation.id));
};
