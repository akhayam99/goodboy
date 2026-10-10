import type {
  Agent,
  AgentEffort,
  AgentId,
  AgentSourceKind,
  AgentStatus,
  AgentStoppedBy,
  IsoDateTime,
  ProviderId,
  ProviderRunId,
  SessionId,
  StepId,
  VerbosityLevel,
  WorkflowRoutingDecision,
  WorkflowRoutingLock,
  WorkflowRunId,
  WorkflowTaskProfile,
} from '@goodboy/types';
import type { Database, GuardedStatement, PlainStatement, Statement } from '../client';
import { InvalidWorkflowNodeError, NodeNotMutableError, NotFoundError } from '../shared/errors';
import { getAgentById, listLiveChildAgents, type AgentRoutingUpdate } from './agent';
import {
  isWorkflowRoutingDecision,
  isWorkflowRoutingLock,
  isWorkflowTaskProfile,
  stringifyRoutingJson,
} from './workflowRoutingCodec';

export type AgentInsertInput = {
  readonly id?: AgentId;
  readonly sessionId: SessionId;
  readonly stepId?: StepId;
  readonly workflowRunId?: WorkflowRunId;
  readonly parentAgentId?: AgentId;
  readonly ordinal: number;
  readonly name: string;
  readonly status: AgentStatus;
  readonly providerRunId?: ProviderRunId;
  readonly outputSummary?: string;
  readonly startedAt?: IsoDateTime;
  readonly completedAt?: IsoDateTime;
  readonly kind?: string;
  readonly verbosity?: VerbosityLevel;
  readonly effort?: AgentEffort;
  readonly modelOverride?: string;
  readonly providerOverride?: ProviderId;
  readonly sourceThreadId?: string;
  readonly sourceThreadIds?: ReadonlyArray<string>;
  readonly sourceCommentUrl?: string;
  readonly sourceKind?: AgentSourceKind;
  readonly domains?: ReadonlyArray<string>;
  readonly routingLock?: WorkflowRoutingLock | null;
  readonly routingDecision?: WorkflowRoutingDecision | null;
  readonly taskProfile?: WorkflowTaskProfile | null;
};

export type AgentBatchInput = {
  readonly parentAgentId: AgentId;
  readonly children: ReadonlyArray<AgentInsertInput>;
};

export type AgentBatchOutcome = Readonly<{
  inserted: boolean;
  agents: ReadonlyArray<Agent>;
}>;

export type AgentStatusFields = {
  readonly status: AgentStatus;
  readonly providerRunId?: ProviderRunId;
  readonly outputSummary?: string;
  readonly startedAt?: IsoDateTime;
  readonly completedAt?: IsoDateTime;
  readonly stoppedAt?: IsoDateTime;
  readonly stoppedBy?: AgentStoppedBy;
};

export type WorkflowNodeRouting = AgentRoutingUpdate & {
  readonly nodeKind: 'step' | 'agent';
  readonly id: StepId | AgentId;
};

const AGENT_INSERT_SQL = `INSERT INTO agents
   (id, session_id, step_id, ordinal, name, status,
    provider_run_id, output_summary, started_at, last_finished_at, kind, verbosity,
    effort, model_override, provider_override,
    parent_agent_id, workflow_run_id, source_thread_id, source_thread_ids, source_comment_url, source_kind,
    domains_json, routing_lock, routing_decision, task_profile)
 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

const TERMINAL_STATUSES: ReadonlyArray<AgentStatus> = ['completed', 'failed', 'blocked', 'skipped'];
const STARTED_LIST = `'starting', 'running', 'completed'`;
const DEFAULT_STOPPED_BY: AgentStoppedBy = 'you';
const FANNED_OUT = 'already_fanned_out';
const AGENT_MISSING = 'agent_missing';
const NODE_LOCKED = 'node_locked';
const NODE_MISSING = 'node_missing';

const isoToMs = (value: IsoDateTime | undefined): number | null => {
  if (value === undefined) {
    return null;
  }
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
};

type AgentRoutingFields = {
  readonly routingLock?: WorkflowRoutingLock | null;
  readonly routingDecision?: WorkflowRoutingDecision | null;
  readonly taskProfile?: WorkflowTaskProfile | null;
};

const routingJson = (input: AgentRoutingFields) => ({
  lock: stringifyRoutingJson({
    value: input.routingLock ?? null,
    isValid: isWorkflowRoutingLock,
    field: 'routing lock',
  }),
  decision: stringifyRoutingJson({
    value: input.routingDecision ?? null,
    isValid: isWorkflowRoutingDecision,
    field: 'routing decision',
  }),
  profile: stringifyRoutingJson({
    value: input.taskProfile ?? null,
    isValid: isWorkflowTaskProfile,
    field: 'task profile',
  }),
});

type InsertStatementParams = {
  readonly input: AgentInsertInput;
  readonly id: AgentId;
  readonly parentAgentId?: AgentId;
};

const insertStatement = ({ input, id, parentAgentId }: InsertStatementParams): PlainStatement => {
  const routing = routingJson(input);
  return {
    sql: AGENT_INSERT_SQL,
    params: [
      id,
      input.sessionId,
      input.stepId ?? null,
      input.ordinal,
      input.name,
      input.status,
      input.providerRunId ?? null,
      input.outputSummary ?? null,
      isoToMs(input.startedAt),
      isoToMs(input.completedAt),
      input.kind ?? null,
      input.verbosity ?? null,
      input.effort ?? null,
      input.modelOverride ?? null,
      input.providerOverride ?? null,
      parentAgentId ?? input.parentAgentId ?? null,
      input.workflowRunId ?? null,
      input.sourceThreadId ?? null,
      input.sourceThreadIds === undefined ? null : JSON.stringify(input.sourceThreadIds),
      input.sourceCommentUrl ?? null,
      input.sourceKind ?? null,
      input.domains === undefined ? null : JSON.stringify(input.domains),
      routing.lock,
      routing.decision,
      routing.profile,
    ],
  };
};

const requireAgent = async (db: Database, id: AgentId): Promise<Agent> => {
  const agent = await getAgentById(db, id);
  if (agent === null) {
    throw new NotFoundError('agent', id);
  }
  return agent;
};

export const insertAgent = async (db: Database, input: AgentInsertInput): Promise<Agent> => {
  const id = input.id ?? (crypto.randomUUID() as AgentId);
  const { sql, params } = insertStatement({ input, id });
  await db.execute(sql, params);
  return requireAgent(db, id);
};

export const insertAgentBatch = async (
  db: Database,
  { parentAgentId, children }: AgentBatchInput,
): Promise<AgentBatchOutcome> => {
  const statements = children.map((child) =>
    insertStatement({
      input: child,
      id: child.id ?? (crypto.randomUUID() as AgentId),
      parentAgentId,
    }),
  );
  const existing = await listLiveChildAgents(db, parentAgentId);
  if (existing.length > 0 || children.length === 0) {
    return { inserted: false, agents: existing };
  }
  const alreadyFannedOut: GuardedStatement = {
    sql: 'SELECT 1 AS present FROM live_agents WHERE parent_agent_id = ? LIMIT 1',
    params: [parentAgentId],
    abortWhen: 'rows',
    abortCode: FANNED_OUT,
  };
  const outcome = await db.transaction({ statements: [alreadyFannedOut, ...statements] });
  const agents = await listLiveChildAgents(db, parentAgentId);
  return { inserted: outcome.status === 'committed', agents };
};

const requireApplied = async (
  db: Database,
  id: AgentId,
  statement: PlainStatement,
): Promise<void> => {
  const { rowsAffected } = await db.execute(statement.sql, statement.params);
  if (rowsAffected === 0) {
    throw new NotFoundError('agent', id);
  }
};

export const recordAgentStatus = async (
  db: Database,
  id: AgentId,
  fields: AgentStatusFields,
): Promise<Agent> => {
  const isTerminal = TERMINAL_STATUSES.includes(fields.status);
  const isStopped = fields.status === 'stopped';
  const now = Date.now();
  await requireApplied(db, id, {
    sql: `UPDATE agents SET
       status           = ?,
       provider_run_id  = COALESCE(?, provider_run_id),
       output_summary   = COALESCE(?, output_summary),
       started_at       = COALESCE(?, started_at),
       last_finished_at = CASE WHEN ? = 1
         THEN COALESCE(?, last_finished_at, ?)
         ELSE last_finished_at END,
       stopped_at       = CASE WHEN ? = 1 THEN COALESCE(?, ?) END,
       stopped_by       = ?
     WHERE id = ?`,
    params: [
      fields.status,
      fields.providerRunId ?? null,
      fields.outputSummary ?? null,
      isoToMs(fields.startedAt),
      isTerminal ? 1 : 0,
      isoToMs(fields.completedAt),
      now,
      isStopped ? 1 : 0,
      isoToMs(fields.stoppedAt),
      now,
      isStopped ? (fields.stoppedBy ?? DEFAULT_STOPPED_BY) : null,
      id,
    ],
  });
  return requireAgent(db, id);
};

type StopGhostAgentsParams = {
  readonly db: Database;
  readonly keepRunIds: ReadonlyArray<string>;
};

export const stopGhostAgents = async ({
  db,
  keepRunIds,
}: StopGhostAgentsParams): Promise<number> => {
  const keep =
    keepRunIds.length === 0
      ? ''
      : ` AND provider_run_id NOT IN (${keepRunIds.map(() => '?').join(', ')})`;
  const { rowsAffected } = await db.execute(
    `UPDATE agents SET status = 'stopped', stopped_at = ?, stopped_by = 'app'
     WHERE status = 'running' AND provider_run_id IS NOT NULL${keep}`,
    [Date.now(), ...keepRunIds],
  );
  return rowsAffected;
};

export const setAgentVerbosity = async (
  db: Database,
  id: AgentId,
  verbosity: VerbosityLevel | null,
): Promise<void> => {
  await requireApplied(db, id, {
    sql: 'UPDATE agents SET verbosity = ? WHERE id = ?',
    params: [verbosity, id],
  });
};

type ProviderSessionParams = {
  readonly id: AgentId;
  readonly providerSessionId: string;
  readonly providerSessionProviderId: ProviderId;
};

export const setAgentProviderSession = async (
  db: Database,
  { id, providerSessionId, providerSessionProviderId }: ProviderSessionParams,
): Promise<void> => {
  await requireApplied(db, id, {
    sql: 'UPDATE agents SET provider_session_id = ?, provider_session_provider_id = ? WHERE id = ?',
    params: [providerSessionId, providerSessionProviderId, id],
  });
};

export const markAgentViewed = async (
  db: Database,
  id: AgentId,
  at: IsoDateTime,
): Promise<void> => {
  await requireApplied(db, id, {
    sql: 'UPDATE agents SET last_viewed_at = ? WHERE id = ?',
    params: [isoToMs(at) ?? Date.now(), id],
  });
};

export const setAgentDone = async (
  db: Database,
  id: AgentId,
  done: boolean,
  at: IsoDateTime | null,
): Promise<void> => {
  await requireApplied(db, id, {
    sql: 'UPDATE agents SET done_at = CASE WHEN ? = 1 THEN ? ELSE NULL END WHERE id = ?',
    params: [done ? 1 : 0, at === null ? null : isoToMs(at), id],
  });
};

const ROUTING_COLUMNS = `routing_lock = ?, routing_decision = ?, task_profile = ?,
       provider_override = ?, model_override = ?, effort = ?`;

const nodeStatements = (update: WorkflowNodeRouting): ReadonlyArray<Statement> => {
  const routing = routingJson(update);
  const values = [
    routing.lock,
    routing.decision,
    routing.profile,
    update.providerOverride,
    update.modelOverride,
    update.effort,
    update.id,
  ];
  if (update.nodeKind === 'agent') {
    return [
      {
        sql: 'SELECT 1 AS present FROM agents WHERE id = ?',
        params: [update.id],
        abortWhen: 'noRows',
        abortCode: AGENT_MISSING,
      },
      {
        sql: `SELECT 1 AS present FROM agents WHERE id = ? AND status IN (${STARTED_LIST})`,
        params: [update.id],
        abortWhen: 'rows',
        abortCode: NODE_LOCKED,
      },
      {
        sql: `UPDATE agents SET ${ROUTING_COLUMNS} WHERE id = ?`,
        params: values,
        abortWhen: 'noChanges',
        abortCode: NODE_MISSING,
      },
    ];
  }
  return [
    {
      sql: `SELECT 1 AS present FROM live_agents
        WHERE step_id = ? AND status IN (${STARTED_LIST}) LIMIT 1`,
      params: [update.id],
      abortWhen: 'rows',
      abortCode: NODE_LOCKED,
    },
    {
      sql: `UPDATE steps SET ${ROUTING_COLUMNS} WHERE id = ?`,
      params: values,
      abortWhen: 'noChanges',
      abortCode: NODE_MISSING,
    },
  ];
};

export const updateWorkflowNodeRouting = async (
  db: Database,
  update: WorkflowNodeRouting,
): Promise<void> => {
  if (update.nodeKind !== 'agent' && update.nodeKind !== 'step') {
    throw new InvalidWorkflowNodeError(update.nodeKind);
  }
  const outcome = await db.transaction({ statements: nodeStatements(update) });
  if (outcome.status === 'committed') {
    return;
  }
  if (outcome.abortCode === NODE_LOCKED) {
    throw new NodeNotMutableError(update.id);
  }
  throw new NotFoundError(outcome.abortCode === AGENT_MISSING ? 'agent' : 'workflow', update.id);
};
