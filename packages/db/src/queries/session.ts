import type {
  IsoDateTime,
  ProviderRunId,
  Session,
  SessionId,
  SessionStatus,
  StepId,
  TaskId,
} from '@kay-am/types';
import type { Database } from '../client';

interface SessionRow {
  id: string;
  task_id: string;
  step_id: string;
  ordinal: number;
  name: string;
  status: string;
  provider_run_id: string | null;
  output_summary: string | null;
  started_at: string | null;
  completed_at: string | null;
}

function toSession(row: SessionRow): Session {
  return {
    id: row.id as SessionId,
    taskId: row.task_id as TaskId,
    stepId: row.step_id as StepId,
    ordinal: row.ordinal,
    name: row.name,
    status: row.status as SessionStatus,
    ...(row.provider_run_id && { runId: row.provider_run_id as ProviderRunId }),
    ...(row.output_summary && { outputSummary: row.output_summary }),
    ...(row.started_at && { startedAt: row.started_at as IsoDateTime }),
    ...(row.completed_at && { completedAt: row.completed_at as IsoDateTime }),
  };
}

export async function listSessionsForTask(
  db: Database,
  taskId: TaskId,
): Promise<ReadonlyArray<Session>> {
  const rows = await db.select<SessionRow>(
    'SELECT * FROM sessions WHERE task_id = ? ORDER BY ordinal ASC',
    [taskId],
  );
  return rows.map(toSession);
}

export async function insertSession(db: Database, session: Session): Promise<void> {
  await db.execute(
    `INSERT INTO sessions
      (id, task_id, step_id, ordinal, name, status, provider_run_id, output_summary, started_at, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      session.id,
      session.taskId,
      session.stepId,
      session.ordinal,
      session.name,
      session.status,
      session.runId ?? null,
      session.outputSummary ?? null,
      session.startedAt ?? null,
      session.completedAt ?? null,
    ],
  );
}

export async function updateSessionStatus(
  db: Database,
  id: SessionId,
  fields: {
    status?: SessionStatus;
    runId?: ProviderRunId;
    outputSummary?: string;
    startedAt?: IsoDateTime;
    completedAt?: IsoDateTime;
  },
): Promise<void> {
  const updates: string[] = [];
  const values: unknown[] = [];

  if (fields.status !== undefined) {
    updates.push('status = ?');
    values.push(fields.status);
  }
  if (fields.runId !== undefined) {
    updates.push('provider_run_id = ?');
    values.push(fields.runId);
  }
  if (fields.outputSummary !== undefined) {
    updates.push('output_summary = ?');
    values.push(fields.outputSummary);
  }
  if (fields.startedAt !== undefined) {
    updates.push('started_at = ?');
    values.push(fields.startedAt);
  }
  if (fields.completedAt !== undefined) {
    updates.push('completed_at = ?');
    values.push(fields.completedAt);
  }

  if (updates.length === 0) return;

  values.push(id);
  await db.execute(`UPDATE sessions SET ${updates.join(', ')} WHERE id = ?`, values);
}
