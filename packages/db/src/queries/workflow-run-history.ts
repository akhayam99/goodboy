import {
  brandId,
  type AgentId,
  type IsoDateTime,
  type SessionId,
  type WorkflowExecutionMode,
  type WorkflowId,
  type WorkflowOrchestrationOutcome,
  type WorkflowRunId,
  type WorkspaceId,
} from '@goodboy/types';
import type { Database } from '../client';
import { AUTO_PHASES, type AutoPhase } from './auto-trees';
import { autoLiveUsdSql, autoRemainingUsdSql, autoSettledUsdSql } from './auto-reservations';

export type WorkflowRunLeadFacts = Readonly<{
  phase: AutoPhase;
  blockedReason: string | null;
  remainingUsd: number | null;
  isTurnLive: boolean;
  isAsking: boolean;
}>;

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
  readonly leadAgentId: AgentId | null;
  readonly lead: WorkflowRunLeadFacts | null;
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
  readonly lead_agent_id: string | null;
  readonly lead_phase: string | null;
  readonly lead_blocked_reason: string | null;
  readonly lead_remaining_usd: number | null;
  readonly lead_is_turn_live: number | null;
  readonly lead_is_asking: number | null;
};

type Params = {
  readonly db: Database;
  readonly workspaceId: WorkspaceId;
};

const SQL = `
WITH plan_runs AS (
  SELECT sw.workflow_run_id, sw.workflow_id, sw.session_id, sw.execution_mode,
         sw.orchestration_outcome, sw.created_at, s.goal, s.archived_at, NULL AS lead_agent_id,
         NULL AS lead_phase, NULL AS lead_blocked_reason, NULL AS lead_remaining_usd,
         NULL AS lead_spend_usd, NULL AS lead_is_turn_live, NULL AS lead_is_asking
    FROM session_workflows sw
    JOIN sessions s ON s.id = sw.session_id
   WHERE s.workspace_id = ? AND s.deleted_at IS NULL AND sw.discarded_at IS NULL
),
lead_routes AS (
  SELECT auto_trees.id AS tree_id, auto_trees.root_agent_id, auto_trees.session_id,
         auto_trees.created_at, auto_trees.phase, auto_trees.blocked_reason, s.goal,
         s.archived_at, route.value AS route, root.status AS root_status,
         IIF(auto_trees.cap_usd IS NULL, NULL, ${autoRemainingUsdSql({ treeRef: 'auto_trees.id' })})
           AS remaining_usd,
         ${autoSettledUsdSql({ treeRef: 'auto_trees.id' })}
           + ${autoLiveUsdSql({ treeRef: 'auto_trees.id' })} AS spend_usd,
         EXISTS (SELECT 1 FROM auto_delegations d
                  WHERE d.tree_id = auto_trees.id AND d.is_stopping = 0
                    AND d.state IN ('paused', 'awaiting_confirm')) AS is_asking
    FROM auto_trees
    JOIN sessions s ON s.id = auto_trees.session_id
    JOIN live_agents root ON root.id = auto_trees.root_agent_id
    JOIN settings stored ON stored.key = 'runs.routes.' || auto_trees.session_id
    JOIN json_each(IIF(json_valid(stored.value), stored.value, '{}')) route
      ON route.key = auto_trees.root_agent_id
   WHERE s.workspace_id = ? AND s.deleted_at IS NULL
     AND route.type = 'object' AND json_extract(route.value, '$.shape') = 'lead'
),
lead_runs AS (
  SELECT lr.tree_id AS workflow_run_id,
         CASE WHEN json_extract(lr.route, '$.workflowId') IS NOT NULL
              THEN (SELECT w.id FROM workflows w
                     WHERE w.id = json_extract(lr.route, '$.workflowId') AND w.workspace_id = ?)
              ELSE (SELECT w.id FROM workflows w
                     WHERE w.workspace_id = ? AND w.deleted_at IS NULL AND w.is_preset = 1
                       AND w.name = json_extract(lr.route, '$.presetName'))
         END AS workflow_id,
         lr.session_id, 'dynamic' AS execution_mode,
         NULL AS orchestration_outcome,
         lr.created_at, lr.goal, lr.archived_at, lr.root_agent_id AS lead_agent_id,
         lr.phase AS lead_phase, lr.blocked_reason AS lead_blocked_reason,
         lr.remaining_usd AS lead_remaining_usd, lr.spend_usd AS lead_spend_usd,
         IIF(lr.root_status IN ('running', 'starting'), 1, 0) AS lead_is_turn_live,
         lr.is_asking AS lead_is_asking
    FROM lead_routes lr
),
runs AS (
  SELECT * FROM plan_runs
  UNION ALL
  SELECT * FROM lead_runs WHERE workflow_id IS NOT NULL
),
lead_agents AS (
  SELECT workflow_run_id, lead_agent_id AS agent_id FROM runs WHERE lead_agent_id IS NOT NULL
  UNION
  SELECT d.tree_id AS workflow_run_id, d.child_agent_id AS agent_id
    FROM auto_delegations d
   WHERE d.child_agent_id IS NOT NULL
     AND d.tree_id IN (SELECT workflow_run_id FROM runs WHERE lead_agent_id IS NOT NULL)
),
run_agents AS (
  SELECT a.workflow_run_id, a.id AS agent_id
    FROM live_agents a
   WHERE a.parent_agent_id IS NULL
     AND a.workflow_run_id IN (SELECT workflow_run_id FROM plan_runs)
  UNION ALL
  SELECT workflow_run_id, agent_id FROM lead_agents
),
steps_of AS (
  SELECT st.workflow_id, COUNT(*) AS step_count
    FROM steps st
   WHERE st.deleted_at IS NULL AND st.workflow_id IN (SELECT workflow_id FROM runs)
   GROUP BY st.workflow_id
),
agents_of AS (
  SELECT ra.workflow_run_id,
         SUM(CASE WHEN a.status <> 'pending' THEN 1 ELSE 0 END) AS started_steps,
         SUM(CASE WHEN a.status IN ('completed', 'skipped') THEN 1 ELSE 0 END) AS finished_steps,
         SUM(CASE WHEN a.status = 'running' THEN 1 ELSE 0 END) AS running_steps,
         SUM(CASE WHEN a.status IN ('failed', 'blocked') THEN 1 ELSE 0 END) AS failed_steps,
         SUM(CASE WHEN a.status = 'stopped' THEN 1 ELSE 0 END) AS stopped_steps
    FROM run_agents ra
    JOIN live_agents a ON a.id = ra.agent_id
   GROUP BY ra.workflow_run_id
),
run_ids AS (
  SELECT workflow_run_id, run_id FROM agent_turn_spans
   WHERE workflow_run_id IN (SELECT workflow_run_id FROM plan_runs)
  UNION
  SELECT workflow_run_id, provider_run_id AS run_id FROM live_agents
   WHERE provider_run_id IS NOT NULL
     AND workflow_run_id IN (SELECT workflow_run_id FROM plan_runs)
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
       IIF(runs.lead_agent_id IS NULL, cost_of.cost_usd, runs.lead_spend_usd) AS cost_usd,
       runs.lead_agent_id, runs.lead_phase, runs.lead_blocked_reason, runs.lead_remaining_usd,
       runs.lead_is_turn_live, runs.lead_is_asking
  FROM runs
  LEFT JOIN steps_of ON steps_of.workflow_id = runs.workflow_id
  LEFT JOIN agents_of ON agents_of.workflow_run_id = runs.workflow_run_id
  LEFT JOIN cost_of ON cost_of.workflow_run_id = runs.workflow_run_id
 ORDER BY runs.created_at DESC, runs.workflow_run_id DESC
`;

type LeadFactsParams = {
  readonly row: Row;
};

const leadFactsOf = ({ row }: LeadFactsParams): WorkflowRunLeadFacts | null => {
  if (row.lead_agent_id === null || row.lead_phase === null) {
    return null;
  }
  return {
    phase: AUTO_PHASES.find((phase) => phase === row.lead_phase) ?? 'blocked',
    blockedReason: row.lead_blocked_reason,
    remainingUsd: row.lead_remaining_usd,
    isTurnLive: row.lead_is_turn_live === 1,
    isAsking: row.lead_is_asking === 1,
  };
};

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
  leadAgentId: row.lead_agent_id === null ? null : brandId<AgentId>({ value: row.lead_agent_id }),
  lead: leadFactsOf({ row }),
});

export const listWorkspaceWorkflowRuns = async ({
  db,
  workspaceId,
}: Params): Promise<ReadonlyArray<WorkflowRunHistoryRow>> => {
  const rows = await db.select<Row>(SQL, [workspaceId, workspaceId, workspaceId, workspaceId]);
  return rows.map(toHistoryRow);
};
