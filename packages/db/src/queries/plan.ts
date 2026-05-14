import type { IsoDateTime, Plan, PlanId, PlanStatus, SessionId, TaskId } from '@kay-am/types';
import type { Database } from '../client';

interface PlanRow {
  id: string;
  session_id: string;
  agent_id: string;
  title: string;
  body_md: string;
  status: string;
  created_at: number;
  updated_at: number;
}

function toDomain(row: PlanRow): Plan {
  return {
    id: row.id as PlanId,
    sessionId: row.session_id as TaskId,
    agentId: row.agent_id as SessionId,
    title: row.title,
    bodyMd: row.body_md,
    status: row.status as PlanStatus,
    createdAt: new Date(row.created_at).toISOString() as IsoDateTime,
    updatedAt: new Date(row.updated_at).toISOString() as IsoDateTime,
  };
}

export async function listPlansForSession(
  db: Database,
  sessionId: TaskId,
): Promise<ReadonlyArray<Plan>> {
  const rows = await db.select<PlanRow>(
    `SELECT id, session_id, agent_id, title, body_md, status, created_at, updated_at
     FROM session_plans
     WHERE session_id = ?
     ORDER BY updated_at DESC`,
    [sessionId],
  );
  return rows.map(toDomain);
}

export interface UpsertPlanInput {
  readonly id: PlanId;
  readonly sessionId: TaskId;
  readonly agentId: SessionId;
  readonly title: string;
  readonly bodyMd: string;
  readonly status: PlanStatus;
}

export async function upsertPlan(db: Database, input: UpsertPlanInput): Promise<Plan> {
  const now = Date.now();
  await db.execute(
    `INSERT INTO session_plans (id, session_id, agent_id, title, body_md, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (session_id, agent_id) DO UPDATE SET
       title = excluded.title,
       body_md = excluded.body_md,
       status = excluded.status,
       updated_at = excluded.updated_at`,
    [input.id, input.sessionId, input.agentId, input.title, input.bodyMd, input.status, now, now],
  );
  const rows = await db.select<PlanRow>(
    `SELECT id, session_id, agent_id, title, body_md, status, created_at, updated_at
     FROM session_plans
     WHERE session_id = ? AND agent_id = ?`,
    [input.sessionId, input.agentId],
  );
  const row = rows[0];
  if (!row) throw new Error(`plan upsert failed: ${input.sessionId} / ${input.agentId}`);
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
