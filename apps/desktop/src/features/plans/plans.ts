import type {
  ImplementationCluster,
  Plan,
  PlanConsumption,
  PlanConsumptionId,
  PlanId,
  PlanStatus,
  PlanWithCount,
  AgentId,
  SessionId,
} from '@goodboy/types';
import {
  addPlanConsumption as dbAddPlanConsumption,
  listConsumptionsForPlan as dbListConsumptionsForPlan,
  listPlansForSession as dbListPlansForSession,
  updatePlanBody as dbUpdatePlanBody,
  updatePlanStatus as dbUpdatePlanStatus,
  upsertPlan as dbUpsertPlan,
} from '@goodboy/db';
import { tauriDatabase } from '../../shared/lib/db';

export async function listPlansForSession(
  sessionId: SessionId,
): Promise<ReadonlyArray<PlanWithCount>> {
  return dbListPlansForSession(tauriDatabase, sessionId);
}

export interface UpsertPlanArgs {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly title: string;
  readonly bodyMd: string;
  readonly clusters?: ReadonlyArray<ImplementationCluster>;
}

export async function upsertPlan(args: UpsertPlanArgs): Promise<Plan> {
  const id = crypto.randomUUID() as PlanId;
  return dbUpsertPlan(tauriDatabase, {
    id,
    sessionId: args.sessionId,
    agentId: args.agentId,
    title: args.title,
    bodyMd: args.bodyMd,
    ...(args.clusters && { clusters: args.clusters }),
  });
}

export async function setPlanStatus(id: PlanId, status: PlanStatus): Promise<void> {
  await dbUpdatePlanStatus(tauriDatabase, id, status);
}

export async function setPlanBody(id: PlanId, title: string, bodyMd: string): Promise<void> {
  await dbUpdatePlanBody(tauriDatabase, id, title, bodyMd);
}

export async function addPlanConsumption(
  planId: PlanId,
  agentId: AgentId,
): Promise<PlanConsumption> {
  const id = crypto.randomUUID() as PlanConsumptionId;
  return dbAddPlanConsumption(tauriDatabase, { id, planId, agentId });
}

export async function listConsumptionsForPlan(
  planId: PlanId,
): Promise<ReadonlyArray<PlanConsumption>> {
  return dbListConsumptionsForPlan(tauriDatabase, planId);
}
