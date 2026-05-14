import type { Plan, PlanId, PlanStatus, SessionId, TaskId } from '@kay-am/types';
import {
  deletePlan as dbDeletePlan,
  listPlansForSession as dbListPlansForSession,
  updatePlanBody as dbUpdatePlanBody,
  updatePlanStatus as dbUpdatePlanStatus,
  upsertPlan as dbUpsertPlan,
} from '@kay-am/db';
import { tauriDatabase } from './db';

export async function listPlansForSession(sessionId: TaskId): Promise<ReadonlyArray<Plan>> {
  return dbListPlansForSession(tauriDatabase, sessionId);
}

export interface UpsertPlanArgs {
  readonly sessionId: TaskId;
  readonly agentId: SessionId;
  readonly title: string;
  readonly bodyMd: string;
  readonly status?: PlanStatus;
}

export async function upsertPlan(args: UpsertPlanArgs): Promise<Plan> {
  const id = crypto.randomUUID() as PlanId;
  return dbUpsertPlan(tauriDatabase, {
    id,
    sessionId: args.sessionId,
    agentId: args.agentId,
    title: args.title,
    bodyMd: args.bodyMd,
    status: args.status ?? 'active',
  });
}

export async function setPlanStatus(id: PlanId, status: PlanStatus): Promise<void> {
  await dbUpdatePlanStatus(tauriDatabase, id, status);
}

export async function setPlanBody(id: PlanId, title: string, bodyMd: string): Promise<void> {
  await dbUpdatePlanBody(tauriDatabase, id, title, bodyMd);
}

export async function deletePlan(id: PlanId): Promise<void> {
  await dbDeletePlan(tauriDatabase, id);
}
