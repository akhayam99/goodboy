import {
  brandId,
  type IsoDateTime,
  type SessionId,
  type WorkflowExecutionMode,
  type WorkflowId,
  type WorkflowOrchestrationOutcome,
  type WorkflowRunId,
  type WorkspaceId,
} from '@goodboy/types';
import type { Database } from '../client';

export type WorkflowRunHistoryRow = {
  readonly workflowRunId: WorkflowRunId;
  readonly workflowId: WorkflowId;
  readonly sessionId: SessionId;
  readonly sessionGoal: string;
  readonly isSessionArchived: boolean;
  readonly executionMode: WorkflowExecutionMode;
  readonly orchestrationOutcome: WorkflowOrchestrationOutcome | null;
  readonly createdAt: IsoDateTime;
  readonly stepCount: number;
  readonly startedSteps: number;
  readonly finishedSteps: number;
  readonly runningSteps: number;
  readonly failedSteps: number;
  readonly stoppedSteps: number;
  readonly costUsd: number;
};

type Row = {
  readonly workflow_run_id: string;
  readonly workflow_id: string;
  readonly session_id: string;
  readonly goal: string | null;
  readonly archived_at: number | null;
  readonly execution_mode: string;
  readonly orchestration_outcome: string | null;
  readonly created_at: number;
  readonly step_count: number;
  readonly started_steps: number;
  readonly finished_steps: number;
  readonly running_steps: number;
  readonly failed_steps: number;
  readonly stopped_steps: number;
  readonly cost_usd: number | null;
};

type Params = {
  readonly db: Database;
  readonly workspaceId: WorkspaceId;
};

const SQL = `
WITH runs AS (
  SELECT sw.workflow_run_id, sw.workflow_id, sw.session_id, sw.execution_mode,
         sw.orchestration_outcome, sw.created_at, s.goal, s.archived_at
    FROM session_workflows sw
    JOIN sessions s ON s.id = sw.session_id
   WHERE s.workspace_id = ? AND s.deleted_at IS NULL AND sw.discarded_at IS NULL
),
steps_of AS (
  SELECT st.workflow_id, COUNT(*) AS step_count
    FROM steps st
   WHERE st.deleted_at IS NULL AND st.workflow_id IN (SELECT workflow_id FROM runs)
   GROUP BY st.workflow_id
),
agents_of AS (
  SELECT a.workflow_run_id,
         SUM(CASE WHEN a.status <> 'pending' THEN 1 ELSE 0 END) AS started_steps,
         SUM(CASE WHEN a.status IN ('completed', 'skipped') THEN 1 ELSE 0 END) AS finished_steps,
         SUM(CASE WHEN a.status = 'running' THEN 1 ELSE 0 END) AS running_steps,
         SUM(CASE WHEN a.status IN ('failed', 'blocked') THEN 1 ELSE 0 END) AS failed_steps,
         SUM(CASE WHEN a.status = 'stopped' THEN 1 ELSE 0 END) AS stopped_steps
    FROM live_agents a
   WHERE a.parent_agent_id IS NULL
     AND a.workflow_run_id IN (SELECT workflow_run_id FROM runs)
   GROUP BY a.workflow_run_id
),
run_ids AS (
  SELECT workflow_run_id, run_id FROM agent_turn_spans
   WHERE workflow_run_id IN (SELECT workflow_run_id FROM runs)
  UNION
  SELECT workflow_run_id, provider_run_id AS run_id FROM live_agents
   WHERE provider_run_id IS NOT NULL
     AND workflow_run_id IN (SELECT workflow_run_id FROM runs)
),
cost_of AS (
  SELECT r.workflow_run_id, SUM(t.estimated_cost_usd) AS cost_usd
    FROM run_ids r
    JOIN telemetry_records t ON t.run_id = r.run_id AND t.kind <> 'summarizer'
   GROUP BY r.workflow_run_id
)
SELECT runs.workflow_run_id, runs.workflow_id, runs.session_id, runs.goal, runs.archived_at,
       runs.execution_mode, runs.orchestration_outcome, runs.created_at,
       COALESCE(steps_of.step_count, 0) AS step_count,
       COALESCE(agents_of.started_steps, 0) AS started_steps,
       COALESCE(agents_of.finished_steps, 0) AS finished_steps,
       COALESCE(agents_of.running_steps, 0) AS running_steps,
       COALESCE(agents_of.failed_steps, 0) AS failed_steps,
       COALESCE(agents_of.stopped_steps, 0) AS stopped_steps,
       cost_of.cost_usd
  FROM runs
  LEFT JOIN steps_of ON steps_of.workflow_id = runs.workflow_id
  LEFT JOIN agents_of ON agents_of.workflow_run_id = runs.workflow_run_id
  LEFT JOIN cost_of ON cost_of.workflow_run_id = runs.workflow_run_id
 ORDER BY runs.created_at DESC, runs.workflow_run_id DESC
`;

const toHistoryRow = (row: Row): WorkflowRunHistoryRow => ({
  workflowRunId: brandId<WorkflowRunId>({ value: row.workflow_run_id }),
  workflowId: brandId<WorkflowId>({ value: row.workflow_id }),
  sessionId: brandId<SessionId>({ value: row.session_id }),
  sessionGoal: row.goal ?? '',
  isSessionArchived: row.archived_at !== null,
  executionMode: row.execution_mode === 'dynamic' ? 'dynamic' : 'static',
  orchestrationOutcome:
    row.orchestration_outcome === 'done' || row.orchestration_outcome === 'blocked'
      ? row.orchestration_outcome
      : null,
  createdAt: brandId<IsoDateTime>({ value: new Date(row.created_at).toISOString() }),
  stepCount: row.step_count,
  startedSteps: row.started_steps,
  finishedSteps: row.finished_steps,
  runningSteps: row.running_steps,
  failedSteps: row.failed_steps,
  stoppedSteps: row.stopped_steps,
  costUsd: row.cost_usd ?? 0,
});

export const listWorkspaceWorkflowRuns = async ({
  db,
  workspaceId,
}: Params): Promise<ReadonlyArray<WorkflowRunHistoryRow>> => {
  const rows = await db.select<Row>(SQL, [workspaceId]);
  return rows.map(toHistoryRow);
};
