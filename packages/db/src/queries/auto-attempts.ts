import {
  brandId,
  type AutoAttemptId,
  type AutoDelegationId,
  type AutoTreeId,
} from '@goodboy/types';
import type { Database, GuardedStatement, PlainStatement } from '../client';
import {
  asAutoOutcome,
  parseAutoJson,
  type AutoJsonObject,
  type AutoOutcome,
} from './auto-delegations';

export const AUTO_ATTEMPT_STATES = ['starting', 'running', 'paused', 'ended'] as const;

export type AutoAttemptState = (typeof AUTO_ATTEMPT_STATES)[number];

export type AutoAttempt = Readonly<{
  id: AutoAttemptId;
  delegationId: AutoDelegationId;
  treeId: AutoTreeId;
  generation: number;
  ordinal: number;
  state: AutoAttemptState;
  outcome: AutoOutcome | null;
  runId: string | null;
  questionId: string | null;
  baseline: unknown;
  resultSnapshot: unknown;
  writeSet: unknown;
  startedAt: number;
  endedAt: number | null;
  endReason: string | null;
}>;

type AttemptRow = {
  readonly id: string;
  readonly delegation_id: string;
  readonly tree_id: string;
  readonly generation: number;
  readonly ordinal: number;
  readonly state: string;
  readonly outcome: string | null;
  readonly run_id: string | null;
  readonly question_id: string | null;
  readonly baseline_json: string | null;
  readonly result_snapshot_json: string | null;
  readonly write_set_json: string | null;
  readonly started_at: number;
  readonly ended_at: number | null;
  readonly end_reason: string | null;
};

type ValueParams = {
  readonly value: string;
};

const ATTEMPT_SELECT = `SELECT id, delegation_id, tree_id, generation, ordinal, state, outcome, run_id,
  question_id, baseline_json, result_snapshot_json, write_set_json, started_at, ended_at, end_reason
  FROM auto_attempts`;

const asState = ({ value }: ValueParams): AutoAttemptState =>
  AUTO_ATTEMPT_STATES.find((state) => state === value) ?? 'starting';

type ToAttemptParams = {
  readonly row: AttemptRow;
};

const toAttempt = ({ row }: ToAttemptParams): AutoAttempt => ({
  id: brandId<AutoAttemptId>({ value: row.id }),
  delegationId: brandId<AutoDelegationId>({ value: row.delegation_id }),
  treeId: brandId<AutoTreeId>({ value: row.tree_id }),
  generation: row.generation,
  ordinal: row.ordinal,
  state: asState({ value: row.state }),
  outcome: asAutoOutcome({ value: row.outcome }),
  runId: row.run_id,
  questionId: row.question_id,
  baseline: parseAutoJson({ text: row.baseline_json }),
  resultSnapshot: parseAutoJson({ text: row.result_snapshot_json }),
  writeSet: parseAutoJson({ text: row.write_set_json }),
  startedAt: row.started_at,
  endedAt: row.ended_at,
  endReason: row.end_reason,
});

type GetAutoAttemptParams = {
  readonly db: Database;
  readonly attemptId: AutoAttemptId;
};

export const getAutoAttempt = async ({
  db,
  attemptId,
}: GetAutoAttemptParams): Promise<AutoAttempt | null> => {
  const rows = await db.select<AttemptRow>(`${ATTEMPT_SELECT} WHERE id = ?`, [attemptId]);
  const row = rows[0];
  return row === undefined ? null : toAttempt({ row });
};

type ListAutoAttemptsOfDelegationParams = {
  readonly db: Database;
  readonly delegationId: AutoDelegationId;
};

export const listAutoAttemptsOfDelegation = async ({
  db,
  delegationId,
}: ListAutoAttemptsOfDelegationParams): Promise<ReadonlyArray<AutoAttempt>> => {
  const rows = await db.select<AttemptRow>(
    `${ATTEMPT_SELECT} WHERE delegation_id = ? ORDER BY ordinal`,
    [delegationId],
  );
  return rows.map((row) => toAttempt({ row }));
};

type ListLiveAutoAttemptsParams = {
  readonly db: Database;
  readonly treeId: AutoTreeId;
};

export const listLiveAutoAttempts = async ({
  db,
  treeId,
}: ListLiveAutoAttemptsParams): Promise<ReadonlyArray<AutoAttempt>> => {
  const rows = await db.select<AttemptRow>(
    `${ATTEMPT_SELECT} WHERE tree_id = ? AND state IN ('starting', 'running') ORDER BY started_at, ordinal`,
    [treeId],
  );
  return rows.map((row) => toAttempt({ row }));
};

type InsertAttemptStatementParams = {
  readonly id: AutoAttemptId;
  readonly delegationId: AutoDelegationId;
  readonly treeId: AutoTreeId;
  readonly generation: number;
  readonly baseline: AutoJsonObject | null;
  readonly writeSet: AutoJsonObject | null;
  readonly nowMs: number;
};

export const insertAutoAttemptStatement = ({
  id,
  delegationId,
  treeId,
  generation,
  baseline,
  writeSet,
  nowMs,
}: InsertAttemptStatementParams): PlainStatement => ({
  sql: `INSERT INTO auto_attempts (
      id, delegation_id, tree_id, generation, ordinal, baseline_json, write_set_json, started_at
    ) VALUES (
      ?, ?, ?, ?,
      (SELECT COALESCE(MAX(ordinal), 0) + 1 FROM auto_attempts WHERE delegation_id = ?),
      ?, ?, ?
    )`,
  params: [
    id,
    delegationId,
    treeId,
    generation,
    delegationId,
    baseline === null ? null : JSON.stringify(baseline),
    writeSet === null ? null : JSON.stringify(writeSet),
    nowMs,
  ],
});

type MarkAttemptRunningStatementParams = {
  readonly attemptId: AutoAttemptId;
  readonly generation: number;
  readonly runId: string;
  readonly abortCode: string;
};

export const markAutoAttemptRunningStatement = ({
  attemptId,
  generation,
  runId,
  abortCode,
}: MarkAttemptRunningStatementParams): GuardedStatement => ({
  sql: `UPDATE auto_attempts SET state = 'running', run_id = ?
    WHERE id = ? AND generation = ? AND state = 'starting'`,
  params: [runId, attemptId, generation],
  abortWhen: 'noChanges',
  abortCode,
});

type EndAttemptStatementParams = {
  readonly attemptId: AutoAttemptId;
  readonly generation: number;
  readonly outcome: AutoOutcome;
  readonly endReason: string | null;
  readonly resultSnapshot: unknown;
  readonly nowMs: number;
  readonly abortCode: string;
};

export const endAutoAttemptStatement = ({
  attemptId,
  generation,
  outcome,
  endReason,
  resultSnapshot,
  nowMs,
  abortCode,
}: EndAttemptStatementParams): GuardedStatement => ({
  sql: `UPDATE auto_attempts
    SET state = 'ended', outcome = ?, end_reason = ?, result_snapshot_json = ?, ended_at = ?
    WHERE id = ? AND generation = ? AND state IN ('starting', 'running')`,
  params: [
    outcome,
    endReason,
    resultSnapshot === null || resultSnapshot === undefined ? null : JSON.stringify(resultSnapshot),
    nowMs,
    attemptId,
    generation,
  ],
  abortWhen: 'noChanges',
  abortCode,
});

type PauseAttemptStatementParams = {
  readonly attemptId: AutoAttemptId;
  readonly generation: number;
  readonly questionId: string;
  readonly resultSnapshot: unknown;
  readonly nowMs: number;
  readonly abortCode: string;
};

export const pauseAutoAttemptStatement = ({
  attemptId,
  generation,
  questionId,
  resultSnapshot,
  nowMs,
  abortCode,
}: PauseAttemptStatementParams): GuardedStatement => ({
  sql: `UPDATE auto_attempts
    SET state = 'paused', question_id = ?, result_snapshot_json = ?, ended_at = ?
    WHERE id = ? AND generation = ? AND state IN ('starting', 'running')`,
  params: [
    questionId,
    resultSnapshot === null || resultSnapshot === undefined ? null : JSON.stringify(resultSnapshot),
    nowMs,
    attemptId,
    generation,
  ],
  abortWhen: 'noChanges',
  abortCode,
});
