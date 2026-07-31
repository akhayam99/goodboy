import type {
  IsoDateTime,
  SessionId,
  WorkflowId,
  WorkflowExecutionMode,
  WorkflowOrchestrationOutcome,
  WorkflowRun,
  WorkflowRunId,
  WorkflowTriggerMode,
} from '@goodboy/types';
import type { Database } from '../client';

type SessionWorkflowRow = {
  workflow_run_id: string;
  workflow_id: string;
  ordinal: number;
  current_step_ordinal: number;
  auto_run: number;
  trigger_mode: string;
  execution_mode: string;
  orchestration_outcome: string | null;
  orchestration_error: string | null;
  orchestrator_hints: string | null;
  chain_after_run_id: string | null;
  goal: string | null;
  discarded_at: string | null;
};

function toWorkflowRun(row: SessionWorkflowRow): WorkflowRun {
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
    ...(row.orchestration_error != null &&
      row.orchestration_error !== '' && { orchestrationError: row.orchestration_error }),
    ...(row.orchestrator_hints != null &&
      row.orchestrator_hints !== '' && { orchestratorHints: row.orchestrator_hints }),
    ...(row.chain_after_run_id != null && {
      chainAfterId: row.chain_after_run_id as WorkflowRunId,
    }),
    ...(row.goal != null && row.goal !== '' && { goal: row.goal }),
    ...(row.discarded_at != null && { discardedAt: row.discarded_at as IsoDateTime }),
  };
}

export const listWorkflowsForSession = async (
  db: Database,
  sessionId: SessionId,
): Promise<ReadonlyArray<WorkflowRun>> => {
  const rows = await db.select<SessionWorkflowRow>(
    'SELECT workflow_run_id, workflow_id, ordinal, current_step_ordinal, auto_run, trigger_mode, execution_mode, orchestration_outcome, orchestration_error, orchestrator_hints, chain_after_run_id, goal, discarded_at FROM session_workflows WHERE session_id = ? ORDER BY ordinal ASC',
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

export const attachWorkflowToSession = async (
  db: Database,
  sessionId: SessionId,
  workflowRunId: WorkflowRunId,
  workflowId: WorkflowId,
  autoRun: boolean,
  updatedAt: IsoDateTime,
  goal?: string,
  triggerMode: WorkflowTriggerMode = 'immediate',
  chainAfterRunId?: WorkflowRunId,
  executionMode: WorkflowExecutionMode = 'static',
): Promise<void> => {
  const maxOrdinal = await db.select<{ max_ordinal: number | null }>(
    'SELECT MAX(ordinal) as max_ordinal FROM session_workflows WHERE session_id = ?',
    [sessionId],
  );
  const nextOrdinal = (maxOrdinal[0]?.max_ordinal ?? -1) + 1;

  await db.execute(
    'INSERT INTO session_workflows (workflow_run_id, session_id, workflow_id, ordinal, current_step_ordinal, auto_run, goal, trigger_mode, chain_after_run_id, execution_mode) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
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
    'SELECT workflow_run_id, workflow_id, ordinal, current_step_ordinal, auto_run, trigger_mode, execution_mode, orchestration_outcome, orchestration_error, orchestrator_hints, chain_after_run_id, goal, discarded_at FROM session_workflows WHERE session_id = ?',
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
        'INSERT INTO session_workflows (workflow_run_id, session_id, workflow_id, ordinal, current_step_ordinal, auto_run, goal, discarded_at, trigger_mode, chain_after_run_id, execution_mode, orchestration_outcome, orchestration_error, orchestrator_hints) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
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
          prev.orchestration_error,
          prev.orchestrator_hints,
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
): Promise<void> => {
  await db.execute(
    'UPDATE session_workflows SET orchestration_outcome = ? WHERE workflow_run_id = ?',
    [outcome, workflowRunId],
  );
};

export const updateWorkflowRunOrchestrationError = async (
  db: Database,
  workflowRunId: WorkflowRunId,
  message: string | null,
): Promise<void> => {
  await db.execute(
    'UPDATE session_workflows SET orchestration_error = ? WHERE workflow_run_id = ?',
    [message, workflowRunId],
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
