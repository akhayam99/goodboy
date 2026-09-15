import type {
  AgentId,
  ImplementationCluster,
  IsoDateTime,
  Plan,
  PlanArtifact,
  PlanConsumption,
  PlanConsumptionId,
  PlanId,
  PlanLastConsumer,
  PlanStatus,
  PlanWithCount,
  SessionArtifact,
  SessionId,
  WorkflowRunId,
} from '@goodboy/types';
import type { Database } from '../client';
import {
  getArtifact,
  insertArtifact,
  listArtifactsForSession,
  removeArtifact,
  setArtifactStatus,
  updateArtifactSource,
} from './artifact';

const PLAN_SCHEMA_VERSION = 1;

const isPlanArtifact = (artifact: SessionArtifact): artifact is PlanArtifact =>
  artifact.kind === 'plan';

const toDomain = (artifact: PlanArtifact): Plan => {
  const clusters = artifact.metadata.clusters;
  return {
    id: artifact.id as PlanId,
    sessionId: artifact.sessionId,
    agentId: artifact.agentId,
    ...(artifact.workflowRunId != null && { workflowRunId: artifact.workflowRunId }),
    title: artifact.title,
    bodyMd: artifact.sourceText,
    status: artifact.status,
    ...(clusters && clusters.length > 0 && { clusters }),
    createdAt: artifact.createdAt,
    updatedAt: artifact.updatedAt,
  };
};

const loadPlan = async (db: Database, id: PlanId): Promise<PlanArtifact | null> => {
  const artifact = await getArtifact({ db, artifactId: id });
  if (artifact === null || !isPlanArtifact(artifact)) {
    return null;
  }
  return artifact;
};

type PlanConsumptionSummaryRow = {
  plan_id: string;
  consumption_count: number;
  last_consumer_agent_id: string | null;
  last_consumer_agent_name: string | null;
};

const LAST_CONSUMPTION = `FROM plan_consumptions lc
             LEFT JOIN agents la ON la.id = lc.agent_id
             WHERE lc.plan_id = c.plan_id
             ORDER BY lc.consumed_at DESC, lc.id DESC
             LIMIT 1`;

const toLastConsumer = (row: PlanConsumptionSummaryRow | undefined): PlanLastConsumer | null => {
  if (row === undefined || row.last_consumer_agent_id === null) {
    return null;
  }
  return {
    agentId: row.last_consumer_agent_id as AgentId,
    name: row.last_consumer_agent_name,
  };
};

export const listPlansForSession = async (
  db: Database,
  sessionId: SessionId,
): Promise<ReadonlyArray<PlanWithCount>> => {
  const artifacts = await listArtifactsForSession({ db, sessionId });
  const summaries = await db.select<PlanConsumptionSummaryRow>(
    `SELECT c.plan_id AS plan_id, COUNT(c.id) AS consumption_count,
            (SELECT lc.agent_id ${LAST_CONSUMPTION}) AS last_consumer_agent_id,
            (SELECT la.name ${LAST_CONSUMPTION}) AS last_consumer_agent_name
     FROM plan_consumptions c
     JOIN session_artifacts a ON a.id = c.plan_id
     WHERE a.session_id = ?
     GROUP BY c.plan_id`,
    [sessionId],
  );
  const summaryById = new Map(summaries.map((row) => [row.plan_id, row]));
  return artifacts.filter(isPlanArtifact).map((artifact) => {
    const summary = summaryById.get(artifact.id);
    return {
      ...toDomain(artifact),
      consumptionCount: summary?.consumption_count ?? 0,
      lastConsumer: toLastConsumer(summary),
    };
  });
};

export type UpsertPlanInput = {
  readonly id: PlanId;
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly workflowRunId?: WorkflowRunId;
  readonly title: string;
  readonly bodyMd: string;
  readonly clusters?: ReadonlyArray<ImplementationCluster>;
};

const activePlanIdInScope = async (
  db: Database,
  input: UpsertPlanInput,
): Promise<string | undefined> => {
  const rows = input.workflowRunId
    ? await db.select<{ id: string }>(
        `SELECT id FROM session_artifacts
         WHERE kind = 'plan' AND session_id = ? AND workflow_run_id = ? AND status = 'active'
         ORDER BY created_at DESC LIMIT 1`,
        [input.sessionId, input.workflowRunId],
      )
    : await db.select<{ id: string }>(
        `SELECT id FROM session_artifacts
         WHERE kind = 'plan' AND session_id = ? AND workflow_run_id IS NULL AND status = 'active'
         ORDER BY created_at DESC LIMIT 1`,
        [input.sessionId],
      );
  return rows[0]?.id;
};

export const upsertPlan = async (db: Database, input: UpsertPlanInput): Promise<Plan> => {
  const metadata = input.clusters && input.clusters.length > 0 ? { clusters: input.clusters } : {};
  const activeId = await activePlanIdInScope(db, input);
  if (activeId) {
    const updated = await updateArtifactSource({
      db,
      input: {
        id: activeId as PlanId,
        title: input.title,
        sourceFormat: 'markdown',
        sourceText: input.bodyMd,
        metadata,
      },
    });
    if (!isPlanArtifact(updated)) {
      throw new Error(`plan update failed: ${activeId}`);
    }
    return toDomain(updated);
  }
  const created = await insertArtifact({
    db,
    input: {
      id: input.id,
      sessionId: input.sessionId,
      agentId: input.agentId,
      workflowRunId: input.workflowRunId ?? null,
      kind: 'plan',
      schemaVersion: PLAN_SCHEMA_VERSION,
      title: input.title,
      sourceFormat: 'markdown',
      sourceText: input.bodyMd,
      metadata,
      status: 'active',
    },
  });
  if (!isPlanArtifact(created)) {
    throw new Error(`plan insert failed: ${input.id}`);
  }
  return toDomain(created);
};

export const updatePlanStatus = async (
  db: Database,
  id: PlanId,
  status: PlanStatus,
): Promise<void> => {
  await setArtifactStatus({ db, artifactId: id, status });
};

export const updatePlanBody = async (
  db: Database,
  id: PlanId,
  title: string,
  bodyMd: string,
): Promise<void> => {
  const existing = await loadPlan(db, id);
  if (existing === null) {
    return;
  }
  await updateArtifactSource({
    db,
    input: {
      id,
      title,
      sourceFormat: 'markdown',
      sourceText: bodyMd,
      metadata: existing.metadata,
    },
  });
};

export const deletePlan = async (db: Database, id: PlanId): Promise<void> => {
  await removeArtifact({ db, artifactId: id });
};

type PlanConsumptionRow = {
  id: string;
  plan_id: string;
  agent_id: string;
  agent_name: string | null;
  step_name: string | null;
  workflow_name: string | null;
  workflow_run_ordinal: number | null;
  consumed_at: number;
};

function toConsumption(row: PlanConsumptionRow): PlanConsumption {
  return {
    id: row.id as PlanConsumptionId,
    planId: row.plan_id as PlanId,
    agentId: row.agent_id as AgentId,
    agentName: row.agent_name,
    stepName: row.step_name,
    workflowName: row.workflow_name,
    workflowRunOrdinal: row.workflow_run_ordinal,
    consumedAt: new Date(row.consumed_at).toISOString() as IsoDateTime,
  };
}

export type AddPlanConsumptionInput = {
  readonly id: PlanConsumptionId;
  readonly planId: PlanId;
  readonly agentId: AgentId;
};

export const addPlanConsumption = async (
  db: Database,
  input: AddPlanConsumptionInput,
): Promise<PlanConsumption> => {
  const now = Date.now();
  await db.execute(
    `INSERT INTO plan_consumptions (id, plan_id, agent_id, consumed_at) VALUES (?, ?, ?, ?)`,
    [input.id, input.planId, input.agentId, now],
  );
  await db.execute(
    `UPDATE session_artifacts SET status = 'consumed', updated_at = ? WHERE id = ? AND kind = 'plan'`,
    [now, input.planId],
  );
  const rows = await db.select<{ name: string | null }>(`SELECT name FROM agents WHERE id = ?`, [
    input.agentId,
  ]);
  return {
    id: input.id,
    planId: input.planId,
    agentId: input.agentId as AgentId,
    agentName: rows[0]?.name ?? null,
    stepName: null,
    workflowName: null,
    workflowRunOrdinal: null,
    consumedAt: new Date(now).toISOString() as IsoDateTime,
  };
};

export const listConsumptionsForPlan = async (
  db: Database,
  planId: PlanId,
): Promise<ReadonlyArray<PlanConsumption>> => {
  const rows = await db.select<PlanConsumptionRow>(
    `SELECT c.id, c.plan_id, c.agent_id, c.consumed_at, a.name AS agent_name,
            s.name AS step_name, w.name AS workflow_name, sw.ordinal AS workflow_run_ordinal
     FROM plan_consumptions c
     LEFT JOIN agents a ON a.id = c.agent_id
     LEFT JOIN steps s ON s.id = a.step_id
     LEFT JOIN workflows w ON w.id = s.workflow_id
     LEFT JOIN session_workflows sw ON sw.workflow_run_id = a.workflow_run_id
     WHERE c.plan_id = ?
     ORDER BY c.consumed_at DESC, c.id DESC`,
    [planId],
  );
  return rows.map(toConsumption);
};
