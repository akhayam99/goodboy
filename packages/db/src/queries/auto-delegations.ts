import {
  brandId,
  type AgentId,
  type AutoAttemptId,
  type AutoBatchId,
  type AutoDelegationId,
  type AutoRequestId,
  type AutoTreeId,
  type SessionId,
} from '@goodboy/types';
import type { Database, GuardedStatement, PlainStatement } from '../client';
import { isJsonValue, parseJsonColumn } from '../shared/parseJsonColumn';
import { isRecord } from '@goodboy/types/helpers';

export const AUTO_DELEGATION_STATES = [
  'accepted',
  'awaiting_confirm',
  'starting',
  'running',
  'paused',
  'settled',
] as const;

export type AutoDelegationState = (typeof AUTO_DELEGATION_STATES)[number];

export const AUTO_OUTCOMES = ['completed', 'failed', 'blocked', 'stopped', 'timed_out'] as const;

export type AutoOutcome = (typeof AUTO_OUTCOMES)[number];

export type AutoJsonObject = Readonly<Record<string, unknown>>;

export type AutoDelegation = Readonly<{
  id: AutoDelegationId;
  treeId: AutoTreeId;
  generation: number;
  requestId: AutoRequestId;
  requestHash: string;
  batchId: AutoBatchId;
  slot: number;
  childAgentId: AgentId;
  firstAttemptId: AutoAttemptId;
  role: string;
  request: AutoJsonObject;
  target: AutoJsonObject;
  routing: AutoJsonObject;
  state: AutoDelegationState;
  outcome: AutoOutcome | null;
  reason: string | null;
  retryOf: AutoDelegationId | null;
  reviseOf: string | null;
  baseRevision: number | null;
  isAdopted: boolean;
  isStopping: boolean;
  questionCycles: number;
  deadlineAt: number;
  result: unknown;
  createdAt: number;
  settledAt: number | null;
}>;

type DelegationRow = {
  readonly id: string;
  readonly tree_id: string;
  readonly generation: number;
  readonly request_id: string;
  readonly request_hash: string;
  readonly batch_id: string;
  readonly slot: number;
  readonly child_agent_id: string;
  readonly first_attempt_id: string;
  readonly role: string;
  readonly request_json: string;
  readonly target_json: string;
  readonly routing_json: string;
  readonly state: string;
  readonly outcome: string | null;
  readonly reason: string | null;
  readonly retry_of: string | null;
  readonly revise_of: string | null;
  readonly base_revision: number | null;
  readonly adopted: number;
  readonly is_stopping: number;
  readonly question_cycles: number;
  readonly deadline_at: number;
  readonly result_json: string | null;
  readonly created_at: number;
  readonly settled_at: number | null;
};

type NullableValueParams = {
  readonly value: string | null;
};

type ValueParams = {
  readonly value: string;
};

type NullableTextParams = {
  readonly text: string | null;
};

type TextParams = {
  readonly text: string;
};

const DELEGATION_SELECT = `SELECT id, tree_id, generation, request_id, request_hash, batch_id, slot,
  child_agent_id, first_attempt_id, role, request_json, target_json, routing_json, state, outcome,
  reason, retry_of, revise_of, base_revision, adopted, is_stopping, question_cycles, deadline_at,
  result_json, created_at, settled_at FROM auto_delegations`;

export const parseAutoJson = ({ text }: NullableTextParams): unknown => {
  return parseJsonColumn<unknown>({ value: text, isValid: isJsonValue, fallback: null });
};

const asObject = ({ text }: TextParams): AutoJsonObject => {
  const parsed = parseAutoJson({ text });
  return isRecord(parsed) ? parsed : {};
};

const asState = ({ value }: ValueParams): AutoDelegationState =>
  AUTO_DELEGATION_STATES.find((state) => state === value) ?? 'accepted';

export const asAutoOutcome = ({ value }: NullableValueParams): AutoOutcome | null =>
  AUTO_OUTCOMES.find((outcome) => outcome === value) ?? null;

type ToDelegationParams = {
  readonly row: DelegationRow;
};

const toDelegation = ({ row }: ToDelegationParams): AutoDelegation => ({
  id: brandId<AutoDelegationId>({ value: row.id }),
  treeId: brandId<AutoTreeId>({ value: row.tree_id }),
  generation: row.generation,
  requestId: brandId<AutoRequestId>({ value: row.request_id }),
  requestHash: row.request_hash,
  batchId: brandId<AutoBatchId>({ value: row.batch_id }),
  slot: row.slot,
  childAgentId: brandId<AgentId>({ value: row.child_agent_id }),
  firstAttemptId: brandId<AutoAttemptId>({ value: row.first_attempt_id }),
  role: row.role,
  request: asObject({ text: row.request_json }),
  target: asObject({ text: row.target_json }),
  routing: asObject({ text: row.routing_json }),
  state: asState({ value: row.state }),
  outcome: asAutoOutcome({ value: row.outcome }),
  reason: row.reason,
  retryOf: row.retry_of === null ? null : brandId<AutoDelegationId>({ value: row.retry_of }),
  reviseOf: row.revise_of,
  baseRevision: row.base_revision,
  isAdopted: row.adopted === 1,
  isStopping: row.is_stopping === 1,
  questionCycles: row.question_cycles,
  deadlineAt: row.deadline_at,
  result: parseAutoJson({ text: row.result_json }),
  createdAt: row.created_at,
  settledAt: row.settled_at,
});

export type NewAutoDelegation = Readonly<{
  id: AutoDelegationId;
  treeId: AutoTreeId;
  generation: number;
  requestId: AutoRequestId;
  requestHash: string;
  batchId: AutoBatchId;
  slot: number;
  childAgentId: AgentId;
  firstAttemptId: AutoAttemptId;
  role: string;
  request: AutoJsonObject;
  target: AutoJsonObject;
  routing: AutoJsonObject;
  state: 'accepted' | 'awaiting_confirm';
  retryOf: AutoDelegationId | null;
  reviseOf: string | null;
  baseRevision: number | null;
  isAdopted: boolean;
  deadlineAt: number;
  nowMs: number;
}>;

type InsertDelegationStatementParams = {
  readonly delegation: NewAutoDelegation;
};

export const insertAutoDelegationStatement = ({
  delegation,
}: InsertDelegationStatementParams): PlainStatement => ({
  sql: `INSERT INTO auto_delegations (
      id, tree_id, generation, request_id, request_hash, batch_id, slot, child_agent_id,
      first_attempt_id, role, request_json, target_json, routing_json, state, retry_of, revise_of,
      base_revision, adopted, deadline_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  params: [
    delegation.id,
    delegation.treeId,
    delegation.generation,
    delegation.requestId,
    delegation.requestHash,
    delegation.batchId,
    delegation.slot,
    delegation.childAgentId,
    delegation.firstAttemptId,
    delegation.role,
    JSON.stringify(delegation.request),
    JSON.stringify(delegation.target),
    JSON.stringify(delegation.routing),
    delegation.state,
    delegation.retryOf,
    delegation.reviseOf,
    delegation.baseRevision,
    delegation.isAdopted ? 1 : 0,
    delegation.deadlineAt,
    delegation.nowMs,
  ],
});

type GetAutoDelegationParams = {
  readonly db: Database;
  readonly delegationId: AutoDelegationId;
};

export const getAutoDelegation = async ({
  db,
  delegationId,
}: GetAutoDelegationParams): Promise<AutoDelegation | null> => {
  const rows = await db.select<DelegationRow>(`${DELEGATION_SELECT} WHERE id = ?`, [delegationId]);
  const row = rows[0];
  return row === undefined ? null : toDelegation({ row });
};

type GetPausedAutoDelegationOfQuestionParams = {
  readonly db: Database;
  readonly treeId: AutoTreeId;
  readonly questionId: string;
};

export const getPausedAutoDelegationOfQuestion = async ({
  db,
  treeId,
  questionId,
}: GetPausedAutoDelegationOfQuestionParams): Promise<AutoDelegation | null> => {
  const rows = await db.select<DelegationRow>(
    `${DELEGATION_SELECT} WHERE tree_id = ? AND state = 'paused'
      AND EXISTS (
        SELECT 1 FROM auto_attempts latest
        WHERE latest.delegation_id = auto_delegations.id AND latest.state = 'paused'
          AND latest.question_id = ?
          AND latest.ordinal = (
            SELECT MAX(ordinal) FROM auto_attempts WHERE delegation_id = auto_delegations.id
          )
      )`,
    [treeId, questionId],
  );
  const row = rows[0];
  return row === undefined ? null : toDelegation({ row });
};

type IsAutoChildAgentParams = {
  readonly db: Database;
  readonly agentId: string;
};

export const isAutoChildAgent = async ({
  db,
  agentId,
}: IsAutoChildAgentParams): Promise<boolean> => {
  const rows = await db.select<{ readonly found: number }>(
    'SELECT 1 AS found FROM auto_delegations WHERE child_agent_id = ? LIMIT 1',
    [agentId],
  );
  return rows.length > 0;
};

type ListGoneAutoChildIdsParams = {
  readonly db: Database;
  readonly treeId: AutoTreeId;
  readonly sessionId: SessionId;
};

export const listGoneAutoChildIds = async ({
  db,
  treeId,
  sessionId,
}: ListGoneAutoChildIdsParams): Promise<ReadonlyArray<AgentId>> => {
  const rows = await db.select<{ readonly id: string }>(
    `SELECT DISTINCT d.child_agent_id AS id FROM auto_delegations d
      JOIN agents a ON a.id = d.child_agent_id
      WHERE d.tree_id = ? AND (a.deleted_at IS NOT NULL OR a.session_id <> ?)
      ORDER BY d.child_agent_id`,
    [treeId, sessionId],
  );
  return rows.map((row) => brandId<AgentId>({ value: row.id }));
};

type ListAutoDelegationsParams = {
  readonly db: Database;
  readonly treeId: AutoTreeId;
};

export const listAutoDelegations = async ({
  db,
  treeId,
}: ListAutoDelegationsParams): Promise<ReadonlyArray<AutoDelegation>> => {
  const rows = await db.select<DelegationRow>(
    `${DELEGATION_SELECT} WHERE tree_id = ? ORDER BY created_at, batch_id, slot`,
    [treeId],
  );
  return rows.map((row) => toDelegation({ row }));
};

export const listOpenAutoDelegations = async ({
  db,
  treeId,
}: ListAutoDelegationsParams): Promise<ReadonlyArray<AutoDelegation>> => {
  const rows = await db.select<DelegationRow>(
    `${DELEGATION_SELECT} WHERE tree_id = ? AND state <> 'settled' ORDER BY created_at, batch_id, slot`,
    [treeId],
  );
  return rows.map((row) => toDelegation({ row }));
};

type ListAutoDelegationsOfRequestParams = {
  readonly db: Database;
  readonly treeId: AutoTreeId;
  readonly requestId: AutoRequestId;
};

export const listAutoDelegationsOfRequest = async ({
  db,
  treeId,
  requestId,
}: ListAutoDelegationsOfRequestParams): Promise<ReadonlyArray<AutoDelegation>> => {
  const rows = await db.select<DelegationRow>(
    `${DELEGATION_SELECT} WHERE tree_id = ? AND request_id = ? ORDER BY slot`,
    [treeId, requestId],
  );
  return rows.map((row) => toDelegation({ row }));
};

type GetOpenAutoDelegationOfChildParams = {
  readonly db: Database;
  readonly childAgentId: AgentId;
};

export const getOpenAutoDelegationOfChild = async ({
  db,
  childAgentId,
}: GetOpenAutoDelegationOfChildParams): Promise<AutoDelegation | null> => {
  const rows = await db.select<DelegationRow>(
    `${DELEGATION_SELECT} WHERE child_agent_id = ? AND state <> 'settled'`,
    [childAgentId],
  );
  const row = rows[0];
  return row === undefined ? null : toDelegation({ row });
};

export type AutoDelegationPatch = Readonly<{
  reason?: string | null;
  isStopping?: boolean;
  questionCycles?: number;
}>;

type CasDelegationStatementParams = {
  readonly delegationId: AutoDelegationId;
  readonly generation: number;
  readonly from: ReadonlyArray<AutoDelegationState>;
  readonly to: Exclude<AutoDelegationState, 'settled'>;
  readonly patch?: AutoDelegationPatch;
  readonly abortCode: string;
};

export const casAutoDelegationStateStatement = ({
  delegationId,
  generation,
  from,
  to,
  patch = {},
  abortCode,
}: CasDelegationStatementParams): GuardedStatement => {
  const sets: string[] = ['state = ?'];
  const setParams: unknown[] = [to];
  if (patch.reason !== undefined) {
    sets.push('reason = ?');
    setParams.push(patch.reason);
  }
  if (patch.isStopping !== undefined) {
    sets.push('is_stopping = ?');
    setParams.push(patch.isStopping ? 1 : 0);
  }
  if (patch.questionCycles !== undefined) {
    sets.push('question_cycles = ?');
    setParams.push(patch.questionCycles);
  }
  const marks = from.map(() => '?').join(', ');
  return {
    sql: `UPDATE auto_delegations SET ${sets.join(', ')}
      WHERE id = ? AND generation = ? AND state IN (${marks})`,
    params: [...setParams, delegationId, generation, ...from],
    abortWhen: 'noChanges',
    abortCode,
  };
};

type PatchChecksStatementParams = {
  readonly delegationId: AutoDelegationId;
  readonly generation: number;
  readonly checks: unknown;
  readonly checksRun: unknown;
  readonly abortCode: string;
};

export const patchAutoDelegationChecksStatement = ({
  delegationId,
  generation,
  checks,
  checksRun,
  abortCode,
}: PatchChecksStatementParams): GuardedStatement => ({
  sql: `UPDATE auto_delegations
    SET result_json = json_set(result_json, '$.verified.checks', json(?), '$.verified.checksRun', json(?))
    WHERE id = ? AND generation = ? AND state = 'settled' AND result_json IS NOT NULL`,
  params: [JSON.stringify(checks), JSON.stringify(checksRun), delegationId, generation],
  abortWhen: 'noChanges',
  abortCode,
});

type PatchPublishStatementParams = {
  readonly delegationId: AutoDelegationId;
  readonly generation: number;
  readonly publish: unknown;
  readonly abortCode: string;
};

export const patchAutoDelegationPublishStatement = ({
  delegationId,
  generation,
  publish,
  abortCode,
}: PatchPublishStatementParams): GuardedStatement => ({
  sql: `UPDATE auto_delegations
    SET result_json = json_set(result_json, '$.verified.publish', json(?))
    WHERE id = ? AND generation = ? AND state = 'settled' AND result_json IS NOT NULL`,
  params: [JSON.stringify(publish), delegationId, generation],
  abortWhen: 'noChanges',
  abortCode,
});

type FollowPublishStatementParams = {
  readonly delegationId: AutoDelegationId;
  readonly generation: number;
  readonly publish: unknown;
};

export const followAutoDelegationPublishStatement = ({
  delegationId,
  generation,
  publish,
}: FollowPublishStatementParams): PlainStatement => ({
  sql: `UPDATE auto_delegations
    SET result_json = json_set(result_json, '$.verified.publish', json(?))
    WHERE id = ? AND generation = ? AND state = 'settled' AND result_json IS NOT NULL
      AND json_extract(result_json, '$.verified.publish.state') = 'pushing'`,
  params: [JSON.stringify(publish), delegationId, generation],
});

type SettleDelegationStatementParams = {
  readonly delegationId: AutoDelegationId;
  readonly generation: number;
  readonly outcome: AutoOutcome;
  readonly reason: string | null;
  readonly result: unknown;
  readonly nowMs: number;
  readonly abortCode: string;
};

export const settleAutoDelegationStatement = ({
  delegationId,
  generation,
  outcome,
  reason,
  result,
  nowMs,
  abortCode,
}: SettleDelegationStatementParams): GuardedStatement => ({
  sql: `UPDATE auto_delegations
    SET state = 'settled', outcome = ?, reason = ?, result_json = ?, settled_at = ?, is_stopping = 0
    WHERE id = ? AND generation = ? AND state <> 'settled'`,
  params: [
    outcome,
    reason,
    result === null || result === undefined ? null : JSON.stringify(result),
    nowMs,
    delegationId,
    generation,
  ],
  abortWhen: 'noChanges',
  abortCode,
});
