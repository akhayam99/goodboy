import type {
  AgentRole,
  IsoDateTime,
  ModelEffort,
  OrchestratorRouting,
  ProviderId,
  RoleModelFallback,
  RoleModelPreference,
  RoleModelPreferences,
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
import { PROVIDER_IDS } from '@goodboy/types';
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
  role_model_overrides: string | null;
  spend_limit_usd: number | null;
  spend_limit_mode: string;
  chain_after_run_id: string | null;
  goal: string | null;
  discarded_at: number | null;
  created_at: number | string;
};

export const SESSION_WORKFLOW_COLS =
  'workflow_run_id, workflow_id, ordinal, current_step_ordinal, auto_run, trigger_mode, execution_mode, orchestration_outcome, orchestration_reason, orchestration_error, orchestration_stop_kind, orchestrator_hints, orchestrator_summary, orchestrator_provider, orchestrator_model, orchestrator_effort, role_model_overrides, spend_limit_usd, spend_limit_mode, chain_after_run_id, goal, discarded_at, created_at';

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

type RoleModelsColumn = {
  readonly value: string | null;
};

const ROLE_MODEL_ROLES = [
  'scout',
  'planner',
  'implementer',
  'reviewer',
  'investigator',
  'tester',
  'custom',
] satisfies ReadonlyArray<AgentRole>;

const MODEL_EFFORTS = [
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
] satisfies ReadonlyArray<ModelEffort>;

type UnknownRecord = Record<string, unknown>;

const isUnknownRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value != null && Array.isArray(value) === false;

type ProviderValueParams = {
  readonly value: unknown;
};

const providerFor = ({ value }: ProviderValueParams): ProviderId | null =>
  PROVIDER_IDS.find((provider) => provider === value) ?? null;

type EffortValueParams = {
  readonly value: unknown;
};

const effortFor = ({ value }: EffortValueParams): ModelEffort | null =>
  MODEL_EFFORTS.find((effort) => effort === value) ?? null;

type FallbackValueParams = {
  readonly value: unknown;
};

const fallbackFor = ({ value }: FallbackValueParams): RoleModelFallback | null => {
  if (isUnknownRecord(value) === false) {
    return null;
  }
  const providerId = providerFor({ value: value.providerId });
  const model = value.model;
  const effort = value.effort == null ? null : effortFor({ value: value.effort });
  if (
    providerId == null ||
    typeof model !== 'string' ||
    model.trim() === '' ||
    (value.effort != null && effort == null)
  ) {
    return null;
  }
  return {
    providerId,
    model,
    ...(effort != null && { effort }),
  };
};

type PreferenceValueParams = {
  readonly value: unknown;
};

const preferenceFor = ({ value }: PreferenceValueParams): RoleModelPreference | null => {
  if (isUnknownRecord(value) === false) {
    return null;
  }
  const providerId = providerFor({ value: value.providerId });
  const model = value.model;
  const effort = effortFor({ value: value.effort });
  if (providerId == null || typeof model !== 'string' || model.trim() === '' || effort == null) {
    return null;
  }
  const fallback = fallbackFor({ value: value.fallback });
  return {
    providerId,
    model,
    effort,
    ...(fallback != null && { fallback }),
  };
};

const toRoleModelOverrides = ({ value }: RoleModelsColumn): RoleModelPreferences | null => {
  if (value == null || value === '') {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(value);
    if (isUnknownRecord(parsed) === false) {
      return null;
    }
    const preferences: Partial<Record<AgentRole, RoleModelPreference>> = {};
    for (const role of ROLE_MODEL_ROLES) {
      const preference = preferenceFor({ value: parsed[role] });
      if (preference != null) {
        preferences[role] = preference;
      }
    }
    return Object.keys(preferences).length > 0 ? preferences : null;
  } catch {
    return null;
  }
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
  const roleModelOverrides = toRoleModelOverrides({ value: row.role_model_overrides });
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
    ...(roleModelOverrides != null && { roleModelOverrides }),
    ...(row.spend_limit_usd != null && { spendLimitUsd: row.spend_limit_usd }),
    spendLimitMode: (row.spend_limit_mode ?? 'pause') as WorkflowSpendLimitMode,
    ...(row.chain_after_run_id != null && {
      chainAfterId: row.chain_after_run_id as WorkflowRunId,
    }),
    ...(row.goal != null && row.goal !== '' && { goal: row.goal }),
    ...(row.discarded_at != null && {
      discardedAt: new Date(row.discarded_at).toISOString() as IsoDateTime,
    }),
    ...(createdAt === undefined ? {} : { createdAt }),
  };
};

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
  const existing = await db.select<SessionWorkflowRow>(
    `SELECT ${SESSION_WORKFLOW_COLS} FROM session_workflows WHERE session_id = ?`,
    [sessionId],
  );
  const existingRunIds = new Set(existing.map((run) => run.workflow_run_id));

  await db.exec('BEGIN');
  try {
    if (workflowRunIds.length === 0) {
      await db.execute('DELETE FROM session_workflows WHERE session_id = ?', [sessionId]);
    }
    if (workflowRunIds.length > 0) {
      const placeholders = workflowRunIds.map(() => '?').join(', ');
      await db.execute(
        `DELETE FROM session_workflows
         WHERE session_id = ? AND workflow_run_id NOT IN (${placeholders})`,
        [sessionId, ...workflowRunIds],
      );
    }
    for (const [ordinal, runId] of workflowRunIds.entries()) {
      if (existingRunIds.has(runId) === false) {
        continue;
      }
      await db.execute(
        'UPDATE session_workflows SET ordinal = ? WHERE workflow_run_id = ? AND session_id = ?',
        [ordinal, runId, sessionId],
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
  const updatedAt = Date.parse(discardedAt);
  await db.exec('BEGIN');
  try {
    await db.execute('UPDATE session_workflows SET discarded_at = ? WHERE workflow_run_id = ?', [
      updatedAt,
      workflowRunId,
    ]);
    await db.execute(
      `UPDATE session_plans
       SET status = 'superseded', updated_at = ?
       WHERE workflow_run_id = ? AND status = 'active'`,
      [updatedAt, workflowRunId],
    );
    await bumpSessionUpdatedAt(db, sessionId, discardedAt);
    await db.exec('COMMIT');
  } catch (err) {
    await db.exec('ROLLBACK');
    throw err;
  }
};

export const restoreWorkflowInSession = async (
  db: Database,
  sessionId: SessionId,
  workflowRunId: WorkflowRunId,
  restoredAt: IsoDateTime,
): Promise<void> => {
  await db.exec('BEGIN');
  try {
    await db.execute('UPDATE session_workflows SET discarded_at = NULL WHERE workflow_run_id = ?', [
      workflowRunId,
    ]);
    await db.execute(
      `UPDATE session_plans
       SET status = 'active', updated_at = ?
       WHERE workflow_run_id = ? AND status = 'superseded'`,
      [Date.parse(restoredAt), workflowRunId],
    );
    await bumpSessionUpdatedAt(db, sessionId, restoredAt);
    await db.exec('COMMIT');
  } catch (err) {
    await db.exec('ROLLBACK');
    throw err;
  }
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

export const updateWorkflowRunRoleModelOverrides = async (
  db: Database,
  workflowRunId: WorkflowRunId,
  overrides: RoleModelPreferences | null,
): Promise<void> => {
  const serialized =
    overrides != null && Object.keys(overrides).length > 0 ? JSON.stringify(overrides) : null;
  await db.execute(
    'UPDATE session_workflows SET role_model_overrides = ? WHERE workflow_run_id = ?',
    [serialized, workflowRunId],
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
