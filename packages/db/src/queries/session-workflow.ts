import type { SessionId, WorkflowId } from '@goodboy/types';
import type { Database } from '../client';

export type SessionWorkflowEntry = Readonly<{
  workflowId: WorkflowId;
  currentStepOrdinal: number;
}>;

export async function listWorkflowsForSession(
  db: Database,
  sessionId: SessionId,
): Promise<ReadonlyArray<SessionWorkflowEntry>> {
  const rows = await db.select<{ workflow_id: string; current_step_ordinal: number }>(
    'SELECT workflow_id, current_step_ordinal FROM session_workflows WHERE session_id = ? ORDER BY ordinal ASC',
    [sessionId],
  );
  return rows.map((row) => ({
    workflowId: row.workflow_id as WorkflowId,
    currentStepOrdinal: row.current_step_ordinal,
  }));
}

export async function attachWorkflowToSession(
  db: Database,
  sessionId: SessionId,
  workflowId: WorkflowId,
): Promise<void> {
  const maxOrdinal = await db.select<{ max_ordinal: number | null }>(
    'SELECT MAX(ordinal) as max_ordinal FROM session_workflows WHERE session_id = ?',
    [sessionId],
  );
  const nextOrdinal = (maxOrdinal[0]?.max_ordinal ?? -1) + 1;

  await db.execute(
    'INSERT INTO session_workflows (session_id, workflow_id, ordinal, current_step_ordinal) VALUES (?, ?, ?, ?)',
    [sessionId, workflowId, nextOrdinal, 0],
  );
}

export async function detachWorkflowFromSession(
  db: Database,
  sessionId: SessionId,
  workflowId: WorkflowId,
): Promise<void> {
  await db.execute('DELETE FROM session_workflows WHERE session_id = ? AND workflow_id = ?', [
    sessionId,
    workflowId,
  ]);
}

export async function updateWorkflowOrder(
  db: Database,
  sessionId: SessionId,
  workflowIds: ReadonlyArray<WorkflowId>,
): Promise<void> {
  const existing = await db.select<{ workflow_id: string; current_step_ordinal: number }>(
    'SELECT workflow_id, current_step_ordinal FROM session_workflows WHERE session_id = ?',
    [sessionId],
  );
  const stepByWorkflow = new Map(existing.map((r) => [r.workflow_id, r.current_step_ordinal]));

  await db.execute('DELETE FROM session_workflows WHERE session_id = ?', [sessionId]);

  for (const [ordinal, workflowId] of workflowIds.entries()) {
    await db.execute(
      'INSERT INTO session_workflows (session_id, workflow_id, ordinal, current_step_ordinal) VALUES (?, ?, ?, ?)',
      [sessionId, workflowId, ordinal, stepByWorkflow.get(workflowId) ?? 0],
    );
  }
}

export async function updateSessionWorkflowStep(
  db: Database,
  sessionId: SessionId,
  workflowId: WorkflowId,
  stepOrdinal: number,
): Promise<void> {
  await db.execute(
    'UPDATE session_workflows SET current_step_ordinal = ? WHERE session_id = ? AND workflow_id = ?',
    [stepOrdinal, sessionId, workflowId],
  );
}
