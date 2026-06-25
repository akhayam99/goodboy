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
  WorkflowRunId,
} from '@goodboy/types'
import {
  addPlanConsumption as dbAddPlanConsumption,
  listConsumptionsForPlan as dbListConsumptionsForPlan,
  listPlansForSession as dbListPlansForSession,
  updatePlanBody as dbUpdatePlanBody,
  updatePlanStatus as dbUpdatePlanStatus,
  upsertPlan as dbUpsertPlan,
} from '@goodboy/db'
import { tauriDatabase } from '../../shared/lib/db'

export const listPlansForSession = async (
  sessionId: SessionId,
): Promise<ReadonlyArray<PlanWithCount>> => {
  return dbListPlansForSession(tauriDatabase, sessionId)
}

export type UpsertPlanArgs = {
  readonly sessionId: SessionId
  readonly agentId: AgentId
  readonly workflowRunId?: WorkflowRunId
  readonly title: string
  readonly bodyMd: string
  readonly clusters?: ReadonlyArray<ImplementationCluster>
}

export const upsertPlan = async (args: UpsertPlanArgs): Promise<Plan> => {
  const id = crypto.randomUUID() as PlanId
  return dbUpsertPlan(tauriDatabase, {
    id,
    sessionId: args.sessionId,
    agentId: args.agentId,
    ...(args.workflowRunId !== undefined && { workflowRunId: args.workflowRunId }),
    title: args.title,
    bodyMd: args.bodyMd,
    ...(args.clusters && { clusters: args.clusters }),
  })
}

export const setPlanStatus = async (id: PlanId, status: PlanStatus): Promise<void> => {
  await dbUpdatePlanStatus(tauriDatabase, id, status)
}

export const setPlanBody = async (id: PlanId, title: string, bodyMd: string): Promise<void> => {
  await dbUpdatePlanBody(tauriDatabase, id, title, bodyMd)
}

export const addPlanConsumption = async (
  planId: PlanId,
  agentId: AgentId,
): Promise<PlanConsumption> => {
  const id = crypto.randomUUID() as PlanConsumptionId
  return dbAddPlanConsumption(tauriDatabase, { id, planId, agentId })
}

export const listConsumptionsForPlan = async (
  planId: PlanId,
): Promise<ReadonlyArray<PlanConsumption>> => {
  return dbListConsumptionsForPlan(tauriDatabase, planId)
}
