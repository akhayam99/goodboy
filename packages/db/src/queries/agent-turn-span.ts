import type { AgentTurnSpan } from '@goodboy/types';
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
