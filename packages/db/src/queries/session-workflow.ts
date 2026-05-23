import type { IsoDateTime, SessionId, WorkflowId } from '@goodboy/types';
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
  workflowId: WorkflowId,
  updatedAt: IsoDateTime,
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
  await bumpSessionUpdatedAt(db, sessionId, updatedAt);
}

export async function detachWorkflowFromSession(
  db: Database,
  sessionId: SessionId,
  workflowId: WorkflowId,
  updatedAt: IsoDateTime,
): Promise<void> {
  await db.execute('DELETE FROM session_workflows WHERE session_id = ? AND workflow_id = ?', [
    sessionId,
    workflowId,
  ]);
  await bumpSessionUpdatedAt(db, sessionId, updatedAt);
}

// Atomically rewrites the ordinal column for a session's workflows.
// Wrapped in a transaction so a mid-loop failure can't leave the table with
// half-deleted / half-reinserted rows that would crash eager loaders.
export async function updateWorkflowOrder(
  db: Database,
  sessionId: SessionId,
  workflowIds: ReadonlyArray<WorkflowId>,
  updatedAt: IsoDateTime,
): Promise<void> {
  const existing = await db.select<{ workflow_id: string; current_step_ordinal: number }>(
    'SELECT workflow_id, current_step_ordinal FROM session_workflows WHERE session_id = ?',
    [sessionId],
  );
  const stepByWorkflow = new Map(existing.map((r) => [r.workflow_id, r.current_step_ordinal]));

  await db.exec('BEGIN');
  try {
    await db.execute('DELETE FROM session_workflows WHERE session_id = ?', [sessionId]);
    for (const [ordinal, workflowId] of workflowIds.entries()) {
      await db.execute(
        'INSERT INTO session_workflows (session_id, workflow_id, ordinal, current_step_ordinal) VALUES (?, ?, ?, ?)',
        [sessionId, workflowId, ordinal, stepByWorkflow.get(workflowId) ?? 0],
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

export async function updateSessionWorkflowStep(
  db: Database,
  sessionId: SessionId,
  workflowId: WorkflowId,
  stepOrdinal: number,
  updatedAt: IsoDateTime,
): Promise<void> {
  await db.execute(
    'UPDATE session_workflows SET current_step_ordinal = ? WHERE session_id = ? AND workflow_id = ?',
    [stepOrdinal, sessionId, workflowId],
  );
  await bumpSessionUpdatedAt(db, sessionId, updatedAt);
}
