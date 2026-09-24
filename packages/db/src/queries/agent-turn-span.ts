import type {
  AgentId,
  AgentRole,
  AgentStatus,
  AgentTurnSpan,
  AgentTurnSpanEndReason,
  MeasuredTurnSpan,
  ProviderName,
  SessionId,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';
import type { Database } from '../client';

type InsertParams = {
  readonly db: Database;
  readonly span: AgentTurnSpan;
};

export const insertAgentTurnSpan = async ({ db, span }: InsertParams): Promise<void> => {
  await db.execute(
    `INSERT INTO agent_turn_spans
       (run_id, agent_id, session_id, workspace_id, workflow_run_id, step_role, provider, model, effort, started_at, ended_at, end_reason, cost_usd)
     SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
       (SELECT SUM(estimated_cost_usd) FROM telemetry_records WHERE run_id = ?)
     WHERE true
     ON CONFLICT (run_id) DO NOTHING`,
    [
      span.runId,
      span.agentId,
      span.sessionId,
      span.workspaceId,
      span.workflowRunId,
      span.stepRole,
      span.provider,
      span.model,
      span.effort,
      Date.parse(span.startedAt),
      Date.parse(span.endedAt),
      span.endReason,
      span.runId,
    ],
  );
};

type MeasuredSpanRow = {
  readonly agent_id: string;
  readonly parent_agent_id: string | null;
  readonly agent_status: AgentStatus | null;
  readonly workflow_run_id: string | null;
  readonly is_orchestrated_run_done: number;
  readonly step_role: AgentRole;
  readonly provider: ProviderName;
  readonly model: string;
  readonly effort: string | null;
  readonly started_at: number;
  readonly ended_at: number;
  readonly end_reason: AgentTurnSpanEndReason;
  readonly cost_usd: number | null;
};

const MEASURED_SPAN_SELECT = `SELECT s.agent_id, a.parent_agent_id, a.status AS agent_status, s.workflow_run_id,
       CASE WHEN w.execution_mode = 'dynamic' AND w.orchestration_outcome = 'done' THEN 1 ELSE 0 END
         AS is_orchestrated_run_done,
       s.step_role, s.provider, s.model, s.effort, s.started_at, s.ended_at, s.end_reason, s.cost_usd
     FROM agent_turn_spans s
     LEFT JOIN agents a ON a.id = s.agent_id
     LEFT JOIN session_workflows w ON w.workflow_run_id = s.workflow_run_id`;

type RowParams = {
  readonly row: MeasuredSpanRow;
};

const toMeasuredSpan = ({ row }: RowParams): MeasuredTurnSpan => ({
  agentId: row.agent_id as AgentId,
  parentAgentId: row.parent_agent_id == null ? null : (row.parent_agent_id as AgentId),
  agentStatus: row.agent_status,
  workflowRunId: row.workflow_run_id == null ? null : (row.workflow_run_id as WorkflowRunId),
  isOrchestratedRunDone: row.is_orchestrated_run_done === 1,
  stepRole: row.step_role,
  provider: row.provider,
  model: row.model,
  effort: row.effort,
  startedAtMs: row.started_at,
  endedAtMs: row.ended_at,
  endReason: row.end_reason,
  costUsd: row.cost_usd,
});

type WorkspaceListParams = {
  readonly db: Database;
  readonly workspaceId: WorkspaceId;
  readonly sinceMs: number;
};

export const listWorkspaceTurnSpans = async ({
  db,
  workspaceId,
  sinceMs,
}: WorkspaceListParams): Promise<ReadonlyArray<MeasuredTurnSpan>> => {
  const rows = await db.select<MeasuredSpanRow>(
    `${MEASURED_SPAN_SELECT}
     WHERE s.workspace_id = ? AND s.ended_at >= ? AND s.agent_id IS NOT NULL
     ORDER BY s.started_at`,
    [workspaceId, sinceMs],
  );
  return rows.map((row) => toMeasuredSpan({ row }));
};

type SessionListParams = {
  readonly db: Database;
  readonly sessionId: SessionId;
};

export const listSessionTurnSpans = async ({
  db,
  sessionId,
}: SessionListParams): Promise<ReadonlyArray<MeasuredTurnSpan>> => {
  const rows = await db.select<MeasuredSpanRow>(
    `${MEASURED_SPAN_SELECT}
     WHERE s.session_id = ? AND s.agent_id IS NOT NULL
     ORDER BY s.started_at`,
    [sessionId],
  );
  return rows.map((row) => toMeasuredSpan({ row }));
};
