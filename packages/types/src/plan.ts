import type { AgentId, IsoDateTime, SessionId, WorkflowRunId } from './ids';

export type PlanId = string & { readonly __brand: 'PlanId' };

export type PlanStatus = 'active' | 'consumed' | 'superseded' | 'discarded';

export type ImplementationCluster = Readonly<{
  title: string;
  instructions: string;
}>;

export type Plan = Readonly<{
  id: PlanId;
  sessionId: SessionId;
  agentId: AgentId;
  workflowRunId?: WorkflowRunId;
  title: string;
  bodyMd: string;
  status: PlanStatus;
  clusters?: ReadonlyArray<ImplementationCluster>;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}>;

export type PlanWithCount = Plan & Readonly<{ consumptionCount: number }>;

export type PlanConsumptionId = string & { readonly __brand: 'PlanConsumptionId' };

export type PlanConsumption = Readonly<{
  id: PlanConsumptionId;
  planId: PlanId;
  agentId: AgentId;
  agentName: string | null;
  stepName?: string | null;
  workflowName?: string | null;
  workflowRunOrdinal?: number | null;
  consumedAt: IsoDateTime;
}>;
