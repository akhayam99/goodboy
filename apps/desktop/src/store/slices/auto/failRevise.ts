import {
  AUTO_OWNER_GUARD_SQL,
  autoOwnerGuardParams,
  finishAutoArtifactReviseStatement,
  settleAutoDelegationStatement,
  type Database,
  type Statement,
} from '@goodboy/db';
import type { ArtifactId, AutoDelegationId, AutoTreeId } from '@goodboy/types';

type ReviseFailureReason =
  'no_new_version' | 'lost_structure' | 'stale_base' | 'stale_result' | 'kickoff_failed';

export type FailReviseParams = Readonly<{
  db: Database;
  ownerId: string;
  nowMs: number;
  treeId: AutoTreeId;
  delegationId: AutoDelegationId;
  generation: number;
  artifactId: ArtifactId;
  reason: ReviseFailureReason;
  result: unknown;
}>;

export type FailReviseOutcome = Readonly<{ kind: 'failed' }> | Readonly<{ kind: 'dropped' }>;

const ABORT_TREE = 'fail_tree';
const ABORT_DELEGATION = 'fail_delegation';
const ABORT_SETTLE = 'fail_settle';

export const failRevise = async ({
  db,
  ownerId,
  nowMs,
  treeId,
  delegationId,
  generation,
  artifactId,
  reason,
  result,
}: FailReviseParams): Promise<FailReviseOutcome> => {
  const finish = finishAutoArtifactReviseStatement({
    artifactId,
    delegationId,
    abortCode: 'unused',
  });
  const statements: Statement[] = [
    {
      sql: `SELECT 1 FROM auto_trees WHERE id = ? AND generation = ? AND ${AUTO_OWNER_GUARD_SQL}`,
      params: [treeId, generation, ...autoOwnerGuardParams({ ownerId, nowMs })],
      abortWhen: 'noRows',
      abortCode: ABORT_TREE,
    },
    {
      sql: 'SELECT 1 FROM auto_delegations WHERE id = ? AND tree_id = ?',
      params: [delegationId, treeId],
      abortWhen: 'noRows',
      abortCode: ABORT_DELEGATION,
    },
    settleAutoDelegationStatement({
      delegationId,
      generation,
      outcome: 'failed',
      reason,
      result,
      nowMs,
      abortCode: ABORT_SETTLE,
    }),
    { sql: finish.sql, params: finish.params },
    {
      sql: `UPDATE auto_reservations
        SET state = 'released', released_reason = ?, updated_at = ?
        WHERE tree_id = ? AND state = 'reserved' AND owner_kind = 'attempt'
          AND (
            owner_id IN (SELECT id FROM auto_attempts WHERE delegation_id = ?)
            OR owner_id = (SELECT first_attempt_id FROM auto_delegations WHERE id = ?)
          )`,
      params: [reason, nowMs, treeId, delegationId, delegationId],
    },
    {
      sql: 'UPDATE auto_trees SET phase_rev = phase_rev + 1, updated_at = ? WHERE id = ?',
      params: [nowMs, treeId],
    },
  ];
  const outcome = await db.transaction({ statements });
  return outcome.status === 'committed' ? { kind: 'failed' } : { kind: 'dropped' };
};
