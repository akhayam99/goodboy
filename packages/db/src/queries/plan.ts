import type {
  AgentId,
  ImplementationCluster,
  IsoDateTime,
  Plan,
  PlanConsumption,
  PlanConsumptionId,
  PlanId,
  PlanStatus,
  PlanWithCount,
  SessionId,
  WorkflowRunId,
} from '@goodboy/types';
import type { Database } from '../client';

interface PlanRow {
  id: string;
  session_id: string;
  agent_id: string;
  workflow_run_id: string | null;
  title: string;
  body_md: string;
  status: string;
  clusters_json: string | null;
  created_at: number;
  updated_at: number;
}

interface PlanWithCountRow extends PlanRow {
  consumption_count: number;
}

function parseClusters(raw: string | null): ReadonlyArray<ImplementationCluster> | undefined {
  if (!raw) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return undefined;
    const out = parsed.filter(
      (c): c is ImplementationCluster =>
        typeof c === 'object' &&
        c !== null &&
        typeof (c as { title?: unknown }).title === 'string' &&
        typeof (c as { instructions?: unknown }).instructions === 'string',
    );
    return out.length > 0 ? out : undefined;
  } catch {
    return undefined;
  }
}

function serializeClusters(clusters?: ReadonlyArray<ImplementationCluster>): string | null {
  return clusters && clusters.length > 0 ? JSON.stringify(clusters) : null;
}

function toDomain(row: PlanRow): Plan {
  const clusters = parseClusters(row.clusters_json);
  return {
    id: row.id as PlanId,
    sessionId: row.session_id as SessionId,
    agentId: row.agent_id as AgentId,
    ...(row.workflow_run_id != null && { workflowRunId: row.workflow_run_id as WorkflowRunId }),
    title: row.title,
    bodyMd: row.body_md,
    status: row.status as PlanStatus,
    ...(clusters && { clusters }),
    createdAt: new Date(row.created_at).toISOString() as IsoDateTime,
    updatedAt: new Date(row.updated_at).toISOString() as IsoDateTime,
  };
}

function toDomainWithCount(row: PlanWithCountRow): PlanWithCount {
  return { ...toDomain(row), consumptionCount: row.consumption_count };
}

export async function listPlansForSession(
  db: Database,
  sessionId: SessionId,
): Promise<ReadonlyArray<PlanWithCount>> {
  const rows = await db.select<PlanWithCountRow>(
    `SELECT p.id, p.session_id, p.agent_id, p.workflow_run_id, p.title, p.body_md, p.status,
            p.clusters_json, p.created_at, p.updated_at,
            COUNT(c.id) AS consumption_count
     FROM session_plans p
     LEFT JOIN plan_consumptions c ON c.plan_id = p.id
     WHERE p.session_id = ?
     GROUP BY p.id
     ORDER BY p.created_at ASC`,
    [sessionId],
  );
  return rows.map(toDomainWithCount);
}

export interface UpsertPlanInput {
  readonly id: PlanId;
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly workflowRunId?: WorkflowRunId;
  readonly title: string;
  readonly bodyMd: string;
  readonly clusters?: ReadonlyArray<ImplementationCluster>;
}

const PLAN_SELECT = `SELECT id, session_id, agent_id, workflow_run_id, title, body_md, status, clusters_json, created_at, updated_at FROM session_plans`;

export async function upsertPlan(db: Database, input: UpsertPlanInput): Promise<Plan> {
  const now = Date.now();
  const clustersJson = serializeClusters(input.clusters);
  const existing = input.workflowRunId
    ? await db.select<{ id: string }>(
        `SELECT id FROM session_plans
         WHERE session_id = ? AND workflow_run_id = ? AND status = 'active'
         ORDER BY created_at DESC LIMIT 1`,
        [input.sessionId, input.workflowRunId],
      )
    : await db.select<{ id: string }>(
        `SELECT id FROM session_plans
         WHERE session_id = ? AND workflow_run_id IS NULL AND status = 'active'
         ORDER BY created_at DESC LIMIT 1`,
        [input.sessionId],
      );
  const activeId = existing[0]?.id;
  if (activeId) {
    await db.execute(
      `UPDATE session_plans SET title = ?, body_md = ?, clusters_json = ?, updated_at = ? WHERE id = ?`,
      [input.title, input.bodyMd, clustersJson, now, activeId],
    );
    const rows = await db.select<PlanRow>(`${PLAN_SELECT} WHERE id = ?`, [activeId]);
    const row = rows[0];
    if (!row) throw new Error(`plan update failed: ${activeId}`);
    return toDomain(row);
  }
  await db.execute(
    `INSERT INTO session_plans (id, session_id, agent_id, workflow_run_id, title, body_md, status, clusters_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
    [
      input.id,
      input.sessionId,
      input.agentId,
      input.workflowRunId ?? null,
      input.title,
      input.bodyMd,
      clustersJson,
      now,
      now,
    ],
  );
  const rows = await db.select<PlanRow>(`${PLAN_SELECT} WHERE id = ?`, [input.id]);
  const row = rows[0];
  if (!row) throw new Error(`plan insert failed: ${input.id}`);
  return toDomain(row);
}

export async function updatePlanStatus(
  db: Database,
  id: PlanId,
  status: PlanStatus,
): Promise<void> {
  await db.execute(`UPDATE session_plans SET status = ?, updated_at = ? WHERE id = ?`, [
    status,
    Date.now(),
    id,
  ]);
}

export async function updatePlanBody(
  db: Database,
  id: PlanId,
  title: string,
  bodyMd: string,
): Promise<void> {
  await db.execute(`UPDATE session_plans SET title = ?, body_md = ?, updated_at = ? WHERE id = ?`, [
    title,
    bodyMd,
    Date.now(),
    id,
  ]);
}

export async function deletePlan(db: Database, id: PlanId): Promise<void> {
  await db.execute(`DELETE FROM session_plans WHERE id = ?`, [id]);
}

interface PlanConsumptionRow {
  id: string;
  plan_id: string;
  agent_id: string;
  agent_name: string | null;
  consumed_at: number;
}

function toConsumption(row: PlanConsumptionRow): PlanConsumption {
  return {
    id: row.id as PlanConsumptionId,
    planId: row.plan_id as PlanId,
    agentId: row.agent_id as AgentId,
    agentName: row.agent_name,
    consumedAt: new Date(row.consumed_at).toISOString() as IsoDateTime,
  };
}

export interface AddPlanConsumptionInput {
  readonly id: PlanConsumptionId;
  readonly planId: PlanId;
  readonly agentId: AgentId;
}

export async function addPlanConsumption(
  db: Database,
  input: AddPlanConsumptionInput,
): Promise<PlanConsumption> {
  const now = Date.now();
  await db.execute(
    `INSERT INTO plan_consumptions (id, plan_id, agent_id, consumed_at) VALUES (?, ?, ?, ?)`,
    [input.id, input.planId, input.agentId, now],
  );
  await db.execute(`UPDATE session_plans SET status = 'consumed', updated_at = ? WHERE id = ?`, [
    now,
    input.planId,
  ]);
  const rows = await db.select<{ name: string | null }>(`SELECT name FROM agents WHERE id = ?`, [
    input.agentId,
  ]);
  return {
    id: input.id,
    planId: input.planId,
    agentId: input.agentId as AgentId,
    agentName: rows[0]?.name ?? null,
    consumedAt: new Date(now).toISOString() as IsoDateTime,
  };
}

export async function listConsumptionsForPlan(
  db: Database,
  planId: PlanId,
): Promise<ReadonlyArray<PlanConsumption>> {
  const rows = await db.select<PlanConsumptionRow>(
    `SELECT c.id, c.plan_id, c.agent_id, c.consumed_at, a.name AS agent_name
     FROM plan_consumptions c
     LEFT JOIN agents a ON a.id = c.agent_id
     WHERE c.plan_id = ?
     ORDER BY c.consumed_at DESC`,
    [planId],
  );
  return rows.map(toConsumption);
}
