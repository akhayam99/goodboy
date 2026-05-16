import type {
  Agent,
  AgentId,
  AgentStatus,
  IsoDateTime,
  ProviderRunId,
  SessionId,
  StepId,
} from '@kay-am/types';
import type { Database } from '../client';

interface AgentRow {
  id: string;
  session_id: string;
  step_id: string | null;
  ordinal: number;
  name: string;
  status: string;
  provider_run_id: string | null;
  output_summary: string | null;
  started_at: string | null;
  completed_at: string | null;
  last_finished_at: string | null;
  last_viewed_at: string | null;
  deleted_at: number | null;
  verbosity: string | null;
  effort: string | null;
  model_override: string | null;
  provider_override: string | null;
  kind: string | null;
}

function toAgent(row: AgentRow): Agent {
  return {
    id: row.id as AgentId,
    sessionId: row.session_id as SessionId,
    ...(row.step_id != null && { stepId: row.step_id as StepId }),
    ordinal: row.ordinal,
    name: row.name,
    status: row.status as AgentStatus,
    ...(row.provider_run_id && { runId: row.provider_run_id as ProviderRunId }),
    ...(row.output_summary && { outputSummary: row.output_summary }),
    ...(row.started_at && { startedAt: row.started_at as IsoDateTime }),
    ...(row.completed_at && { completedAt: row.completed_at as IsoDateTime }),
    ...(row.last_finished_at && { lastFinishedAt: row.last_finished_at as IsoDateTime }),
    ...(row.last_viewed_at && { lastViewedAt: row.last_viewed_at as IsoDateTime }),
    ...(row.deleted_at != null && {
      deletedAt: new Date(row.deleted_at).toISOString() as IsoDateTime,
    }),
    ...(row.verbosity && { verbosity: row.verbosity as 'brief' | 'normal' | 'verbose' }),
    ...(row.effort && {
      effort: row.effort as 'low' | 'medium' | 'high' | 'extra-high' | 'max',
    }),
    ...(row.model_override && { modelOverride: row.model_override }),
    ...(row.provider_override && { providerOverride: row.provider_override }),
    ...(row.kind && { kind: row.kind }),
  };
}

export async function listAgentsForSession(
  db: Database,
  sessionId: SessionId,
): Promise<ReadonlyArray<Agent>> {
  const rows = await db.select<AgentRow>(
    'SELECT * FROM agents WHERE session_id = ? ORDER BY ordinal ASC',
    [sessionId],
  );
  return rows.map(toAgent);
}

export async function insertAgent(db: Database, agent: Agent): Promise<void> {
  await db.execute(
    `INSERT INTO agents
      (id, session_id, step_id, ordinal, name, status, provider_run_id, output_summary, started_at, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      agent.id,
      agent.sessionId,
      agent.stepId ?? null,
      agent.ordinal,
      agent.name,
      agent.status,
      agent.runId ?? null,
      agent.outputSummary ?? null,
      agent.startedAt ?? null,
      agent.completedAt ?? null,
    ],
  );
}

export async function updateAgentStatus(
  db: Database,
  id: AgentId,
  fields: {
    status?: AgentStatus;
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
  await db.execute(`UPDATE agents SET ${updates.join(', ')} WHERE id = ?`, values);
}

export async function softDeleteAgent(db: Database, id: AgentId): Promise<void> {
  await db.execute('UPDATE agents SET deleted_at = ? WHERE id = ?', [Date.now(), id]);
}

export async function restoreAgent(db: Database, id: AgentId): Promise<void> {
  await db.execute('UPDATE agents SET deleted_at = NULL WHERE id = ?', [id]);
}

export interface AgentConfigUpdate {
  verbosity?: 'brief' | 'normal' | 'verbose' | null;
  effort?: 'low' | 'medium' | 'high' | 'extra-high' | 'max' | null;
  modelOverride?: string | null;
  providerOverride?: string | null;
  kind?: string | null;
}

export async function updateAgentConfig(
  db: Database,
  id: AgentId,
  fields: AgentConfigUpdate,
): Promise<void> {
  const updates: string[] = [];
  const values: unknown[] = [];
  if (fields.verbosity !== undefined) {
    updates.push('verbosity = ?');
    values.push(fields.verbosity);
  }
  if (fields.effort !== undefined) {
    updates.push('effort = ?');
    values.push(fields.effort);
  }
  if (fields.modelOverride !== undefined) {
    updates.push('model_override = ?');
    values.push(fields.modelOverride);
  }
  if (fields.providerOverride !== undefined) {
    updates.push('provider_override = ?');
    values.push(fields.providerOverride);
  }
  if (fields.kind !== undefined) {
    updates.push('kind = ?');
    values.push(fields.kind);
  }
  if (updates.length === 0) return;
  values.push(id);
  await db.execute(`UPDATE agents SET ${updates.join(', ')} WHERE id = ?`, values);
}
