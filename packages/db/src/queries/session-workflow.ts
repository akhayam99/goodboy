import type {
  IsoDateTime,
  EffortLevel,
  OrchestratorHint,
  OrchestratorRouting,
  ProviderId,
  SessionId,
  StepId,
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
import type { Database, PlainStatement } from '../client';
import { serializeOrchestratorHintLog, toOrchestratorHintLog } from './orchestrator-hint-log';

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
  orchestrator_hint_log: string | null;
  orchestrator_summary: string | null;
  orchestrator_provider: string | null;
  orchestrator_model: string | null;
  orchestrator_effort: string | null;
  spend_limit_usd: number | null;
  spend_limit_mode: string;
  chain_after_run_id: string | null;
  goal: string | null;
  title: string | null;
  title_user_edited: number;
  discarded_at: number | null;
  created_at: number | string;
};

export const SESSION_WORKFLOW_COLS =
  'workflow_run_id, workflow_id, ordinal, current_step_ordinal, auto_run, trigger_mode, execution_mode, orchestration_outcome, orchestration_reason, orchestration_error, orchestration_stop_kind, orchestrator_hint_log, orchestrator_summary, orchestrator_provider, orchestrator_model, orchestrator_effort, spend_limit_usd, spend_limit_mode, chain_after_run_id, goal, title, title_user_edited, discarded_at, created_at';

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
    ...(effort != null && { effort: effort as EffortLevel }),
  };
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

export const toWorkflowRun = (row: SessionWorkflowRow): WorkflowRun => {
  const orchestrationStop = toStop({
    message: row.orchestration_error,
    kind: row.orchestration_stop_kind,
  });
  const orchestratorRouting = toRouting({
    provider: row.orchestrator_provider,
    model: row.orchestrator_model,
    effort: row.orchestrator_effort,
  });
  const createdAt = (() => {
    if (typeof row.created_at === 'number') {
      return new Date(row.created_at).toISOString() as IsoDateTime;
    }
    if (row.created_at.trim() === '') {
      return undefined;
    }
    const timestamp = Date.parse(`${row.created_at.replace(' ', 'T')}Z`);
    return Number.isNaN(timestamp) ? undefined : (new Date(timestamp).toISOString() as IsoDateTime);
  })();
  const orchestratorHints = toOrchestratorHintLog({ value: row.orchestrator_hint_log });
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
    ...(orchestratorHints.length > 0 && { orchestratorHints }),
    ...(row.orchestrator_summary != null &&
      row.orchestrator_summary !== '' && { orchestratorSummary: row.orchestrator_summary }),
    ...(orchestratorRouting != null && { orchestratorRouting }),
    ...(row.spend_limit_usd != null && { spendLimitUsd: row.spend_limit_usd }),
    spendLimitMode: (row.spend_limit_mode ?? 'pause') as WorkflowSpendLimitMode,
    ...(row.chain_after_run_id != null && {
      chainAfterId: row.chain_after_run_id as WorkflowRunId,
    }),
    ...(row.goal != null && row.goal !== '' && { goal: row.goal }),
    ...(row.title != null && row.title !== '' && { title: row.title }),
    ...(row.title_user_edited !== 0 && { titleUserEdited: true }),
    ...(row.discarded_at != null && {
      discardedAt: new Date(row.discarded_at).toISOString() as IsoDateTime,
    }),
    ...(createdAt === undefined ? {} : { createdAt }),
  };
};

type SessionTouchParams = {
  readonly sessionId: SessionId;
  readonly updatedAt: IsoDateTime;
};

const sessionTouchStatement = ({ sessionId, updatedAt }: SessionTouchParams): PlainStatement => ({
  sql: 'UPDATE sessions SET updated_at = ? WHERE id = ?',
  params: [Date.parse(updatedAt), sessionId],
});

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
  readonly orchestratorRouting?: OrchestratorRouting;
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
  orchestratorRouting,
  spendLimitUsd,
  spendLimitMode = 'pause',
}: AttachWorkflowToSessionParams): Promise<void> => {
  const maxOrdinal = await db.select<{ max_ordinal: number | null }>(
    'SELECT MAX(ordinal) as max_ordinal FROM session_workflows WHERE session_id = ?',
    [sessionId],
  );
  const nextOrdinal = (maxOrdinal[0]?.max_ordinal ?? -1) + 1;

  await db.execute(
    'INSERT INTO session_workflows (workflow_run_id, session_id, workflow_id, ordinal, current_step_ordinal, auto_run, goal, trigger_mode, chain_after_run_id, execution_mode, orchestrator_provider, orchestrator_model, orchestrator_effort, spend_limit_usd, spend_limit_mode, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
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
      orchestratorRouting?.providerId ?? null,
      orchestratorRouting?.model ?? null,
      orchestratorRouting?.effort ?? null,
      spendLimitUsd ?? null,
      spendLimitMode,
      Date.parse(updatedAt),
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
  const placeholders = workflowRunIds.map(() => '?').join(', ');
  const prune: PlainStatement =
    workflowRunIds.length === 0
      ? { sql: 'DELETE FROM session_workflows WHERE session_id = ?', params: [sessionId] }
      : {
          sql: `DELETE FROM session_workflows
           WHERE session_id = ? AND workflow_run_id NOT IN (${placeholders})`,
          params: [sessionId, ...workflowRunIds],
        };
  await db.transaction({
    statements: [
      prune,
      ...workflowRunIds.map((runId, ordinal) => ({
        sql: 'UPDATE session_workflows SET ordinal = ? WHERE workflow_run_id = ? AND session_id = ?',
        params: [ordinal, runId, sessionId],
      })),
      sessionTouchStatement({ sessionId, updatedAt }),
    ],
  });
};

export const discardWorkflowInSession = async (
  db: Database,
  sessionId: SessionId,
  workflowRunId: WorkflowRunId,
  discardedAt: IsoDateTime,
): Promise<void> => {
  const updatedAt = Date.parse(discardedAt);
  await db.transaction({
    statements: [
      {
        sql: 'UPDATE session_workflows SET discarded_at = ? WHERE workflow_run_id = ?',
        params: [updatedAt, workflowRunId],
      },
      {
        sql: `UPDATE session_artifacts
         SET status = 'superseded', updated_at = ?
         WHERE kind = 'plan' AND workflow_run_id = ? AND status = 'active'`,
        params: [updatedAt, workflowRunId],
      },
      sessionTouchStatement({ sessionId, updatedAt: discardedAt }),
    ],
  });
};

export const restoreWorkflowInSession = async (
  db: Database,
  sessionId: SessionId,
  workflowRunId: WorkflowRunId,
  restoredAt: IsoDateTime,
): Promise<void> => {
  await db.transaction({
    statements: [
      {
        sql: 'UPDATE session_workflows SET discarded_at = NULL WHERE workflow_run_id = ?',
        params: [workflowRunId],
      },
      {
        sql: `UPDATE session_artifacts
         SET status = 'active', updated_at = ?
         WHERE kind = 'plan' AND workflow_run_id = ? AND status = 'superseded'`,
        params: [Date.parse(restoredAt), workflowRunId],
      },
      sessionTouchStatement({ sessionId, updatedAt: restoredAt }),
    ],
  });
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
  hints: ReadonlyArray<OrchestratorHint>,
): Promise<void> => {
  await db.execute(
    'UPDATE session_workflows SET orchestrator_hint_log = ? WHERE workflow_run_id = ?',
    [serializeOrchestratorHintLog({ hints }), workflowRunId],
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

type WorkflowRunTitleParams = {
  readonly db: Database;
  readonly workflowRunId: WorkflowRunId;
  readonly title: string;
};

export const updateGeneratedWorkflowRunTitle = async ({
  db,
  workflowRunId,
  title,
}: WorkflowRunTitleParams): Promise<boolean> => {
  const { rowsAffected } = await db.execute(
    'UPDATE session_workflows SET title = ? WHERE workflow_run_id = ? AND title_user_edited = 0',
    [title, workflowRunId],
  );
  return rowsAffected > 0;
};

export const updateUserWorkflowRunTitle = async ({
  db,
  workflowRunId,
  title,
}: WorkflowRunTitleParams): Promise<void> => {
  await db.execute(
    'UPDATE session_workflows SET title = ?, title_user_edited = 1 WHERE workflow_run_id = ?',
    [title, workflowRunId],
  );
};

export type WorkflowRunStepRepoint = Readonly<{
  fromStepId: StepId;
  toStepId: StepId;
}>;

type RepointWorkflowRunParams = {
  readonly db: Database;
  readonly workflowRunId: WorkflowRunId;
  readonly workflowId: WorkflowId;
  readonly stepRepoints: ReadonlyArray<WorkflowRunStepRepoint>;
};

export const repointWorkflowRunTemplate = async ({
  db,
  workflowRunId,
  workflowId,
  stepRepoints,
}: RepointWorkflowRunParams): Promise<void> => {
  await db.transaction({
    statements: [
      {
        sql: 'UPDATE session_workflows SET workflow_id = ? WHERE workflow_run_id = ?',
        params: [workflowId, workflowRunId],
      },
      ...stepRepoints.map((repoint) => ({
        sql: 'UPDATE agents SET step_id = ? WHERE workflow_run_id = ? AND step_id = ?',
        params: [repoint.toStepId, workflowRunId, repoint.fromStepId],
      })),
    ],
  });
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
