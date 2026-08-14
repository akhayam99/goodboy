import type {
  IsoDateTime,
  ModelEffort,
  OrchestratorRouting,
  ProviderId,
  SessionId,
  WorkflowId,
  WorkflowExecutionMode,
  WorkflowOrchestrationOutcome,
  WorkflowOrchestrationStop,
  WorkflowOrchestrationStopKind,
  WorkflowRun,
  WorkflowRunId,
  WorkflowSpendLimitMode,
  WorkflowTriggerMode,
} from '@goodboy/types';
import type { Database } from '../client';

export type SessionWorkflowRow = {
  workflow_run_id: string;
  workflow_id: string;
  ordinal: number;
  current_step_ordinal: number;
  auto_run: number;
  trigger_mode: string;
  execution_mode: string;
  orchestration_outcome: string | null;
  orchestration_reason: string | null;
  orchestration_error: string | null;
  orchestration_stop_kind: string;
  orchestrator_hints: string | null;
  orchestrator_summary: string | null;
  orchestrator_provider: string | null;
  orchestrator_model: string | null;
  orchestrator_effort: string | null;
  spend_limit_usd: number | null;
  spend_limit_mode: string;
  chain_after_run_id: string | null;
  goal: string | null;
  discarded_at: string | null;
  created_at: string | null;
};

export const SESSION_WORKFLOW_COLS =
  'workflow_run_id, workflow_id, ordinal, current_step_ordinal, auto_run, trigger_mode, execution_mode, orchestration_outcome, orchestration_reason, orchestration_error, orchestration_stop_kind, orchestrator_hints, orchestrator_summary, orchestrator_provider, orchestrator_model, orchestrator_effort, spend_limit_usd, spend_limit_mode, chain_after_run_id, goal, discarded_at, created_at';

type RoutingColumns = {
  readonly provider: string | null;
  readonly model: string | null;
  readonly effort: string | null;
};

const toRouting = ({ provider, model, effort }: RoutingColumns): OrchestratorRouting | null => {
  if (provider == null || model == null) {
    return null;
  }
  return {
    providerId: provider as ProviderId,
    model,
    ...(effort != null && { effort: effort as ModelEffort }),
  };
};

type SqliteDateColumn = {
  readonly value: string | null;
};

const toIsoDateTime = ({ value }: SqliteDateColumn): IsoDateTime | null => {
  if (value == null || value === '') {
    return null;
  }
  const hasZone = /([Zz]|[+-]\d{2}:?\d{2})$/.test(value);
  const zoned = hasZone ? value : `${value.replace(' ', 'T')}Z`;
  const parsed = Date.parse(zoned);
  if (Number.isNaN(parsed)) {
    return null;
  }
  return new Date(parsed).toISOString() as IsoDateTime;
};

type StopColumns = {
  readonly message: string | null;
  readonly kind: string;
};

const toStop = ({ message, kind }: StopColumns): WorkflowOrchestrationStop | null => {
  if (message == null || message === '') {
    return null;
  }
  return { kind: kind as WorkflowOrchestrationStopKind, message };
};

export function toWorkflowRun(row: SessionWorkflowRow): WorkflowRun {
  const orchestrationStop = toStop({
    message: row.orchestration_error,
    kind: row.orchestration_stop_kind,
  });
  const orchestratorRouting = toRouting({
    provider: row.orchestrator_provider,
    model: row.orchestrator_model,
    effort: row.orchestrator_effort,
  });
  const createdAt = toIsoDateTime({ value: row.created_at });
  return {
    id: row.workflow_run_id as WorkflowRunId,
    workflowId: row.workflow_id as WorkflowId,
    ordinal: row.ordinal,
    currentStep: row.current_step_ordinal,
    autoRun: row.auto_run !== 0,
    triggerMode: row.trigger_mode as WorkflowTriggerMode,
    executionMode: row.execution_mode as WorkflowExecutionMode,
    ...(row.orchestration_outcome != null && {
      orchestrationOutcome: row.orchestration_outcome as WorkflowOrchestrationOutcome,
    }),
    ...(row.orchestration_reason != null &&
      row.orchestration_reason !== '' && { orchestrationReason: row.orchestration_reason }),
    ...(orchestrationStop != null && { orchestrationStop }),
    ...(row.orchestrator_hints != null &&
      row.orchestrator_hints !== '' && { orchestratorHints: row.orchestrator_hints }),
    ...(row.orchestrator_summary != null &&
      row.orchestrator_summary !== '' && { orchestratorSummary: row.orchestrator_summary }),
    ...(orchestratorRouting != null && { orchestratorRouting }),
    ...(row.spend_limit_usd != null && { spendLimitUsd: row.spend_limit_usd }),
    spendLimitMode: (row.spend_limit_mode ?? 'pause') as WorkflowSpendLimitMode,
    ...(row.chain_after_run_id != null && {
      chainAfterId: row.chain_after_run_id as WorkflowRunId,
    }),
    ...(row.goal != null && row.goal !== '' && { goal: row.goal }),
    ...(row.discarded_at != null && { discardedAt: row.discarded_at as IsoDateTime }),
    ...(createdAt != null && { createdAt }),
  };
}

export const listWorkflowsForSession = async (
  db: Database,
  sessionId: SessionId,
): Promise<ReadonlyArray<WorkflowRun>> => {
  const rows = await db.select<SessionWorkflowRow>(
    `SELECT ${SESSION_WORKFLOW_COLS} FROM session_workflows WHERE session_id = ? ORDER BY ordinal DESC`,
    [sessionId],
  );
  return rows.map(toWorkflowRun);
};

async function bumpSessionUpdatedAt(
  db: Database,
  sessionId: SessionId,
  updatedAt: IsoDateTime,
): Promise<void> {
  await db.execute('UPDATE sessions SET updated_at = ? WHERE id = ?', [
    Date.parse(updatedAt),
    sessionId,
  ]);
}

type AttachWorkflowToSessionParams = {
  readonly db: Database;
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId;
  readonly workflowId: WorkflowId;
  readonly autoRun: boolean;
  readonly updatedAt: IsoDateTime;
  readonly goal?: string;
  readonly triggerMode?: WorkflowTriggerMode;
  readonly chainAfterRunId?: WorkflowRunId;
  readonly executionMode?: WorkflowExecutionMode;
  readonly spendLimitUsd?: number;
  readonly spendLimitMode?: WorkflowSpendLimitMode;
};

export const attachWorkflowToSession = async ({
  db,
  sessionId,
  workflowRunId,
  workflowId,
  autoRun,
  updatedAt,
  goal,
  triggerMode = 'immediate',
  chainAfterRunId,
  executionMode = 'static',
  spendLimitUsd,
  spendLimitMode = 'pause',
}: AttachWorkflowToSessionParams): Promise<void> => {
  const maxOrdinal = await db.select<{ max_ordinal: number | null }>(
    'SELECT MAX(ordinal) as max_ordinal FROM session_workflows WHERE session_id = ?',
    [sessionId],
  );
  const nextOrdinal = (maxOrdinal[0]?.max_ordinal ?? -1) + 1;

  await db.execute(
    'INSERT INTO session_workflows (workflow_run_id, session_id, workflow_id, ordinal, current_step_ordinal, auto_run, goal, trigger_mode, chain_after_run_id, execution_mode, spend_limit_usd, spend_limit_mode) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      workflowRunId,
      sessionId,
      workflowId,
      nextOrdinal,
      0,
      autoRun ? 1 : 0,
      goal ?? null,
      triggerMode,
      chainAfterRunId ?? null,
      executionMode,
      spendLimitUsd ?? null,
      spendLimitMode,
    ],
  );
  await bumpSessionUpdatedAt(db, sessionId, updatedAt);
};

export const detachWorkflowFromSession = async (
  db: Database,
  sessionId: SessionId,
  workflowRunId: WorkflowRunId,
  updatedAt: IsoDateTime,
): Promise<void> => {
  await db.execute('DELETE FROM session_workflows WHERE workflow_run_id = ?', [workflowRunId]);
  await bumpSessionUpdatedAt(db, sessionId, updatedAt);
};

export const updateWorkflowOrder = async (
  db: Database,
  sessionId: SessionId,
  workflowRunIds: ReadonlyArray<WorkflowRunId>,
  updatedAt: IsoDateTime,
): Promise<void> => {
  const existing = await db.select<SessionWorkflowRow>(
    `SELECT ${SESSION_WORKFLOW_COLS} FROM session_workflows WHERE session_id = ?`,
    [sessionId],
  );
  const byRun = new Map(existing.map((r) => [r.workflow_run_id, r]));

  await db.exec('BEGIN');
  try {
    await db.execute('DELETE FROM session_workflows WHERE session_id = ?', [sessionId]);
    for (const [ordinal, runId] of workflowRunIds.entries()) {
      const prev = byRun.get(runId);
      if (!prev) {
        continue;
      }
      await db.execute(
        'INSERT INTO session_workflows (workflow_run_id, session_id, workflow_id, ordinal, current_step_ordinal, auto_run, goal, discarded_at, trigger_mode, chain_after_run_id, execution_mode, orchestration_outcome, orchestration_reason, orchestration_error, orchestration_stop_kind, orchestrator_hints, orchestrator_summary, orchestrator_provider, orchestrator_model, orchestrator_effort, spend_limit_usd, spend_limit_mode, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          runId,
          sessionId,
          prev.workflow_id,
          ordinal,
          prev.current_step_ordinal,
          prev.auto_run,
          prev.goal,
          prev.discarded_at,
          prev.trigger_mode,
          prev.chain_after_run_id,
          prev.execution_mode,
          prev.orchestration_outcome,
          prev.orchestration_reason,
          prev.orchestration_error,
          prev.orchestration_stop_kind,
          prev.orchestrator_hints,
          prev.orchestrator_summary,
          prev.orchestrator_provider,
          prev.orchestrator_model,
          prev.orchestrator_effort,
          prev.spend_limit_usd,
          prev.spend_limit_mode,
          prev.created_at,
        ],
      );
    }
    await db.execute('UPDATE sessions SET updated_at = ? WHERE id = ?', [
      Date.parse(updatedAt),
      sessionId,
    ]);
    await db.exec('COMMIT');
  } catch (err) {
    await db.exec('ROLLBACK');
    throw err;
  }
};

export const discardWorkflowInSession = async (
  db: Database,
  sessionId: SessionId,
  workflowRunId: WorkflowRunId,
  discardedAt: IsoDateTime,
): Promise<void> => {
  await db.execute('UPDATE session_workflows SET discarded_at = ? WHERE workflow_run_id = ?', [
    discardedAt,
    workflowRunId,
  ]);
  await bumpSessionUpdatedAt(db, sessionId, discardedAt);
};

export const restoreWorkflowInSession = async (
  db: Database,
  sessionId: SessionId,
  workflowRunId: WorkflowRunId,
  restoredAt: IsoDateTime,
): Promise<void> => {
  await db.execute('UPDATE session_workflows SET discarded_at = NULL WHERE workflow_run_id = ?', [
    workflowRunId,
  ]);
  await bumpSessionUpdatedAt(db, sessionId, restoredAt);
};

export const updateSessionWorkflowStep = async (
  db: Database,
  sessionId: SessionId,
  workflowRunId: WorkflowRunId,
  stepOrdinal: number,
  updatedAt: IsoDateTime,
): Promise<void> => {
  await db.execute(
    'UPDATE session_workflows SET current_step_ordinal = ? WHERE workflow_run_id = ?',
    [stepOrdinal, workflowRunId],
  );
  await bumpSessionUpdatedAt(db, sessionId, updatedAt);
};

export const updateSessionWorkflowAutoRun = async (
  db: Database,
  sessionId: SessionId,
  workflowRunId: WorkflowRunId,
  autoRun: boolean,
  updatedAt: IsoDateTime,
): Promise<void> => {
  await db.execute('UPDATE session_workflows SET auto_run = ? WHERE workflow_run_id = ?', [
    autoRun ? 1 : 0,
    workflowRunId,
  ]);
  await bumpSessionUpdatedAt(db, sessionId, updatedAt);
};

export const updateWorkflowRunOrchestrationOutcome = async (
  db: Database,
  workflowRunId: WorkflowRunId,
  outcome: WorkflowOrchestrationOutcome | null,
  reason: string | null = null,
): Promise<void> => {
  await db.execute(
    'UPDATE session_workflows SET orchestration_outcome = ?, orchestration_reason = ? WHERE workflow_run_id = ?',
    [outcome, reason, workflowRunId],
  );
};

export const updateWorkflowRunOrchestratorRouting = async (
  db: Database,
  workflowRunId: WorkflowRunId,
  routing: OrchestratorRouting | null,
): Promise<void> => {
  await db.execute(
    'UPDATE session_workflows SET orchestrator_provider = ?, orchestrator_model = ?, orchestrator_effort = ? WHERE workflow_run_id = ?',
    [routing?.providerId ?? null, routing?.model ?? null, routing?.effort ?? null, workflowRunId],
  );
};

export const updateWorkflowRunOrchestrationStop = async (
  db: Database,
  workflowRunId: WorkflowRunId,
  stop: WorkflowOrchestrationStop | null,
): Promise<void> => {
  await db.execute(
    'UPDATE session_workflows SET orchestration_error = ?, orchestration_stop_kind = ? WHERE workflow_run_id = ?',
    [stop?.message ?? null, stop?.kind ?? 'failure', workflowRunId],
  );
};

export const updateWorkflowRunOrchestratorHints = async (
  db: Database,
  workflowRunId: WorkflowRunId,
  hints: string | null,
): Promise<void> => {
  await db.execute(
    'UPDATE session_workflows SET orchestrator_hints = ? WHERE workflow_run_id = ?',
    [hints, workflowRunId],
  );
};

export const updateWorkflowRunOrchestratorSummary = async (
  db: Database,
  workflowRunId: WorkflowRunId,
  summary: string | null,
): Promise<void> => {
  await db.execute(
    'UPDATE session_workflows SET orchestrator_summary = ? WHERE workflow_run_id = ?',
    [summary, workflowRunId],
  );
};

export const updateWorkflowRunSpendLimit = async (
  db: Database,
  workflowRunId: WorkflowRunId,
  spendLimitUsd: number | null,
  mode: WorkflowSpendLimitMode,
): Promise<void> => {
  await db.execute(
    'UPDATE session_workflows SET spend_limit_usd = ?, spend_limit_mode = ? WHERE workflow_run_id = ?',
    [spendLimitUsd, mode, workflowRunId],
  );
};

export const updateSessionWorkflowTriggerMode = async (
  db: Database,
  sessionId: SessionId,
  workflowRunId: WorkflowRunId,
  mode: WorkflowTriggerMode,
  updatedAt: IsoDateTime,
): Promise<void> => {
  await db.execute('UPDATE session_workflows SET trigger_mode = ? WHERE workflow_run_id = ?', [
    mode,
    workflowRunId,
  ]);
  await bumpSessionUpdatedAt(db, sessionId, updatedAt);
};
