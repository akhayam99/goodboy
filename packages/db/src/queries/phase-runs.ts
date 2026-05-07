import type {
  IsoDateTime,
  PhaseDefinitionId,
  PhaseRun,
  PhaseRunId,
  PhaseRunStatus,
  ProviderRunId,
  SessionId,
} from '@kay-am/types';
import type { Database } from '../client';

interface PhaseRunRow {
  id: string;
  session_id: string;
  phase_definition_id: string;
  ordinal: number;
  name: string;
  status: string;
  provider_run_id: string | null;
  output_summary: string | null;
  started_at: string | null;
  completed_at: string | null;
}

function toPhaseRun(row: PhaseRunRow): PhaseRun {
  return {
    id: row.id as PhaseRunId,
    sessionId: row.session_id as SessionId,
    phaseDefinitionId: row.phase_definition_id as PhaseDefinitionId,
    ordinal: row.ordinal,
    name: row.name,
    status: row.status as PhaseRunStatus,
    ...(row.provider_run_id && { runId: row.provider_run_id as ProviderRunId }),
    ...(row.output_summary && { outputSummary: row.output_summary }),
    ...(row.started_at && { startedAt: row.started_at as IsoDateTime }),
    ...(row.completed_at && { completedAt: row.completed_at as IsoDateTime }),
  };
}

export async function listPhaseRunsForSession(
  db: Database,
  sessionId: SessionId,
): Promise<ReadonlyArray<PhaseRun>> {
  const rows = await db.select<PhaseRunRow>(
    'SELECT * FROM session_phase_runs WHERE session_id = ? ORDER BY ordinal ASC',
    [sessionId],
  );
  return rows.map(toPhaseRun);
}

export async function insertPhaseRun(db: Database, run: PhaseRun): Promise<void> {
  await db.execute(
    `INSERT INTO session_phase_runs
      (id, session_id, phase_definition_id, ordinal, name, status, provider_run_id, output_summary, started_at, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      run.id,
      run.sessionId,
      run.phaseDefinitionId,
      run.ordinal,
      run.name,
      run.status,
      run.runId ?? null,
      run.outputSummary ?? null,
      run.startedAt ?? null,
      run.completedAt ?? null,
    ],
  );
}

export async function updatePhaseRunStatus(
  db: Database,
  id: PhaseRunId,
  fields: {
    status?: PhaseRunStatus;
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
  await db.execute(`UPDATE session_phase_runs SET ${updates.join(', ')} WHERE id = ?`, values);
}
