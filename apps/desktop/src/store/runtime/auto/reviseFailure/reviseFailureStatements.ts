import {
  finishAutoArtifactReviseStatement,
  settleAutoDelegationStatement,
  type Statement,
} from '@goodboy/db';
import type { ArtifactId, AutoDelegationId, AutoTreeId } from '@goodboy/types';

type ReviseFailureReason =
  | 'no_new_version'
  | 'lost_structure'
  | 'stale_base'
  | 'stale_result'
  | 'kickoff_failed'
  | 'returned'
  | 'ended';

export type ReviseFailure = Readonly<{
  delegationId: AutoDelegationId;
  generation: number;
  artifactId: ArtifactId;
  outcome?: 'failed' | 'blocked' | 'stopped' | 'timed_out';
  reason: ReviseFailureReason;
  failure?: string;
  result: unknown;
}>;

type ReviseFailureStatementsParams = ReviseFailure &
  Readonly<{
    treeId: AutoTreeId;
    nowMs: number;
    abortCode: string;
  }>;

export const reviseFailureStatements = ({
  treeId,
  nowMs,
  abortCode,
  delegationId,
  generation,
  artifactId,
  outcome = 'failed',
  reason,
  failure,
  result,
}: ReviseFailureStatementsParams): ReadonlyArray<Statement> => {
  const finish = finishAutoArtifactReviseStatement({
    artifactId,
    delegationId,
    abortCode: 'unused',
  });
  return [
    settleAutoDelegationStatement({
      delegationId,
      generation,
      outcome,
      reason: failure ?? reason,
      result,
      nowMs,
      abortCode,
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
  ];
};
