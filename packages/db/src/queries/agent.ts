import type {
  Agent,
  AgentId,
  AgentStatus,
  IsoDateTime,
  ModelEffort,
  ProviderId,
  ProviderRunId,
  SessionId,
  StepId,
  VerbosityLevel,
  WorkflowRunId,
} from '@goodboy/types';
import type { Database } from '../client';

type AgentRow = {
  id: string;
  session_id: string;
  step_id: string | null;
  workflow_run_id: string | null;
  parent_agent_id: string | null;
  ordinal: number;
  name: string;
  status: string;
  provider_run_id: string | null;
  output_summary: string | null;
  started_at: string | null;
  completed_at: string | null;
  provider_session_id: string | null;
  last_finished_at: string | null;
  last_viewed_at: string | null;
  done_at: string | null;
  deleted_at: number | null;
  verbosity: string | null;
  effort: string | null;
  model_override: string | null;
  provider_override: string | null;
  kind: string | null;
  domains_json: string | null;
};

type ParseDomainsParams = {
  readonly value: string | null;
};

type ToAgentParams = {
  readonly row: AgentRow;
};

type UpdateAgentDomainsParams = {
  readonly db: Database;
  readonly id: AgentId;
  readonly domains: ReadonlyArray<string> | null;
};

const parseDomains = ({ value }: ParseDomainsParams): ReadonlyArray<string> => {
  if (value === null) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((domain): domain is string => typeof domain === 'string');
  } catch {
    return [];
  }
};

const toAgent = ({ row }: ToAgentParams): Agent => {
  const domains = parseDomains({ value: row.domains_json });
  return {
    id: row.id as AgentId,
    sessionId: row.session_id as SessionId,
    ...(row.step_id != null && { stepId: row.step_id as StepId }),
    ...(row.workflow_run_id != null && { workflowRunId: row.workflow_run_id as WorkflowRunId }),
    ...(row.parent_agent_id != null && { parentAgentId: row.parent_agent_id as AgentId }),
    ordinal: row.ordinal,
    name: row.name,
    status: row.status as AgentStatus,
    ...(row.provider_run_id && { runId: row.provider_run_id as ProviderRunId }),
    ...(row.output_summary && { outputSummary: row.output_summary }),
    ...(row.started_at && { startedAt: row.started_at as IsoDateTime }),
    ...(row.completed_at && { completedAt: row.completed_at as IsoDateTime }),
    ...(row.provider_session_id && { providerSessionId: row.provider_session_id }),
    ...(row.last_finished_at && { lastFinishedAt: row.last_finished_at as IsoDateTime }),
    ...(row.last_viewed_at && { lastViewedAt: row.last_viewed_at as IsoDateTime }),
    ...(row.done_at && { doneAt: row.done_at as IsoDateTime }),
    ...(row.deleted_at != null && {
      deletedAt: new Date(row.deleted_at).toISOString() as IsoDateTime,
    }),
    ...(row.verbosity && { verbosity: row.verbosity as 'brief' | 'normal' | 'verbose' }),
    ...(row.effort && {
      effort: row.effort as ModelEffort,
    }),
    ...(row.model_override && { modelOverride: row.model_override }),
    ...(row.provider_override && { providerOverride: row.provider_override }),
    ...(row.kind && { kind: row.kind }),
    ...(domains.length > 0 && { domains }),
  };
};

export const listAgentsForSession = async (
  db: Database,
  sessionId: SessionId,
): Promise<ReadonlyArray<Agent>> => {
  const rows = await db.select<AgentRow>(
    'SELECT * FROM agents WHERE session_id = ? ORDER BY ordinal ASC',
    [sessionId],
  );
  return rows.map((row) => toAgent({ row }));
};

export const listAgentsForSessions = async (
  db: Database,
  sessionIds: ReadonlyArray<SessionId>,
): Promise<Map<SessionId, ReadonlyArray<Agent>>> => {
  const out = new Map<SessionId, Agent[]>();
  if (sessionIds.length === 0) {
    return out;
  }
  const placeholders = sessionIds.map(() => '?').join(', ');
  const rows = await db.select<AgentRow>(
    `SELECT * FROM agents WHERE session_id IN (${placeholders}) AND deleted_at IS NULL ORDER BY session_id, ordinal ASC`,
    sessionIds,
  );
  for (const row of rows) {
    const agent = toAgent({ row });
    const bucket = out.get(agent.sessionId) ?? [];
    bucket.push(agent);
    out.set(agent.sessionId, bucket);
  }
  return out;
};

export const getAgentById = async (db: Database, id: AgentId): Promise<Agent | null> => {
  const rows = await db.select<AgentRow>('SELECT * FROM agents WHERE id = ?', [id]);
  const row = rows[0];
  return row ? toAgent({ row }) : null;
};

export const insertAgent = async (db: Database, agent: Agent): Promise<void> => {
  await db.execute(
    `INSERT INTO agents
      (id, session_id, step_id, workflow_run_id, parent_agent_id, ordinal, name, status, provider_run_id, output_summary, started_at, completed_at, domains_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      agent.id,
      agent.sessionId,
      agent.stepId ?? null,
      agent.workflowRunId ?? null,
      agent.parentAgentId ?? null,
      agent.ordinal,
      agent.name,
      agent.status,
      agent.runId ?? null,
      agent.outputSummary ?? null,
      agent.startedAt ?? null,
      agent.completedAt ?? null,
      agent.domains !== undefined ? JSON.stringify(agent.domains) : null,
    ],
  );
};

export const updateAgentDomains = async ({
  db,
  id,
  domains,
}: UpdateAgentDomainsParams): Promise<void> => {
  await db.execute('UPDATE agents SET domains_json = ? WHERE id = ?', [
    domains !== null ? JSON.stringify(domains) : null,
    id,
  ]);
};

export const updateAgentStatus = async (
  db: Database,
  id: AgentId,
  fields: {
    status?: AgentStatus;
    runId?: ProviderRunId;
    outputSummary?: string;
    startedAt?: IsoDateTime;
    completedAt?: IsoDateTime;
  },
): Promise<void> => {
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

  if (updates.length === 0) {
    return;
  }

  values.push(id);
  await db.execute(`UPDATE agents SET ${updates.join(', ')} WHERE id = ?`, values);
};

export const softDeleteAgent = async (db: Database, id: AgentId): Promise<void> => {
  await db.execute('UPDATE agents SET deleted_at = ? WHERE id = ?', [Date.now(), id]);
};

export const restoreAgent = async (db: Database, id: AgentId): Promise<void> => {
  await db.execute('UPDATE agents SET deleted_at = NULL WHERE id = ?', [id]);
};

export type AgentConfigUpdate = {
  verbosity?: VerbosityLevel | null;
  effort?: ModelEffort | null;
  modelOverride?: string | null;
  providerOverride?: ProviderId | null;
  kind?: string | null;
};

export const updateAgentConfig = async (
  db: Database,
  id: AgentId,
  fields: AgentConfigUpdate,
): Promise<void> => {
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
  if (updates.length === 0) {
    return;
  }
  values.push(id);
  await db.execute(`UPDATE agents SET ${updates.join(', ')} WHERE id = ?`, values);
};
