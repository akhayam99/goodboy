import type {
  Agent,
  AgentId,
  AgentSourceKind,
  AgentStatus,
  EffortLevel,
  IsoDateTime,
  ProviderId,
  ProviderRunId,
  SessionId,
  StepId,
  WorkflowRunId,
} from '@goodboy/types';
import { isAgentStoppedBy } from '@goodboy/types';
import type { Database } from '../client';
import { mountIdOf } from './session-worktree';

export type AgentSummary = Omit<
  Agent,
  | 'outputSummary'
  | 'domains'
  | 'sourceThreadIds'
  | 'routingLock'
  | 'routingDecision'
  | 'taskProfile'
>;

export type AgentSummaryRow = {
  id: string;
  session_id: string;
  step_id: string | null;
  workflow_run_id: string | null;
  parent_agent_id: string | null;
  ordinal: number;
  name: string;
  status: string;
  provider_run_id: string | null;
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
  source_comment_url: string | null;
  source_kind: string | null;
  mount_id: string | null;
};

const AGENT_SUMMARY_COLUMNS = [
  'id',
  'session_id',
  'step_id',
  'workflow_run_id',
  'parent_agent_id',
  'ordinal',
  'name',
  'status',
  'provider_run_id',
  'started_at',
  'provider_session_id',
  'provider_session_provider_id',
  'last_finished_at',
  'last_viewed_at',
  'done_at',
  'stopped_at',
  'stopped_by',
  'deleted_at',
  'verbosity',
  'effort',
  'model_override',
  'provider_override',
  'kind',
  'source_thread_id',
  'source_comment_url',
  'source_kind',
  'mount_id',
] as const satisfies ReadonlyArray<keyof AgentSummaryRow>;

type ToSummaryParams = {
  readonly row: AgentSummaryRow;
};

type StampParams = {
  readonly value: number;
};

const agentStampOf = ({ value }: StampParams): IsoDateTime =>
  new Date(value).toISOString() as IsoDateTime;

export const toAgentSummary = ({ row }: ToSummaryParams): AgentSummary => ({
  id: row.id as AgentId,
  sessionId: row.session_id as SessionId,
  ...(row.step_id != null && { stepId: row.step_id as StepId }),
  ...(row.workflow_run_id != null && { workflowRunId: row.workflow_run_id as WorkflowRunId }),
  ...(row.parent_agent_id != null && { parentAgentId: row.parent_agent_id as AgentId }),
  ordinal: row.ordinal,
  name: row.name,
  status: row.status as AgentStatus,
  ...(row.provider_run_id != null &&
    row.provider_run_id !== '' && { runId: row.provider_run_id as ProviderRunId }),
  ...(row.started_at != null && { startedAt: agentStampOf({ value: row.started_at }) }),
  ...(row.provider_session_id != null &&
    row.provider_session_id !== '' && { providerSessionId: row.provider_session_id }),
  ...(row.provider_session_provider_id != null && {
    providerSessionProviderId: row.provider_session_provider_id as ProviderId,
  }),
  ...(row.last_finished_at != null && {
    completedAt: agentStampOf({ value: row.last_finished_at }),
    lastFinishedAt: agentStampOf({ value: row.last_finished_at }),
  }),
  ...(row.last_viewed_at != null && { lastViewedAt: agentStampOf({ value: row.last_viewed_at }) }),
  ...(row.done_at != null && { doneAt: agentStampOf({ value: row.done_at }) }),
  ...(row.stopped_at != null && { stoppedAt: agentStampOf({ value: row.stopped_at }) }),
  ...(isAgentStoppedBy(row.stopped_by) && { stoppedBy: row.stopped_by }),
  ...(row.deleted_at != null && { deletedAt: agentStampOf({ value: row.deleted_at }) }),
  ...(row.verbosity != null &&
    row.verbosity !== '' && { verbosity: row.verbosity as 'brief' | 'normal' | 'verbose' }),
  ...(row.effort != null && row.effort !== '' && { effort: row.effort as EffortLevel }),
  ...(row.model_override != null &&
    row.model_override !== '' && { modelOverride: row.model_override }),
  ...(row.provider_override != null &&
    row.provider_override !== '' && { providerOverride: row.provider_override as ProviderId }),
  ...(row.kind != null && row.kind !== '' && { kind: row.kind }),
  ...(row.source_thread_id != null && { sourceThreadId: row.source_thread_id }),
  ...(row.source_comment_url != null && { sourceCommentUrl: row.source_comment_url }),
  ...(row.source_kind != null && { sourceKind: row.source_kind as AgentSourceKind }),
  ...(row.mount_id != null && { mountId: mountIdOf({ value: row.mount_id }) }),
});

type ListSummariesParams = {
  readonly db: Database;
  readonly sessionIds: ReadonlyArray<SessionId>;
};

export const listAgentSummariesForSessions = async ({
  db,
  sessionIds,
}: ListSummariesParams): Promise<ReadonlyArray<AgentSummary>> => {
  if (sessionIds.length === 0) {
    return [];
  }
  const placeholders = sessionIds.map(() => '?').join(', ');
  const rows = await db.select<AgentSummaryRow>(
    `SELECT ${AGENT_SUMMARY_COLUMNS.join(', ')}
     FROM live_agents WHERE session_id IN (${placeholders}) ORDER BY session_id, ordinal ASC`,
    sessionIds,
  );
  return rows.map((row) => toAgentSummary({ row }));
};

type ListOutputSummariesParams = {
  readonly db: Database;
  readonly agentIds: ReadonlyArray<AgentId>;
};

export type AgentOutputSummary = Readonly<{
  agentId: AgentId;
  outputSummary: string;
}>;

export const listAgentOutputSummaries = async ({
  db,
  agentIds,
}: ListOutputSummariesParams): Promise<ReadonlyArray<AgentOutputSummary>> => {
  if (agentIds.length === 0) {
    return [];
  }
  const placeholders = agentIds.map(() => '?').join(', ');
  const rows = await db.select<{ readonly id: string; readonly output_summary: string }>(
    `SELECT id, output_summary FROM live_agents
     WHERE id IN (${placeholders}) AND output_summary IS NOT NULL AND output_summary <> ''`,
    agentIds,
  );
  return rows.map((row) => ({ agentId: row.id as AgentId, outputSummary: row.output_summary }));
};
