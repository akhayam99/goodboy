import type { WorkspaceId } from '@goodboy/types';
import type { Database } from '../client';

type ImpactQueryParams = {
  readonly workspaceId: WorkspaceId;
  readonly sinceMs: number | null;
};

export type OrchestrationOverview = {
  readonly sessionCount: number;
  readonly orchestratedSessions: number;
  readonly plannedSessions: number;
  readonly workflowSessions: number;
  readonly splitSessions: number;
  readonly resolverSessions: number;
};

export type PlanAdoption = {
  readonly sessionCount: number;
  readonly plannedSessions: number;
  readonly consumedPlans: number;
  readonly handoffPlans: number;
  readonly handoffSessions: number;
};

export type ContextHealth = {
  readonly sessionCount: number;
  readonly slotSessions: number;
  readonly userEdits: number;
  readonly summarizerEdits: number;
  readonly questionsTotal: number;
  readonly questionsAnswered: number;
  readonly questionsDismissed: number;
  readonly avgHoursToAnswer: number | null;
};

export type TurnBucket = {
  readonly turnCount: number;
  readonly agentCount: number;
};

export type ModelMixEntry = {
  readonly kind: 'turn' | 'summarizer';
  readonly provider: string;
  readonly model: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly costUsd: number;
};

export type NudgeOutcomeCount = {
  readonly outcome: string | null;
  readonly count: number;
};

type ExternalWorkEntry = {
  readonly provider: string;
  readonly linkedSessions: number;
  readonly startedFromSessions: number;
};

export type DelegationFlow = {
  readonly sessionCount: number;
  readonly workflowRuns: number;
  readonly workflowSessions: number;
  readonly discardedRuns: number;
  readonly scoutChildren: number;
  readonly clusterChildren: number;
  readonly completedGroups: number;
  readonly longAgents: number;
  readonly resolverAgents: number;
  readonly resolvedThreads: number;
  readonly diffCommentsTotal: number;
  readonly diffCommentsHandled: number;
  readonly linkedSessions: number;
  readonly startedFromSessions: number;
  readonly integrationCount: number;
  readonly external: ReadonlyArray<ExternalWorkEntry>;
};

const LONG_AGENT_TURNS = 12;

const toIso = (sinceMs: number | null): string | null =>
  sinceMs === null ? null : new Date(sinceMs).toISOString();

const readCount = (value: number | null | undefined): number => (value == null ? 0 : value);

type OverviewRow = {
  session_count: number;
  orchestrated_sessions: number;
  planned_sessions: number;
  workflow_sessions: number;
  split_sessions: number;
  resolver_sessions: number;
};

export const getOrchestrationOverview = async (
  db: Database,
  { workspaceId, sinceMs }: ImpactQueryParams,
): Promise<OrchestrationOverview> => {
  const sinceIso = toIso(sinceMs);
  const rows = await db.select<OverviewRow>(
    `SELECT
       COUNT(*) AS session_count,
       COALESCE(SUM(CASE WHEN planned > 0 THEN 1 ELSE 0 END), 0) AS planned_sessions,
       COALESCE(SUM(CASE WHEN workflow > 0 THEN 1 ELSE 0 END), 0) AS workflow_sessions,
       COALESCE(SUM(CASE WHEN split > 0 THEN 1 ELSE 0 END), 0) AS split_sessions,
       COALESCE(SUM(CASE WHEN resolver > 0 THEN 1 ELSE 0 END), 0) AS resolver_sessions,
       COALESCE(
         SUM(CASE WHEN planned > 0 OR workflow > 0 OR split > 0 OR resolver > 0 THEN 1 ELSE 0 END),
         0
       ) AS orchestrated_sessions
     FROM (
       SELECT
         (SELECT COUNT(*)
            FROM plan_consumptions pc
            JOIN session_plans sp ON sp.id = pc.plan_id
           WHERE sp.session_id = s.id
             AND (? IS NULL OR pc.consumed_at >= ?)) AS planned,
         (SELECT COUNT(*)
            FROM session_workflows sw
           WHERE sw.session_id = s.id
             AND sw.discarded_at IS NULL
             AND (? IS NULL OR julianday(sw.created_at) >= julianday(?))) AS workflow,
         (SELECT COUNT(*)
            FROM agents c
            JOIN agents p ON p.id = c.parent_agent_id AND p.deleted_at IS NULL
           WHERE c.session_id = s.id
             AND c.deleted_at IS NULL
             AND (? IS NULL OR julianday(c.started_at) >= julianday(?))) AS split,
         (SELECT COUNT(*)
            FROM agents r
           WHERE r.session_id = s.id
             AND r.kind = 'resolver'
             AND r.deleted_at IS NULL
             AND (? IS NULL OR julianday(r.started_at) >= julianday(?))) AS resolver
       FROM sessions s
        WHERE s.workspace_id = ?
          AND s.deleted_at IS NULL
          AND (? IS NULL OR s.updated_at >= ?)
     )`,
    [
      sinceMs,
      sinceMs,
      sinceIso,
      sinceIso,
      sinceIso,
      sinceIso,
      sinceIso,
      sinceIso,
      workspaceId,
      sinceMs,
      sinceMs,
    ],
  );
  const row = rows[0];
  return {
    sessionCount: readCount(row?.session_count),
    orchestratedSessions: readCount(row?.orchestrated_sessions),
    plannedSessions: readCount(row?.planned_sessions),
    workflowSessions: readCount(row?.workflow_sessions),
    splitSessions: readCount(row?.split_sessions),
    resolverSessions: readCount(row?.resolver_sessions),
  };
};

type PlanAdoptionRow = {
  session_count: number;
  planned_sessions: number;
  consumed_plans: number;
  handoff_plans: number;
  handoff_sessions: number;
};

export const getPlanAdoption = async (
  db: Database,
  { workspaceId, sinceMs }: ImpactQueryParams,
): Promise<PlanAdoption> => {
  const rows = await db.select<PlanAdoptionRow>(
    `SELECT
       (SELECT COUNT(*)
          FROM sessions s
         WHERE s.workspace_id = ?
           AND s.deleted_at IS NULL
           AND (? IS NULL OR s.updated_at >= ?)) AS session_count,
       COUNT(DISTINCT sp.session_id) AS planned_sessions,
       COUNT(DISTINCT pc.plan_id) AS consumed_plans,
       COUNT(DISTINCT CASE WHEN pc.agent_id <> sp.agent_id THEN pc.plan_id END) AS handoff_plans,
       COUNT(DISTINCT CASE WHEN pc.agent_id <> sp.agent_id THEN sp.session_id END) AS handoff_sessions
     FROM plan_consumptions pc
     JOIN session_plans sp ON sp.id = pc.plan_id
     JOIN sessions ps ON ps.id = sp.session_id
    WHERE ps.workspace_id = ?
      AND ps.deleted_at IS NULL
      AND (? IS NULL OR pc.consumed_at >= ?)`,
    [workspaceId, sinceMs, sinceMs, workspaceId, sinceMs, sinceMs],
  );
  const row = rows[0];
  return {
    sessionCount: readCount(row?.session_count),
    plannedSessions: readCount(row?.planned_sessions),
    consumedPlans: readCount(row?.consumed_plans),
    handoffPlans: readCount(row?.handoff_plans),
    handoffSessions: readCount(row?.handoff_sessions),
  };
};

type ContextHealthRow = {
  session_count: number;
  slot_sessions: number;
  user_edits: number;
  summarizer_edits: number;
  questions_total: number;
  questions_answered: number;
  questions_dismissed: number;
  avg_hours_to_answer: number | null;
};

export const getContextHealth = async (
  db: Database,
  { workspaceId, sinceMs }: ImpactQueryParams,
): Promise<ContextHealth> => {
  const rows = await db.select<ContextHealthRow>(
    `SELECT
       (SELECT COUNT(*)
          FROM sessions s
         WHERE s.workspace_id = ? AND s.deleted_at IS NULL
           AND (? IS NULL OR s.updated_at >= ?)) AS session_count,
       (SELECT COUNT(DISTINCT cs.session_id)
          FROM context_slots cs
          JOIN sessions s ON s.id = cs.session_id
         WHERE cs.enabled = 1 AND s.workspace_id = ? AND s.deleted_at IS NULL
           AND (? IS NULL OR s.updated_at >= ?)) AS slot_sessions,
       (SELECT COUNT(*)
          FROM context_slot_history h
          JOIN sessions s ON s.id = h.session_id
         WHERE h.author = 'user' AND s.workspace_id = ? AND s.deleted_at IS NULL
           AND (? IS NULL OR h.created_at >= ?)) AS user_edits,
       (SELECT COUNT(*)
          FROM context_slot_history h
          JOIN sessions s ON s.id = h.session_id
         WHERE h.author = 'summarizer' AND s.workspace_id = ? AND s.deleted_at IS NULL
           AND (? IS NULL OR h.created_at >= ?)) AS summarizer_edits,
       (SELECT COUNT(*)
          FROM open_questions q
          JOIN sessions s ON s.id = q.session_id
         WHERE s.workspace_id = ? AND s.deleted_at IS NULL
           AND (? IS NULL OR q.created_at >= ?)) AS questions_total,
       (SELECT COUNT(*)
          FROM open_questions q
          JOIN sessions s ON s.id = q.session_id
         WHERE q.status = 'answered' AND s.workspace_id = ? AND s.deleted_at IS NULL
           AND (? IS NULL OR q.created_at >= ?)) AS questions_answered,
       (SELECT COUNT(*)
          FROM open_questions q
          JOIN sessions s ON s.id = q.session_id
         WHERE q.status = 'dismissed' AND s.workspace_id = ? AND s.deleted_at IS NULL
           AND (? IS NULL OR q.created_at >= ?)) AS questions_dismissed,
       (SELECT AVG((q.answered_at - q.created_at) / 3600000.0)
          FROM open_questions q
          JOIN sessions s ON s.id = q.session_id
         WHERE q.answered_at IS NOT NULL AND s.workspace_id = ? AND s.deleted_at IS NULL
           AND (? IS NULL OR q.created_at >= ?)) AS avg_hours_to_answer`,
    [
      workspaceId,
      sinceMs,
      sinceMs,
      workspaceId,
      sinceMs,
      sinceMs,
      workspaceId,
      sinceMs,
      sinceMs,
      workspaceId,
      sinceMs,
      sinceMs,
      workspaceId,
      sinceMs,
      sinceMs,
      workspaceId,
      sinceMs,
      sinceMs,
      workspaceId,
      sinceMs,
      sinceMs,
      workspaceId,
      sinceMs,
      sinceMs,
    ],
  );
  const row = rows[0];
  return {
    sessionCount: readCount(row?.session_count),
    slotSessions: readCount(row?.slot_sessions),
    userEdits: readCount(row?.user_edits),
    summarizerEdits: readCount(row?.summarizer_edits),
    questionsTotal: readCount(row?.questions_total),
    questionsAnswered: readCount(row?.questions_answered),
    questionsDismissed: readCount(row?.questions_dismissed),
    avgHoursToAnswer: row?.avg_hours_to_answer ?? null,
  };
};

type TurnBucketRow = {
  turn_count: number;
  agent_count: number;
};

export const getTurnDistribution = async (
  db: Database,
  { workspaceId, sinceMs }: ImpactQueryParams,
): Promise<ReadonlyArray<TurnBucket>> => {
  const rows = await db.select<TurnBucketRow>(
    `SELECT turn_count AS turn_count, COUNT(*) AS agent_count
       FROM (
         SELECT a.id AS agent_id, COUNT(tr.id) AS turn_count
           FROM agents a
           JOIN sessions s ON s.id = a.session_id AND s.workspace_id = ? AND s.deleted_at IS NULL
           JOIN telemetry_records tr
             ON tr.run_id = a.provider_run_id
            AND tr.kind = 'turn'
            AND (? IS NULL OR tr.recorded_at >= ?)
          WHERE a.deleted_at IS NULL
          GROUP BY a.id
       )
      GROUP BY turn_count
      ORDER BY turn_count ASC`,
    [workspaceId, sinceMs, sinceMs],
  );
  return rows.map((row) => ({
    turnCount: readCount(row.turn_count),
    agentCount: readCount(row.agent_count),
  }));
};

type ModelMixRow = {
  kind: 'turn' | 'summarizer';
  provider: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
};

export const getModelMix = async (
  db: Database,
  { workspaceId, sinceMs }: ImpactQueryParams,
): Promise<ReadonlyArray<ModelMixEntry>> => {
  const rows = await db.select<ModelMixRow>(
    `SELECT tr.kind AS kind,
            tr.provider AS provider,
            tr.model AS model,
            COALESCE(SUM(tr.input_tokens), 0) AS input_tokens,
            COALESCE(SUM(tr.output_tokens), 0) AS output_tokens,
            COALESCE(SUM(tr.estimated_cost_usd), 0) AS cost_usd
       FROM telemetry_records tr
       JOIN provider_runs pr ON pr.id = tr.run_id
       JOIN sessions s ON s.id = pr.session_id
      WHERE s.workspace_id = ?
        AND s.deleted_at IS NULL
        AND (? IS NULL OR tr.recorded_at >= ?)
      GROUP BY tr.kind, tr.provider, tr.model`,
    [workspaceId, sinceMs, sinceMs],
  );
  return rows.map((row) => ({
    kind: row.kind,
    provider: row.provider,
    model: row.model,
    inputTokens: readCount(row.input_tokens),
    outputTokens: readCount(row.output_tokens),
    costUsd: row.cost_usd ?? 0,
  }));
};

type NudgeOutcomeRow = {
  outcome: string | null;
  outcome_count: number;
};

export const getRightSizeNudgeOutcomes = async (
  db: Database,
  { workspaceId, sinceMs }: ImpactQueryParams,
): Promise<ReadonlyArray<NudgeOutcomeCount>> => {
  const sinceIso = toIso(sinceMs);
  const rows = await db.select<NudgeOutcomeRow>(
    `SELECT n.outcome AS outcome, COUNT(*) AS outcome_count
       FROM nudge_events n
       JOIN sessions s ON s.id = json_extract(n.context_json, '$.sessionId')
      WHERE n.kind = 'model-rightsize'
        AND s.workspace_id = ?
        AND s.deleted_at IS NULL
        AND (? IS NULL OR julianday(n.ts) >= julianday(?))
      GROUP BY n.outcome`,
    [workspaceId, sinceIso, sinceIso],
  );
  return rows.map((row) => ({ outcome: row.outcome, count: readCount(row.outcome_count) }));
};

type DelegationRow = {
  session_count: number;
  workflow_runs: number;
  workflow_sessions: number;
  discarded_runs: number;
  scout_children: number;
  cluster_children: number;
  completed_groups: number;
  long_agents: number;
  resolver_agents: number;
  resolved_threads: number;
  diff_comments_total: number;
  diff_comments_handled: number;
  linked_sessions: number;
  started_from_sessions: number;
  integration_count: number;
};

type ExternalWorkRow = {
  provider: string;
  linked_sessions: number;
  started_from_sessions: number;
};

export const getDelegationFlow = async (
  db: Database,
  { workspaceId, sinceMs }: ImpactQueryParams,
): Promise<DelegationFlow> => {
  const sinceIso = toIso(sinceMs);
  const rows = await db.select<DelegationRow>(
    `SELECT
       (SELECT COUNT(*)
          FROM sessions s
         WHERE s.workspace_id = ? AND s.deleted_at IS NULL
           AND (? IS NULL OR s.updated_at >= ?)) AS session_count,
       (SELECT COUNT(*)
          FROM session_workflows sw
          JOIN sessions s ON s.id = sw.session_id
         WHERE s.workspace_id = ? AND s.deleted_at IS NULL
           AND (? IS NULL OR julianday(sw.created_at) >= julianday(?))) AS workflow_runs,
       (SELECT COUNT(DISTINCT sw.session_id)
          FROM session_workflows sw
          JOIN sessions s ON s.id = sw.session_id
         WHERE sw.discarded_at IS NULL AND s.workspace_id = ? AND s.deleted_at IS NULL
           AND (? IS NULL OR julianday(sw.created_at) >= julianday(?))) AS workflow_sessions,
       (SELECT COUNT(*)
          FROM session_workflows sw
          JOIN sessions s ON s.id = sw.session_id
         WHERE sw.discarded_at IS NOT NULL AND s.workspace_id = ? AND s.deleted_at IS NULL
           AND (? IS NULL OR julianday(sw.created_at) >= julianday(?))) AS discarded_runs,
       (SELECT COUNT(*)
          FROM agents c
          JOIN agents p ON p.id = c.parent_agent_id AND p.deleted_at IS NULL
          JOIN sessions s ON s.id = c.session_id
         WHERE c.deleted_at IS NULL AND p.kind = 'scout'
           AND s.workspace_id = ? AND s.deleted_at IS NULL
           AND (? IS NULL OR julianday(c.started_at) >= julianday(?))) AS scout_children,
       (SELECT COUNT(*)
          FROM agents c
          JOIN agents p ON p.id = c.parent_agent_id AND p.deleted_at IS NULL
          JOIN sessions s ON s.id = c.session_id
         WHERE c.deleted_at IS NULL AND (p.kind IS NULL OR p.kind <> 'scout')
           AND s.workspace_id = ? AND s.deleted_at IS NULL
           AND (? IS NULL OR julianday(c.started_at) >= julianday(?))) AS cluster_children,
       (SELECT COUNT(*)
          FROM parallel_groups g
          JOIN sessions s ON s.id = g.session_id
         WHERE g.completed_at IS NOT NULL AND s.workspace_id = ? AND s.deleted_at IS NULL
           AND (? IS NULL OR g.created_at >= ?)) AS completed_groups,
       (SELECT COUNT(*)
          FROM agents a
          JOIN sessions s ON s.id = a.session_id
         WHERE a.deleted_at IS NULL AND s.workspace_id = ? AND s.deleted_at IS NULL
           AND (? IS NULL OR julianday(a.started_at) >= julianday(?))
           AND (SELECT COUNT(*)
                  FROM telemetry_records tr
                 WHERE tr.run_id = a.provider_run_id AND tr.kind = 'turn') > ${LONG_AGENT_TURNS}) AS long_agents,
       (SELECT COUNT(*)
          FROM agents a
          JOIN sessions s ON s.id = a.session_id
         WHERE a.kind = 'resolver' AND a.deleted_at IS NULL
           AND s.workspace_id = ? AND s.deleted_at IS NULL
           AND (? IS NULL OR julianday(a.started_at) >= julianday(?))) AS resolver_agents,
       (SELECT COUNT(DISTINCT a.source_thread_id)
          FROM agents a
          JOIN sessions s ON s.id = a.session_id
         WHERE a.source_thread_id IS NOT NULL AND a.deleted_at IS NULL
           AND s.workspace_id = ? AND s.deleted_at IS NULL
           AND (? IS NULL OR julianday(a.started_at) >= julianday(?))) AS resolved_threads,
       (SELECT COUNT(*)
          FROM diff_comments d
          JOIN sessions s ON s.id = d.session_id
         WHERE d.status <> 'deleted' AND s.workspace_id = ? AND s.deleted_at IS NULL
           AND (? IS NULL OR d.created_at >= ?)) AS diff_comments_total,
       (SELECT COUNT(*)
          FROM diff_comments d
          JOIN sessions s ON s.id = d.session_id
         WHERE d.status IN ('resolved', 'consumed') AND s.workspace_id = ? AND s.deleted_at IS NULL
           AND (? IS NULL OR d.created_at >= ?)) AS diff_comments_handled,
       (SELECT COUNT(DISTINCT et.session_id)
          FROM session_external_tasks et
          JOIN sessions s ON s.id = et.session_id
         WHERE s.workspace_id = ? AND s.deleted_at IS NULL
           AND (? IS NULL OR et.created_at >= ?)) AS linked_sessions,
       (SELECT COUNT(DISTINCT et.session_id)
          FROM session_external_tasks et
          JOIN sessions s ON s.id = et.session_id
         WHERE et.created_at - s.created_at <= 60000
           AND s.workspace_id = ? AND s.deleted_at IS NULL
           AND (? IS NULL OR et.created_at >= ?)) AS started_from_sessions,
       (SELECT COUNT(*)
          FROM workspace_integrations wi
         WHERE wi.workspace_id = ?) AS integration_count`,
    [
      workspaceId,
      sinceMs,
      sinceMs,
      workspaceId,
      sinceIso,
      sinceIso,
      workspaceId,
      sinceIso,
      sinceIso,
      workspaceId,
      sinceIso,
      sinceIso,
      workspaceId,
      sinceIso,
      sinceIso,
      workspaceId,
      sinceIso,
      sinceIso,
      workspaceId,
      sinceMs,
      sinceMs,
      workspaceId,
      sinceIso,
      sinceIso,
      workspaceId,
      sinceIso,
      sinceIso,
      workspaceId,
      sinceIso,
      sinceIso,
      workspaceId,
      sinceMs,
      sinceMs,
      workspaceId,
      sinceMs,
      sinceMs,
      workspaceId,
      sinceMs,
      sinceMs,
      workspaceId,
      sinceMs,
      sinceMs,
      workspaceId,
    ],
  );
  const externalRows = await db.select<ExternalWorkRow>(
    `SELECT et.provider AS provider,
            COUNT(DISTINCT et.session_id) AS linked_sessions,
            COUNT(DISTINCT CASE WHEN et.created_at - s.created_at <= 60000 THEN et.session_id END)
              AS started_from_sessions
       FROM session_external_tasks et
       JOIN sessions s ON s.id = et.session_id
      WHERE s.workspace_id = ?
        AND s.deleted_at IS NULL
        AND (? IS NULL OR et.created_at >= ?)
      GROUP BY et.provider
      ORDER BY et.provider ASC`,
    [workspaceId, sinceMs, sinceMs],
  );
  const row = rows[0];
  return {
    sessionCount: readCount(row?.session_count),
    workflowRuns: readCount(row?.workflow_runs),
    workflowSessions: readCount(row?.workflow_sessions),
    discardedRuns: readCount(row?.discarded_runs),
    scoutChildren: readCount(row?.scout_children),
    clusterChildren: readCount(row?.cluster_children),
    completedGroups: readCount(row?.completed_groups),
    longAgents: readCount(row?.long_agents),
    resolverAgents: readCount(row?.resolver_agents),
    resolvedThreads: readCount(row?.resolved_threads),
    diffCommentsTotal: readCount(row?.diff_comments_total),
    diffCommentsHandled: readCount(row?.diff_comments_handled),
    linkedSessions: readCount(row?.linked_sessions),
    startedFromSessions: readCount(row?.started_from_sessions),
    integrationCount: readCount(row?.integration_count),
    external: externalRows.map((entry) => ({
      provider: entry.provider,
      linkedSessions: readCount(entry.linked_sessions),
      startedFromSessions: readCount(entry.started_from_sessions),
    })),
  };
};
