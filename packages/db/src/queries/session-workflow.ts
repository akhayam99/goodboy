import type {
  IsoDateTime,
  SessionId,
  WorkflowId,
  WorkflowRun,
  WorkflowRunId,
} from '@goodboy/types';
import type { Database } from '../client';

type SessionWorkflowRow = {
  workflow_run_id: string;
  workflow_id: string;
  ordinal: number;
  current_step_ordinal: number;
  auto_run: number;
  discarded_at: string | null;
};

function toWorkflowRun(row: SessionWorkflowRow): WorkflowRun {
  return {
    id: row.workflow_run_id as WorkflowRunId,
    workflowId: row.workflow_id as WorkflowId,
    ordinal: row.ordinal,
    currentStep: row.current_step_ordinal,
    autoRun: row.auto_run !== 0,
    ...(row.discarded_at != null && { discardedAt: row.discarded_at as IsoDateTime }),
  };
}

export async function listWorkflowsForSession(
  db: Database,
  sessionId: SessionId,
): Promise<ReadonlyArray<WorkflowRun>> {
  const rows = await db.select<SessionWorkflowRow>(
    'SELECT workflow_run_id, workflow_id, ordinal, current_step_ordinal, auto_run, discarded_at FROM session_workflows WHERE session_id = ? ORDER BY ordinal ASC',
    [sessionId],
  );
  return rows.map(toWorkflowRun);
}

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

export async function attachWorkflowToSession(
  db: Database,
  sessionId: SessionId,
  workflowRunId: WorkflowRunId,
  workflowId: WorkflowId,
  autoRun: boolean,
  updatedAt: IsoDateTime,
): Promise<void> {
  const maxOrdinal = await db.select<{ max_ordinal: number | null }>(
    'SELECT MAX(ordinal) as max_ordinal FROM session_workflows WHERE session_id = ?',
    [sessionId],
  );
  const nextOrdinal = (maxOrdinal[0]?.max_ordinal ?? -1) + 1;

  await db.execute(
    'INSERT INTO session_workflows (workflow_run_id, session_id, workflow_id, ordinal, current_step_ordinal, auto_run) VALUES (?, ?, ?, ?, ?, ?)',
    [workflowRunId, sessionId, workflowId, nextOrdinal, 0, autoRun ? 1 : 0],
  );
  await bumpSessionUpdatedAt(db, sessionId, updatedAt);
}

export async function detachWorkflowFromSession(
  db: Database,
  sessionId: SessionId,
  workflowRunId: WorkflowRunId,
  updatedAt: IsoDateTime,
): Promise<void> {
  await db.execute('DELETE FROM session_workflows WHERE workflow_run_id = ?', [workflowRunId]);
  await bumpSessionUpdatedAt(db, sessionId, updatedAt);
}

export async function updateWorkflowOrder(
  db: Database,
  sessionId: SessionId,
  workflowRunIds: ReadonlyArray<WorkflowRunId>,
  updatedAt: IsoDateTime,
): Promise<void> {
  const existing = await db.select<SessionWorkflowRow>(
    'SELECT workflow_run_id, workflow_id, ordinal, current_step_ordinal, auto_run, discarded_at FROM session_workflows WHERE session_id = ?',
    [sessionId],
  );
  const byRun = new Map(existing.map((r) => [r.workflow_run_id, r]));

  await db.exec('BEGIN');
  try {
    await db.execute('DELETE FROM session_workflows WHERE session_id = ?', [sessionId]);
    for (const [ordinal, runId] of workflowRunIds.entries()) {
      const prev = byRun.get(runId);
      if (!prev) continue;
      await db.execute(
        'INSERT INTO session_workflows (workflow_run_id, session_id, workflow_id, ordinal, current_step_ordinal, auto_run, discarded_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          runId,
          sessionId,
          prev.workflow_id,
          ordinal,
          prev.current_step_ordinal,
          prev.auto_run,
          prev.discarded_at,
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
}

export async function discardWorkflowInSession(
  db: Database,
  sessionId: SessionId,
  workflowRunId: WorkflowRunId,
  discardedAt: IsoDateTime,
): Promise<void> {
  await db.execute('UPDATE session_workflows SET discarded_at = ? WHERE workflow_run_id = ?', [
    discardedAt,
    workflowRunId,
  ]);
  await bumpSessionUpdatedAt(db, sessionId, discardedAt);
}

export async function updateSessionWorkflowStep(
  db: Database,
  sessionId: SessionId,
  workflowRunId: WorkflowRunId,
  stepOrdinal: number,
  updatedAt: IsoDateTime,
): Promise<void> {
  await db.execute(
    'UPDATE session_workflows SET current_step_ordinal = ? WHERE workflow_run_id = ?',
    [stepOrdinal, workflowRunId],
  );
  await bumpSessionUpdatedAt(db, sessionId, updatedAt);
}

export async function updateSessionWorkflowAutoRun(
  db: Database,
  sessionId: SessionId,
  workflowRunId: WorkflowRunId,
  autoRun: boolean,
  updatedAt: IsoDateTime,
): Promise<void> {
  await db.execute('UPDATE session_workflows SET auto_run = ? WHERE workflow_run_id = ?', [
    autoRun ? 1 : 0,
    workflowRunId,
  ]);
  await bumpSessionUpdatedAt(db, sessionId, updatedAt);
}
