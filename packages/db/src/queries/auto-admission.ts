import type { AgentId, ArtifactId, AutoDelegationId, AutoTreeId } from '@goodboy/types';
import type { GuardedStatement, PlainStatement } from '../client';
import { autoBudgetCoversSql } from './auto-reservations';
import { AUTO_OWNER_GUARD_SQL, autoOwnerGuardParams } from './auto-trees';

export type AutoAdmissionLimits = Readonly<{
  maxCallsPerTurn: number;
  maxRefusals: number;
  maxOpenChildren: number;
}>;

type AdmissionTreeStatementParams = {
  readonly treeId: AutoTreeId;
  readonly rootAgentId: AgentId;
  readonly ownerId: string;
  readonly nowMs: number;
  readonly generation: number;
  readonly runId: string;
  readonly count: number;
  readonly requestedUsd: number;
  readonly limits: AutoAdmissionLimits;
};

export const AUTO_ADMISSION_TREE_ABORT = 'admission_tree';

export const autoAdmissionTreeStatement = ({
  treeId,
  rootAgentId,
  ownerId,
  nowMs,
  generation,
  runId,
  count,
  requestedUsd,
  limits,
}: AdmissionTreeStatementParams): GuardedStatement => ({
  sql: `UPDATE auto_trees
    SET phase = 'delegating', is_yield_requested = 1, phase_rev = phase_rev + 1, updated_at = ?,
        delegations_used = delegations_used + ?, attempts_used = attempts_used + ?,
        turn_delegate_calls = turn_delegate_calls + 1
    WHERE id = ? AND root_agent_id = ? AND generation = ? AND phase = 'deciding'
      AND is_yield_requested = 0 AND stop_state = 'none' AND active_run_id = ?
      AND ${AUTO_OWNER_GUARD_SQL}
      AND turn_delegate_calls < ? AND refusals_used < ? AND ? < hard_deadline_at
      AND (SELECT COUNT(*) FROM auto_delegations
            WHERE tree_id = auto_trees.id AND state <> 'settled') + ? <= ?
      AND ${autoBudgetCoversSql({ treeRef: 'auto_trees.id' })}`,
  params: [
    nowMs,
    count,
    count,
    treeId,
    rootAgentId,
    generation,
    runId,
    ...autoOwnerGuardParams({ ownerId, nowMs }),
    limits.maxCallsPerTurn,
    limits.maxRefusals,
    nowMs,
    count,
    limits.maxOpenChildren,
    requestedUsd,
  ],
  abortWhen: 'noChanges',
  abortCode: AUTO_ADMISSION_TREE_ABORT,
});

type ArtifactAbortParams = {
  readonly slot: number;
};

export const autoAdmissionArtifactAbort = ({ slot }: ArtifactAbortParams): string =>
  `admission_artifact:${slot}`;

type ReviseStatementsParams = {
  readonly treeId: AutoTreeId;
  readonly slot: number;
  readonly artifactId: ArtifactId;
  readonly expectedRevision: number;
  readonly childAgentId: AgentId;
  readonly role: string;
  readonly delegationId: AutoDelegationId;
  readonly nowMs: number;
};

const DEPENDENT_CONFIRM_SQL = `tree_id = ? AND state = 'awaiting_confirm'
  AND EXISTS (
    SELECT 1 FROM json_each(auto_delegations.request_json, '$.inputArtifacts')
    WHERE json_extract(json_each.value, '$.artifactId') = ?
  )`;

export const autoReviseArtifactStatements = ({
  treeId,
  slot,
  artifactId,
  expectedRevision,
  childAgentId,
  role,
  delegationId,
  nowMs,
}: ReviseStatementsParams): ReadonlyArray<GuardedStatement | PlainStatement> => [
  {
    sql: `UPDATE auto_artifacts
      SET approval_state = 'revising', approved_revision = NULL, open_revise_delegation_id = ?,
          rev = rev + 1
      WHERE artifact_id = ? AND tree_id = ? AND open_revise_delegation_id IS NULL
        AND owner_role = ? AND owner_agent_id = ?
        AND (SELECT revision FROM session_artifacts WHERE id = auto_artifacts.artifact_id) = ?
        AND (SELECT status FROM session_artifacts WHERE id = auto_artifacts.artifact_id) = 'active'
        AND NOT EXISTS (
          SELECT 1 FROM auto_delegations WHERE child_agent_id = ? AND state <> 'settled'
        )`,
    params: [delegationId, artifactId, treeId, role, childAgentId, expectedRevision, childAgentId],
    abortWhen: 'noChanges',
    abortCode: autoAdmissionArtifactAbort({ slot }),
  },
  {
    sql: `UPDATE auto_reservations
      SET state = 'released', released_reason = 'revise_started', updated_at = ?
      WHERE tree_id = ? AND state = 'reserved' AND owner_kind = 'attempt'
        AND owner_id IN (
          SELECT first_attempt_id FROM auto_delegations WHERE ${DEPENDENT_CONFIRM_SQL}
        )`,
    params: [nowMs, treeId, treeId, artifactId],
  },
  {
    sql: `UPDATE auto_delegations
      SET state = 'settled', outcome = 'stopped', reason = 'revise_started', settled_at = ?
      WHERE ${DEPENDENT_CONFIRM_SQL}`,
    params: [nowMs, treeId, artifactId],
  },
];

type InputStatementsParams = {
  readonly treeId: AutoTreeId;
  readonly slot: number;
  readonly artifactId: ArtifactId;
  readonly revision: number;
  readonly isApprovalRequired: boolean;
  readonly isConsumed: boolean;
  readonly nowMs: number;
};

export const autoInputArtifactStatements = ({
  treeId,
  slot,
  artifactId,
  revision,
  isApprovalRequired,
  isConsumed,
  nowMs,
}: InputStatementsParams): ReadonlyArray<GuardedStatement | PlainStatement> => {
  const guard: GuardedStatement = {
    sql: `SELECT 1 FROM auto_artifacts
      WHERE artifact_id = ? AND tree_id = ? AND open_revise_delegation_id IS NULL
        AND (? = 0 OR (approval_state = 'approved' AND approved_revision = ?))
        AND (SELECT revision FROM session_artifacts WHERE id = auto_artifacts.artifact_id) = ?
        AND (SELECT status FROM session_artifacts WHERE id = auto_artifacts.artifact_id)
            IN ('active', 'consumed')`,
    params: [artifactId, treeId, isApprovalRequired ? 1 : 0, revision, revision],
    abortWhen: 'noRows',
    abortCode: autoAdmissionArtifactAbort({ slot }),
  };
  if (!isConsumed) {
    return [guard];
  }
  return [
    guard,
    {
      sql: `UPDATE session_artifacts SET status = 'consumed', updated_at = ?
        WHERE id = ? AND kind = 'plan' AND status = 'active'`,
      params: [nowMs, artifactId],
    },
  ];
};

type ResumeTreeStatementParams = {
  readonly treeId: AutoTreeId;
  readonly rootAgentId: AgentId;
  readonly ownerId: string;
  readonly nowMs: number;
  readonly generation: number;
  readonly runId: string;
  readonly requestedUsd: number;
};

export const AUTO_RESUME_TREE_ABORT = 'resume_tree';

export const autoResumeTreeStatement = ({
  treeId,
  rootAgentId,
  ownerId,
  nowMs,
  generation,
  runId,
  requestedUsd,
}: ResumeTreeStatementParams): GuardedStatement => ({
  sql: `UPDATE auto_trees
    SET phase = 'delegating', is_yield_requested = 1, phase_rev = phase_rev + 1, updated_at = ?,
        attempts_used = attempts_used + 1
    WHERE id = ? AND root_agent_id = ? AND generation = ?
      AND phase IN ('deciding', 'delegating') AND stop_state = 'none' AND active_run_id = ?
      AND ${AUTO_OWNER_GUARD_SQL}
      AND ? < hard_deadline_at
      AND ${autoBudgetCoversSql({ treeRef: 'auto_trees.id' })}`,
  params: [
    nowMs,
    treeId,
    rootAgentId,
    generation,
    runId,
    ...autoOwnerGuardParams({ ownerId, nowMs }),
    nowMs,
    requestedUsd,
  ],
  abortWhen: 'noChanges',
  abortCode: AUTO_RESUME_TREE_ABORT,
});
