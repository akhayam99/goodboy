import type { AgentId, IsoDateTime, SessionId, WorkflowRunId } from './ids';
import type { ArtifactId, ArtifactStatus, ImplementationCluster } from './artifact';

export type PlanId = ArtifactId;

export type PlanStatus = ArtifactStatus;

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

export type PlanLastConsumer = Readonly<{
  agentId: AgentId;
  name: string | null;
}>;

export type PlanWithCount = Plan &
  Readonly<{
    consumptionCount: number;
    lastConsumer?: PlanLastConsumer | null;
  }>;

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
