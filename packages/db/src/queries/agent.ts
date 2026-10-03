import type {
  Agent,
  AgentId,
  AgentSourceKind,
  AgentStatus,
  IsoDateTime,
  EffortLevel,
  ProviderId,
  ProviderRunId,
  SessionId,
  StepId,
  VerbosityLevel,
  WorkflowRunId,
  WorkflowRoutingDecision,
  WorkflowRoutingLock,
  WorkflowTaskProfile,
} from '@goodboy/types';
import { isAgentStoppedBy } from '@goodboy/types';
import type { Database, PlainStatement } from '../client';
import { legacyAgentRoutingDecision, parseWorkflowRouting } from './workflowRoutingCodec';
import { isJsonArray, parseJsonColumn } from '../shared/parseJsonColumn';

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
  started_at: number | null;
  provider_session_id: string | null;
  provider_session_provider_id: string | null;
  last_finished_at: number | null;
  last_viewed_at: number | null;
  done_at: number | null;
  stopped_at: number | null;
  stopped_by: string | null;
  deleted_at: number | null;
  verbosity: string | null;
  effort: string | null;
  model_override: string | null;
  provider_override: string | null;
  kind: string | null;
  source_thread_id: string | null;
  source_thread_ids: string | null;
  source_comment_url: string | null;
  source_kind: string | null;
  domains_json: string | null;
  routing_lock: string | null;
  routing_decision: string | null;
  task_profile: string | null;
};

type ParseStringListParams = {
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

const parseStringList = ({ value }: ParseStringListParams): ReadonlyArray<string> => {
  const parsed = parseJsonColumn({ value, isValid: isJsonArray, fallback: [] });
  return parsed.filter((domain): domain is string => typeof domain === 'string');
};

const toAgent = ({ row }: ToAgentParams): Agent => {
  const domains = parseStringList({ value: row.domains_json });
  const sourceThreadIds = parseStringList({ value: row.source_thread_ids });
  const routing = parseWorkflowRouting({
    routingLock: row.routing_lock,
    routingDecision: row.routing_decision,
    taskProfile: row.task_profile,
  });
  const routingDecision =
    routing.routingDecision ??
    (row.step_id === null && routing.routingLock === null
      ? legacyAgentRoutingDecision({
          provider: row.provider_override,
          model: row.model_override,
          effort: row.effort,
        })
      : null);
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
    ...(row.started_at != null && {
      startedAt: new Date(row.started_at).toISOString() as IsoDateTime,
    }),
    ...(row.provider_session_id && { providerSessionId: row.provider_session_id }),
    ...(row.provider_session_provider_id != null && {
      providerSessionProviderId: row.provider_session_provider_id as ProviderId,
    }),
    ...(row.last_finished_at != null && {
      completedAt: new Date(row.last_finished_at).toISOString() as IsoDateTime,
      lastFinishedAt: new Date(row.last_finished_at).toISOString() as IsoDateTime,
    }),
    ...(row.last_viewed_at != null && {
      lastViewedAt: new Date(row.last_viewed_at).toISOString() as IsoDateTime,
    }),
    ...(row.done_at != null && {
      doneAt: new Date(row.done_at).toISOString() as IsoDateTime,
    }),
    ...(row.stopped_at != null && {
      stoppedAt: new Date(row.stopped_at).toISOString() as IsoDateTime,
    }),
    ...(isAgentStoppedBy(row.stopped_by) && { stoppedBy: row.stopped_by }),
    ...(row.deleted_at != null && {
      deletedAt: new Date(row.deleted_at).toISOString() as IsoDateTime,
    }),
    ...(row.verbosity && { verbosity: row.verbosity as 'brief' | 'normal' | 'verbose' }),
    ...(row.effort && {
      effort: row.effort as EffortLevel,
    }),
    ...(row.model_override && { modelOverride: row.model_override }),
    ...(row.provider_override && { providerOverride: row.provider_override as ProviderId }),
    ...(row.kind && { kind: row.kind }),
    ...(row.source_thread_id != null && { sourceThreadId: row.source_thread_id }),
    ...(sourceThreadIds.length > 0 && { sourceThreadIds }),
    ...(row.source_comment_url != null && { sourceCommentUrl: row.source_comment_url }),
    ...(row.source_kind != null && { sourceKind: row.source_kind as AgentSourceKind }),
    ...(domains.length > 0 && { domains }),
    routingLock: routing.routingLock,
    routingDecision,
    taskProfile: routing.taskProfile,
  };
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
    `SELECT * FROM live_agents WHERE session_id IN (${placeholders}) ORDER BY session_id, ordinal ASC`,
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

export const listLiveChildAgents = async (
  db: Database,
  parentAgentId: AgentId,
): Promise<ReadonlyArray<Agent>> => {
  const rows = await db.select<AgentRow>(
    'SELECT * FROM live_agents WHERE parent_agent_id = ? ORDER BY ordinal ASC',
    [parentAgentId],
  );
  return rows.map((row) => toAgent({ row }));
};

type ListProviderSessionIdsParams = {
  readonly db: Database;
  readonly providerId: ProviderId;
};

export const listProviderSessionIds = async ({
  db,
  providerId,
}: ListProviderSessionIdsParams): Promise<ReadonlyArray<string>> => {
  const rows = await db.select<{ readonly provider_session_id: string }>(
    `SELECT DISTINCT provider_session_id FROM agents
     WHERE provider_session_provider_id = ? AND provider_session_id IS NOT NULL
     ORDER BY provider_session_id`,
    [providerId],
  );
  return rows.map((row) => row.provider_session_id);
};

export const getAgentById = async (db: Database, id: AgentId): Promise<Agent | null> => {
  const rows = await db.select<AgentRow>('SELECT * FROM agents WHERE id = ?', [id]);
  const row = rows[0];
  return row ? toAgent({ row }) : null;
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

export const PURGED_QUESTION_TEXTS_INDEX = 0;

type AgentPurgeParams = {
  readonly prefix: string;
  readonly prefixParams: ReadonlyArray<unknown>;
  readonly agentMatch: string;
  readonly matchParams: ReadonlyArray<unknown>;
  readonly deletedAt: number;
};

export const agentPurgeStatements = ({
  prefix,
  prefixParams,
  agentMatch,
  matchParams,
  deletedAt,
}: AgentPurgeParams): ReadonlyArray<PlainStatement> => {
  const params = [...prefixParams, ...matchParams];
  return [
    {
      sql: `${prefix} SELECT session_id, text FROM open_questions
          WHERE created_by_agent_id ${agentMatch} AND status = 'open'`,
      params,
    },
    {
      sql: `${prefix} DELETE FROM open_questions
          WHERE created_by_agent_id ${agentMatch} AND status = 'open'`,
      params,
    },
    { sql: `${prefix} DELETE FROM messages WHERE agent_id ${agentMatch}`, params },
    { sql: `${prefix} DELETE FROM turn_events WHERE agent_id ${agentMatch}`, params },
    {
      sql: `${prefix} UPDATE agents
          SET deleted_at = COALESCE(deleted_at, ?), output_summary = NULL
          WHERE id ${agentMatch}`,
      params: [...prefixParams, deletedAt, ...matchParams],
    },
  ];
};

export const purgeAgentForDelete = async ({
  db,
  id,
}: {
  readonly db: Database;
  readonly id: AgentId;
}): Promise<ReadonlyArray<string>> => {
  const outcome = await db.transaction({
    statements: agentPurgeStatements({
      prefix: '',
      prefixParams: [],
      agentMatch: '= ?',
      matchParams: [id],
      deletedAt: Date.now(),
    }),
  });
  if (outcome.status === 'aborted') {
    return [];
  }
  const rows = outcome.results[PURGED_QUESTION_TEXTS_INDEX]?.rows ?? [];
  return rows.flatMap((row) => (typeof row.text === 'string' ? [row.text] : []));
};

export type AgentConfigUpdate = {
  verbosity?: VerbosityLevel | null;
  effort?: EffortLevel | null;
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

export type AgentRoutingUpdate = Readonly<{
  routingLock: WorkflowRoutingLock | null;
  routingDecision: WorkflowRoutingDecision;
  taskProfile: WorkflowTaskProfile | null;
  providerOverride: ProviderId | null;
  modelOverride: string | null;
  effort: EffortLevel | null;
}>;
