import {
  brandId,
  type AgentId,
  type AutoDelegationId,
  type AutoTreeId,
  type SessionId,
} from '@goodboy/types';
import type { Database, GuardedStatement, PlainStatement, Statement } from '../client';
import { agentInsertStatement, type AgentInsertInput } from './agent-write';
import type { AutoArtifactKind } from './auto-artifacts';
import { getAutoDelegation, type AutoDelegation, type AutoJsonObject } from './auto-delegations';

export const AUTO_ADOPT_ABORT = {
  gone: 'adopt_gone',
  inRun: 'adopt_in_run',
  turnRunning: 'adopt_turn_running',
  inAuto: 'adopt_in_auto',
  cycle: 'adopt_cycle',
} as const;

export const AUTO_DETACH_ABORT = {
  missing: 'detach_missing',
  turnRunning: 'detach_turn_running',
} as const;

export const autoAdoptionJoinKey = (delegationId: string): string => `adopt:${delegationId}`;

export type AdoptedArtifact = Readonly<{
  artifactId: string;
  kind: AutoArtifactKind;
}>;

export type AdoptAgentStatementsParams = Readonly<{
  sessionId: SessionId;
  sourceAgentId: AgentId;
  sourceRole: string;
  autoAgent: AgentInsertInput & Readonly<{ id: AgentId }>;
  treeId: AutoTreeId;
  primaryMountId: string | null;
  capUsd: number | null;
  hardDeadlineAt: number;
  delegation: Readonly<{
    id: AutoDelegationId;
    requestId: string;
    batchId: string;
    attemptId: string;
    routing: AutoJsonObject;
    request: AutoJsonObject;
    target: AutoJsonObject;
    result: unknown;
  }>;
  artifacts: ReadonlyArray<AdoptedArtifact>;
  outbox: Readonly<{ id: string; payload: unknown }>;
  nowMs: number;
}>;

type GuardParams = {
  readonly sql: string;
  readonly params: ReadonlyArray<unknown>;
  readonly abortWhen: GuardedStatement['abortWhen'];
  readonly abortCode: string;
};

const guard = ({ sql, params, abortWhen, abortCode }: GuardParams): GuardedStatement => ({
  sql,
  params,
  abortWhen,
  abortCode,
});

const LINEAGE_SQL = `WITH RECURSIVE up(id) AS (
    SELECT parent_agent_id FROM live_agents WHERE id = ? AND parent_agent_id IS NOT NULL
    UNION
    SELECT a.parent_agent_id FROM live_agents a JOIN up ON a.id = up.id WHERE a.parent_agent_id IS NOT NULL
  ), down(id) AS (
    SELECT id FROM live_agents WHERE parent_agent_id = ?
    UNION
    SELECT a.id FROM live_agents a JOIN down ON a.parent_agent_id = down.id
  )
  SELECT 1 FROM live_agents
  WHERE id IN (SELECT id FROM up UNION SELECT id FROM down)
    AND (
      kind = 'auto'
      OR id IN (SELECT root_agent_id FROM auto_trees)
      OR id IN (SELECT child_agent_id FROM auto_delegations)
    )
  LIMIT 1`;

export const adoptAgentStatements = ({
  sessionId,
  sourceAgentId,
  sourceRole,
  autoAgent,
  treeId,
  primaryMountId,
  capUsd,
  hardDeadlineAt,
  delegation,
  artifacts,
  outbox,
  nowMs,
}: AdoptAgentStatementsParams): ReadonlyArray<Statement> => {
  const guards: ReadonlyArray<GuardedStatement> = [
    guard({
      sql: 'SELECT 1 FROM live_agents WHERE id = ? AND session_id = ?',
      params: [sourceAgentId, sessionId],
      abortWhen: 'noRows',
      abortCode: AUTO_ADOPT_ABORT.gone,
    }),
    guard({
      sql: 'SELECT 1 FROM live_agents WHERE id = ? AND (workflow_run_id IS NOT NULL OR step_id IS NOT NULL)',
      params: [sourceAgentId],
      abortWhen: 'rows',
      abortCode: AUTO_ADOPT_ABORT.inRun,
    }),
    guard({
      sql: "SELECT 1 FROM live_agents WHERE id = ? AND status = 'running'",
      params: [sourceAgentId],
      abortWhen: 'rows',
      abortCode: AUTO_ADOPT_ABORT.turnRunning,
    }),
    guard({
      sql: `SELECT 1 FROM auto_delegations WHERE child_agent_id = ?
        UNION ALL SELECT 1 FROM auto_trees WHERE root_agent_id = ?`,
      params: [sourceAgentId, sourceAgentId],
      abortWhen: 'rows',
      abortCode: AUTO_ADOPT_ABORT.inAuto,
    }),
    guard({
      sql: LINEAGE_SQL,
      params: [sourceAgentId, sourceAgentId],
      abortWhen: 'rows',
      abortCode: AUTO_ADOPT_ABORT.cycle,
    }),
  ];
  const tree: PlainStatement = {
    sql: `INSERT INTO auto_trees (
        id, root_agent_id, session_id, primary_mount_id, phase, cap_usd, created_at, updated_at,
        hard_deadline_at
      ) VALUES (?, ?, ?, ?, 'merging', ?, ?, ?, ?)`,
    params: [treeId, autoAgent.id, sessionId, primaryMountId, capUsd, nowMs, nowMs, hardDeadlineAt],
  };
  const delegationRow: PlainStatement = {
    sql: `INSERT INTO auto_delegations (
        id, tree_id, generation, request_id, request_hash, batch_id, slot, child_agent_id,
        first_attempt_id, role, request_json, target_json, routing_json, state, outcome, reason,
        adopted, deadline_at, result_json, created_at, settled_at
      ) VALUES (?, ?, 1, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, 'settled', 'completed', 'adopted', 1, ?, ?, ?, ?)`,
    params: [
      delegation.id,
      treeId,
      delegation.requestId,
      `adopt:${sourceAgentId}`,
      delegation.batchId,
      sourceAgentId,
      delegation.attemptId,
      sourceRole,
      JSON.stringify(delegation.request),
      JSON.stringify(delegation.target),
      JSON.stringify(delegation.routing),
      hardDeadlineAt,
      JSON.stringify(delegation.result),
      nowMs,
      nowMs,
    ],
  };
  const artifactRows: ReadonlyArray<PlainStatement> = artifacts.map((artifact) => ({
    sql: `INSERT OR IGNORE INTO auto_artifacts (
        artifact_id, tree_id, kind, owner_agent_id, owner_delegation_id, owner_role, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    params: [
      artifact.artifactId,
      treeId,
      artifact.kind,
      sourceAgentId,
      delegation.id,
      sourceRole,
      nowMs,
    ],
  }));
  const kickoff: PlainStatement = {
    sql: `INSERT INTO auto_outbox (id, tree_id, generation, kind, join_key, payload_json, created_at)
      VALUES (?, ?, 1, 'user', ?, ?, ?)`,
    params: [
      outbox.id,
      treeId,
      autoAdoptionJoinKey(delegation.id),
      JSON.stringify(outbox.payload),
      nowMs,
    ],
  };
  return [
    ...guards,
    agentInsertStatement({ input: autoAgent, id: autoAgent.id }),
    tree,
    delegationRow,
    ...artifactRows,
    kickoff,
  ];
};

export type DetachAdoptionStatementsParams = Readonly<{
  delegation: AutoDelegation;
  nowMs: number;
}>;

export const detachAdoptionStatements = ({
  delegation,
  nowMs,
}: DetachAdoptionStatementsParams): ReadonlyArray<Statement> => [
  guard({
    sql: 'SELECT 1 FROM auto_delegations WHERE id = ? AND adopted = 1',
    params: [delegation.id],
    abortWhen: 'noRows',
    abortCode: AUTO_DETACH_ABORT.missing,
  }),
  guard({
    sql: "SELECT 1 FROM live_agents WHERE id = ? AND status = 'running'",
    params: [delegation.childAgentId],
    abortWhen: 'rows',
    abortCode: AUTO_DETACH_ABORT.turnRunning,
  }),
  {
    sql: `DELETE FROM auto_outbox
      WHERE tree_id = ? AND state = 'pending' AND (join_key = ? OR join_key = ?)`,
    params: [
      delegation.treeId,
      `join:${delegation.generation}:${delegation.batchId}`,
      autoAdoptionJoinKey(delegation.id),
    ],
  },
  {
    sql: 'DELETE FROM auto_artifacts WHERE owner_delegation_id = ?',
    params: [delegation.id],
  },
  {
    sql: 'DELETE FROM auto_delegations WHERE id = ? AND adopted = 1',
    params: [delegation.id],
  },
  {
    sql: 'UPDATE auto_trees SET phase_rev = phase_rev + 1, updated_at = ? WHERE id = ?',
    params: [nowMs, delegation.treeId],
  },
];

type GetAdoptionParams = {
  readonly db: Database;
  readonly agentId: AgentId;
};

export const getAdoptionOfAgent = async ({
  db,
  agentId,
}: GetAdoptionParams): Promise<AutoDelegation | null> => {
  const rows = await db.select<{ readonly id: string }>(
    'SELECT id FROM auto_delegations WHERE child_agent_id = ? AND adopted = 1 LIMIT 1',
    [agentId],
  );
  const row = rows[0];
  if (row === undefined) {
    return null;
  }
  return getAutoDelegation({ db, delegationId: brandId<AutoDelegationId>({ value: row.id }) });
};
